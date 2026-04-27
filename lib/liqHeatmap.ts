/**
 * Liquidation heatmap — self-developed Coinglass-style algorithm.
 *
 * Core idea:
 *   At each historical time step T with price P_T and open interest OI_T:
 *     For each leverage tier L: long liq = P_T × (1 - 1/L), short liq = P_T × (1 + 1/L)
 *     Heat at (T, liq_price) += OI_T × side_ratio × weight(L)
 *
 * Then:
 *   1. Apply Gaussian price-axis smoothing  →  thick continuous bands
 *   2. Build "global profile" (sum over time) →  bands visible across full time axis
 *   3. Final grid = 0.72 × profile  +  0.28 × local    (Coinglass-like uniform appearance)
 */

export type PriceCandle = {
  ts: number; open: number; high: number; low: number; close: number;
};

export type HeatmapResult = {
  grid:         Float32Array;   // TIME_BUCKETS × PRICE_BUCKETS, row-major
  pMin:         number;
  pMax:         number;
  timeStart:    number;
  timeEnd:      number;
  candles:      PriceCandle[];
  currentPrice: number;
  timeBuckets:  number;
  priceBuckets: number;
};

export const TIME_BUCKETS  = 240;
export const PRICE_BUCKETS = 160;

// Leverage distribution — must sum to 1.0
const LEV_DIST = [
  { lev: 10,  w: 0.25 },
  { lev: 20,  w: 0.28 },
  { lev: 50,  w: 0.27 },
  { lev: 100, w: 0.20 },
];

// Gaussian kernel for price-axis smoothing
const GAUSS_R  = 3;     // radius (cells)
const GAUSS_SIG = 1.4;  // σ
const gaussKernel: number[] = [];
let gaussSum = 0;
for (let d = -GAUSS_R; d <= GAUSS_R; d++) {
  const v = Math.exp(-(d * d) / (2 * GAUSS_SIG * GAUSS_SIG));
  gaussKernel.push(v);
  gaussSum += v;
}
const gaussNorm = gaussKernel.map(v => v / gaussSum);

// Window config
export const WINDOW_CFG = {
  "1h":  { oiPeriod: "5m",  oiLimit: 12,  cInterval: "1m",  cLimit: 60  },
  "4h":  { oiPeriod: "5m",  oiLimit: 48,  cInterval: "5m",  cLimit: 48  },
  "12h": { oiPeriod: "15m", oiLimit: 48,  cInterval: "15m", cLimit: 48  },
  "24h": { oiPeriod: "30m", oiLimit: 48,  cInterval: "30m", cLimit: 48  },
} as const;
export type WindowKey = keyof typeof WINDOW_CFG;

// ── Fetch ──────────────────────────────────────────────────────────────────
async function get<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    return res.ok ? (res.json() as Promise<T>) : null;
  } catch { return null; }
}

// ── Main ───────────────────────────────────────────────────────────────────
export async function buildLiqHeatmap(
  coin:   string,
  window: WindowKey,
): Promise<HeatmapResult | null> {
  const sym = `${coin}USDT`;
  const cfg = WINDOW_CFG[window];

  type RawK  = [number, string, string, string, string, ...unknown[]];
  type OIRow = { timestamp: number; sumOpenInterestValue: string };
  type LSRow = { timestamp: number; longAccount: string; shortAccount: string };
  type Prem  = { markPrice: string };

  const [rawK, rawOI, rawLS, prem] = await Promise.all([
    get<RawK[]>(`https://fapi.binance.com/fapi/v1/klines?symbol=${sym}&interval=${cfg.cInterval}&limit=${cfg.cLimit}`),
    get<OIRow[]>(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${sym}&period=${cfg.oiPeriod}&limit=${cfg.oiLimit}`),
    get<LSRow[]>(`https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol=${sym}&period=${cfg.oiPeriod}&limit=${cfg.oiLimit}`),
    get<Prem>(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${sym}`),
  ]);

  if (!rawK || rawK.length === 0) return null;

  const candles: PriceCandle[] = rawK.map(k => ({
    ts: Number(k[0]), open: parseFloat(k[1]), high: parseFloat(k[2]),
    low: parseFloat(k[3]), close: parseFloat(k[4]),
  }));

  const currentPrice = prem ? parseFloat(prem.markPrice) : candles.at(-1)!.close;

  // OI / LS lookup by nearest timestamp
  const oiArr = (rawOI ?? []).map(o => ({ ts: o.timestamp, v: parseFloat(o.sumOpenInterestValue) }));
  const lsArr = (rawLS ?? []).map(l => ({ ts: l.timestamp, long: parseFloat(l.longAccount), short: parseFloat(l.shortAccount) }));

  function nearest<T extends { ts: number }>(arr: T[], target: number): T | undefined {
    if (!arr.length) return undefined;
    return arr.reduce((b, c) => Math.abs(c.ts - target) < Math.abs(b.ts - target) ? c : b);
  }

  // ── Price range — ±10% from median of candle closes ───────────────────
  const sorted = [...candles.map(c => c.close)].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const pMin   = median * 0.900;
  const pMax   = median * 1.100;
  const pRange = pMax - pMin;
  if (pRange === 0) return null;

  const TB = TIME_BUCKETS;
  const PB = PRICE_BUCKETS;

  const timeStart = candles[0].ts;
  const dT        = candles.length > 1 ? candles[1].ts - candles[0].ts : 5 * 60_000;
  const timeEnd   = candles.at(-1)!.ts + dT;
  const timeRange = timeEnd - timeStart;

  // ── Step 1: raw grid ──────────────────────────────────────────────────
  const raw = new Float32Array(TB * PB);

  const addHeat = (tx: number, price: number, heat: number) => {
    if (!isFinite(price) || price < pMin || price > pMax || heat <= 0) return;
    const py = Math.min(PB - 1, Math.floor(((price - pMin) / pRange) * PB));
    const flipped = PB - 1 - py;
    raw[tx * PB + flipped] += heat;
  };

  for (const c of candles) {
    const tx = Math.min(TB - 1, Math.floor(((c.ts - timeStart) / timeRange) * TB));
    const oi  = nearest(oiArr, c.ts)?.v    ?? 0;
    const ls  = nearest(lsArr, c.ts);
    const lp  = ls?.long  ?? 0.5;
    const sp  = ls?.short ?? 0.5;
    const entry = (c.open + c.close) / 2;

    for (const { lev, w } of LEV_DIST) {
      addHeat(tx, entry * (1 - 1 / lev), oi * lp * w);
      addHeat(tx, entry * (1 + 1 / lev), oi * sp * w);
    }
  }

  // ── Step 2: Gaussian price-axis smoothing (thick bands) ───────────────
  const smoothed = new Float32Array(TB * PB);
  for (let tx = 0; tx < TB; tx++) {
    for (let py = 0; py < PB; py++) {
      const v = raw[tx * PB + py];
      if (v === 0) continue;
      for (let d = -GAUSS_R; d <= GAUSS_R; d++) {
        const py2 = py + d;
        if (py2 < 0 || py2 >= PB) continue;
        smoothed[tx * PB + py2] += v * gaussNorm[d + GAUSS_R];
      }
    }
  }

  // ── Step 3: Global profile (Coinglass-style uniform time distribution) ─
  // Sum across time → each price level gets its "total heat" regardless of when
  const profile = new Float32Array(PB);
  for (let tx = 0; tx < TB; tx++) {
    for (let py = 0; py < PB; py++) {
      profile[py] += smoothed[tx * PB + py];
    }
  }

  // ── Step 4: Blend profile (uniform background) + local (time peaks) ───
  const grid = new Float32Array(TB * PB);
  for (let tx = 0; tx < TB; tx++) {
    for (let py = 0; py < PB; py++) {
      const bg    = profile[py];               // same value across all time → uniform band
      const local = smoothed[tx * PB + py] * TB; // scaled up to be comparable to bg
      grid[tx * PB + py] = bg * 0.72 + local * 0.28;
    }
  }

  return { grid, pMin, pMax, timeStart, timeEnd, candles, currentPrice, timeBuckets: TB, priceBuckets: PB };
}
