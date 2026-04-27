/**
 * Liquidation heatmap computation using Binance public APIs.
 *
 * Algorithm:
 * For each historical time slice (price + OI + long/short ratio):
 *   For each leverage tier (5x, 10x, 20x, 50x, 100x):
 *     Long liq price  = entry × (1 - 1/leverage)
 *     Short liq price = entry × (1 + 1/leverage)
 *     Heat at (time, liq_price) += OI × side_ratio × leverage_weight
 *
 * The grid is then forward-accumulated (EMA) to create the
 * characteristic horizontal banding effect.
 */

export type PriceCandle = {
  ts:    number;
  open:  number;
  high:  number;
  low:   number;
  close: number;
};

export type HeatmapResult = {
  grid:         Float32Array;   // [TIME_BUCKETS × PRICE_BUCKETS] row-major
  pMin:         number;
  pMax:         number;
  timeStart:    number;
  timeEnd:      number;
  candles:      PriceCandle[];  // for overlay
  currentPrice: number;
  timeBuckets:  number;
  priceBuckets: number;
};

// ── Config ────────────────────────────────────────────────────────────────
export const TIME_BUCKETS  = 220;
export const PRICE_BUCKETS = 140;

// Leverage tier weights (must sum to 1)
const LEV_DIST = [
  { lev: 5,   w: 0.07 },
  { lev: 10,  w: 0.28 },
  { lev: 20,  w: 0.27 },
  { lev: 50,  w: 0.24 },
  { lev: 100, w: 0.14 },
];

// Window → { OI period, candle interval, OI limit, candle limit }
export const WINDOW_CFG = {
  "1h":  { oiPeriod: "5m",  oiLimit: 12,  cInterval: "1m",  cLimit: 60  },
  "4h":  { oiPeriod: "5m",  oiLimit: 48,  cInterval: "5m",  cLimit: 48  },
  "12h": { oiPeriod: "15m", oiLimit: 48,  cInterval: "15m", cLimit: 48  },
  "24h": { oiPeriod: "30m", oiLimit: 48,  cInterval: "30m", cLimit: 48  },
} as const;

export type WindowKey = keyof typeof WINDOW_CFG;

// ── Fetch helpers ─────────────────────────────────────────────────────────
async function get<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return res.ok ? (res.json() as Promise<T>) : null;
  } catch {
    return null;
  }
}

// ── Main ──────────────────────────────────────────────────────────────────
export async function buildLiqHeatmap(
  coin:   string,
  window: WindowKey,
): Promise<HeatmapResult | null> {
  const sym = `${coin}USDT`;
  const cfg = WINDOW_CFG[window];

  type RawKline = [number, string, string, string, string, ...unknown[]];
  type OIRow    = { timestamp: number; sumOpenInterestValue: string };
  type LSRow    = { timestamp: number; longAccount: string; shortAccount: string };
  type PremIdx  = { markPrice: string };

  const [rawCandles, rawOI, rawLS, prem] = await Promise.all([
    get<RawKline[]>(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${cfg.cInterval}&limit=${cfg.cLimit}`,
    ),
    get<OIRow[]>(
      `https://fapi.binance.com/futures/data/openInterestHist?symbol=${sym}&period=${cfg.oiPeriod}&limit=${cfg.oiLimit}`,
    ),
    get<LSRow[]>(
      `https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=${cfg.oiPeriod}&limit=${cfg.oiLimit}`,
    ),
    get<PremIdx>(
      `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`,
    ),
  ]);

  if (!rawCandles || rawCandles.length === 0) return null;

  // ── Parse candles ─────────────────────────────────────────────────────
  const candles: PriceCandle[] = rawCandles.map(k => ({
    ts:    Number(k[0]),
    open:  parseFloat(k[1]),
    high:  parseFloat(k[2]),
    low:   parseFloat(k[3]),
    close: parseFloat(k[4]),
  }));

  const currentPrice = prem
    ? parseFloat(prem.markPrice)
    : candles[candles.length - 1].close;

  // ── Build OI + LS lookup (keyed by rounded timestamp) ────────────────
  // OI and LS timestamps may be at different intervals; find nearest.
  const oiArr: { ts: number; oiUSD: number }[] = (rawOI ?? []).map(o => ({
    ts:    o.timestamp,
    oiUSD: parseFloat(o.sumOpenInterestValue),
  }));

  const lsArr: { ts: number; longPct: number; shortPct: number }[] = (rawLS ?? []).map(ls => ({
    ts:       ls.timestamp,
    longPct:  parseFloat(ls.longAccount),
    shortPct: parseFloat(ls.shortAccount),
  }));

  function nearest<T extends { ts: number }>(arr: T[], target: number): T | null {
    if (arr.length === 0) return null;
    return arr.reduce((best, cur) =>
      Math.abs(cur.ts - target) < Math.abs(best.ts - target) ? cur : best,
    );
  }

  // ── Price range ───────────────────────────────────────────────────────
  const allPrices = candles.flatMap(c => [c.high, c.low]);
  if (allPrices.length === 0) return null;

  const pMin = Math.min(...allPrices) * 0.980;
  const pMax = Math.max(...allPrices) * 1.020;
  const pRange = pMax - pMin;
  if (pRange === 0) return null;

  const timeStart = candles[0].ts;
  const candleWidth = candles.length > 1
    ? candles[1].ts - candles[0].ts
    : 5 * 60_000;
  const timeEnd = candles[candles.length - 1].ts + candleWidth;
  const timeRange = timeEnd - timeStart;

  // ── Build raw heat grid ───────────────────────────────────────────────
  const raw = new Float32Array(TIME_BUCKETS * PRICE_BUCKETS);

  const addHeat = (tx: number, price: number, amount: number) => {
    if (!isFinite(price) || price < pMin || price > pMax) return;
    const py = Math.min(
      PRICE_BUCKETS - 1,
      Math.floor(((price - pMin) / pRange) * PRICE_BUCKETS),
    );
    const flipped = PRICE_BUCKETS - 1 - py; // high price at top
    const idx = tx * PRICE_BUCKETS + flipped;
    raw[idx] += amount;
  };

  for (const candle of candles) {
    const tx = Math.min(
      TIME_BUCKETS - 1,
      Math.floor(((candle.ts - timeStart) / timeRange) * TIME_BUCKETS),
    );

    const oiRow = nearest(oiArr, candle.ts);
    const lsRow = nearest(lsArr, candle.ts);

    const oi       = oiRow?.oiUSD  ?? 0;
    const longPct  = lsRow?.longPct  ?? 0.5;
    const shortPct = lsRow?.shortPct ?? 0.5;

    const entryPrice = (candle.open + candle.close) / 2;

    for (const { lev, w } of LEV_DIST) {
      const longLiqPrice  = entryPrice * (1 - 1 / lev);
      const shortLiqPrice = entryPrice * (1 + 1 / lev);

      addHeat(tx, longLiqPrice,  oi * longPct  * w);
      addHeat(tx, shortLiqPrice, oi * shortPct * w);
    }
  }

  // ── Forward EMA accumulation (creates horizontal band persistence) ────
  // High DECAY = bands linger longer; lower = faster fade
  const DECAY = Math.exp(-1.8 / TIME_BUCKETS);
  const grid  = new Float32Array(TIME_BUCKETS * PRICE_BUCKETS);

  for (let py = 0; py < PRICE_BUCKETS; py++) {
    let ema = 0;
    for (let tx = 0; tx < TIME_BUCKETS; tx++) {
      ema = ema * DECAY + raw[tx * PRICE_BUCKETS + py];
      grid[tx * PRICE_BUCKETS + py] = ema;
    }
  }

  return {
    grid,
    pMin,
    pMax,
    timeStart,
    timeEnd,
    candles,
    currentPrice,
    timeBuckets:  TIME_BUCKETS,
    priceBuckets: PRICE_BUCKETS,
  };
}
