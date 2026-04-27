/**
 * Liquidation Heatmap — Coinglass-style algorithm (v4, final).
 *
 * Core principle (matches Coinglass behavior):
 *   - Bands FOLLOW price movement over time → staircase effect is CORRECT
 *   - Forward EMA accumulation → bands trail rightward (open positions persist)
 *   - Dark background, bright only at specific leverage liquidation levels
 *   - Discrete leverage tiers → clean distinct bands, not a continuous smear
 *
 * Pipeline:
 *   1. Per-time-step: for each candle, compute liq prices at each leverage tier
 *      and add OI heat to rawGrid[time][price]
 *   2. Narrow Gaussian price-smoothing → 3-5 px wide bands (not hair-thin)
 *   3. Forward EMA accumulation → bands persist rightward (decay over time)
 *   4. High-contrast rendering (power ≈ 1.8) → dark background, bright peaks
 */

export type PriceCandle = {
  ts: number; open: number; high: number; low: number; close: number;
};

export type HeatmapResult = {
  grid:         Float32Array;
  pMin:         number;
  pMax:         number;
  timeStart:    number;
  timeEnd:      number;
  candles:      PriceCandle[];
  currentPrice: number;
  timeBuckets:  number;
  priceBuckets: number;
};

export const TIME_BUCKETS  = 280;
export const PRICE_BUCKETS = 300;

// ── Discrete leverage tiers ────────────────────────────────────────────────
// Spacing: 25x=4%, 33x=3%, 50x=2%, 75x=1.3%, 100x=1%, 150x=0.67%, 200x=0.5%
// Higher weight on 50x & 100x (most common retail leverage)
const LEV_DIST = [
  { lev: 25,  w: 0.08 },
  { lev: 33,  w: 0.10 },
  { lev: 50,  w: 0.22 },
  { lev: 75,  w: 0.18 },
  { lev: 100, w: 0.24 },
  { lev: 150, w: 0.12 },
  { lev: 200, w: 0.06 },
] as const;

// ── Narrow Gaussian — 3px smoothing so bands are visible but thin ──────────
const GAUSS_R   = 2;
const GAUSS_SIG = 0.55;
const GAUSS_K: number[] = (() => {
  const k: number[] = [];
  let s = 0;
  for (let d = -GAUSS_R; d <= GAUSS_R; d++) {
    const v = Math.exp(-(d * d) / (2 * GAUSS_SIG * GAUSS_SIG));
    k.push(v); s += v;
  }
  return k.map(v => v / s);
})();

// ── Window config ──────────────────────────────────────────────────────────
export const WINDOW_CFG = {
  "1h":  { oiPeriod: "5m",  oiLimit: 12,  cInterval: "1m",  cLimit: 60  },
  "4h":  { oiPeriod: "5m",  oiLimit: 48,  cInterval: "1m",  cLimit: 240 },
  "12h": { oiPeriod: "5m",  oiLimit: 144, cInterval: "5m",  cLimit: 144 },
  "24h": { oiPeriod: "15m", oiLimit: 96,  cInterval: "15m", cLimit: 96  },
} as const;
export type WindowKey = keyof typeof WINDOW_CFG;

// EMA decay per bucket — controls how long bands persist rightward
// 0.980 → ~50-bucket half-life, good for all window sizes
const EMA_DECAY = 0.980;

// ── Helpers ────────────────────────────────────────────────────────────────
async function get<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return r.ok ? (r.json() as Promise<T>) : null;
  } catch { return null; }
}

function nearest<T extends { ts: number }>(arr: T[], t: number): T | undefined {
  return arr.length
    ? arr.reduce((b, c) => Math.abs(c.ts - t) < Math.abs(b.ts - t) ? c : b)
    : undefined;
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
    ts: Number(k[0]), open: parseFloat(k[1]),
    high: parseFloat(k[2]), low: parseFloat(k[3]), close: parseFloat(k[4]),
  }));

  const currentPrice = prem ? parseFloat(prem.markPrice) : candles.at(-1)!.close;

  const oiArr = (rawOI ?? []).map(o => ({ ts: o.timestamp, v: parseFloat(o.sumOpenInterestValue) }));
  const lsArr = (rawLS ?? []).map(l => ({
    ts: l.timestamp, long: parseFloat(l.longAccount), short: parseFloat(l.shortAccount),
  }));

  // ── Price range: actual extremes + 5% margin (tracks real price movement) ─
  const allPrices = candles.flatMap(c => [c.high, c.low]);
  const pMin = Math.min(...allPrices) * 0.95;
  const pMax = Math.max(...allPrices) * 1.05;
  const pRange = pMax - pMin;
  if (pRange === 0) return null;

  const PB = PRICE_BUCKETS;
  const TB = TIME_BUCKETS;

  const timeStart = candles[0].ts;
  const dT        = candles.length > 1 ? candles[1].ts - candles[0].ts : 5 * 60_000;
  const timeEnd   = candles.at(-1)!.ts + dT;
  const timeRange = timeEnd - timeStart;

  const priceToBucket = (p: number): number => {
    if (p < pMin || p > pMax) return -1;
    return Math.min(PB - 1, Math.floor(((p - pMin) / pRange) * PB));
  };

  // ── Step 1: Per-time-step raw grid ────────────────────────────────────────
  const rawGrid = new Float32Array(TB * PB);

  for (const c of candles) {
    const tx    = Math.min(TB - 1, Math.floor(((c.ts - timeStart) / timeRange) * TB));
    const oi    = nearest(oiArr, c.ts)?.v ?? 0;
    const ls    = nearest(lsArr, c.ts);
    const longP  = ls?.long  ?? 0.5;
    const shortP = ls?.short ?? 0.5;
    const entry  = (c.open + c.close) / 2;

    for (const { lev, w } of LEV_DIST) {
      const longLiq  = entry * (1 - 1 / lev);
      const shortLiq = entry * (1 + 1 / lev);

      const pyL = priceToBucket(longLiq);
      const pyS = priceToBucket(shortLiq);
      if (pyL >= 0) rawGrid[tx * PB + (PB - 1 - pyL)] += oi * longP  * w;
      if (pyS >= 0) rawGrid[tx * PB + (PB - 1 - pyS)] += oi * shortP * w;
    }
  }

  // ── Step 2: Gaussian price-axis smoothing (thin but visible bands) ────────
  const smoothed = new Float32Array(TB * PB);
  for (let tx = 0; tx < TB; tx++) {
    for (let py = 0; py < PB; py++) {
      const v = rawGrid[tx * PB + py];
      if (v === 0) continue;
      for (let d = -GAUSS_R; d <= GAUSS_R; d++) {
        const py2 = py + d;
        if (py2 >= 0 && py2 < PB) smoothed[tx * PB + py2] += v * GAUSS_K[d + GAUSS_R];
      }
    }
  }

  // ── Step 3: Build price path — running min/max of candle wicks ───────────
  // Used to detect which liquidation zones were actually consumed by price movement
  const pathLow  = new Float32Array(TB).fill(Infinity);
  const pathHigh = new Float32Array(TB).fill(-Infinity);

  for (const c of candles) {
    const tx = Math.min(TB - 1, Math.floor(((c.ts - timeStart) / timeRange) * TB));
    pathLow[tx]  = Math.min(pathLow[tx],  c.low);
    pathHigh[tx] = Math.max(pathHigh[tx], c.high);
  }

  // Convert to running cumulative min/max (forward pass)
  let runLow = Infinity, runHigh = -Infinity;
  for (let tx = 0; tx < TB; tx++) {
    if (isFinite(pathLow[tx]))  runLow  = Math.min(runLow,  pathLow[tx]);
    if (isFinite(pathHigh[tx])) runHigh = Math.max(runHigh, pathHigh[tx]);
    pathLow[tx]  = isFinite(runLow)  ? runLow  : pMin;
    pathHigh[tx] = isFinite(runHigh) ? runHigh : pMax;
  }

  // ── Step 4: Forward EMA + simultaneous liquidation clearing ──────────────
  // At each time step:
  //   - EMA accumulates new positions (persistence)
  //   - Zones where price has passed through get cleared (liquidated positions disappear)
  //
  // clearing factor = exp(-K × relative_distance_past_path)
  // K=70: 1% past path → 50% cleared, 3% past → 12%, 5% past → 3%
  const K_CLEAR = 70;

  const grid = new Float32Array(TB * PB);
  for (let py = 0; py < PB; py++) {
    // Actual price this bucket represents (high price at top, low at bottom)
    const bucketPrice = pMax - (py + 0.5) / PB * pRange;

    let ema = 0;
    for (let tx = 0; tx < TB; tx++) {
      ema = ema * EMA_DECAY + smoothed[tx * PB + py];

      // Determine clearing factor based on price path
      let factor = 1.0;
      const pLow  = pathLow[tx];
      const pHigh = pathHigh[tx];

      if (bucketPrice < pLow) {
        // Long liq zone: price has been BELOW this level → longs got liquidated
        const dist = (pLow - bucketPrice) / pLow;
        factor = Math.exp(-K_CLEAR * dist);
      } else if (bucketPrice > pHigh) {
        // Short liq zone: price has been ABOVE this level → shorts got liquidated
        const dist = (bucketPrice - pHigh) / pHigh;
        factor = Math.exp(-K_CLEAR * dist);
      }

      grid[tx * PB + py] = ema * factor;
    }
  }

  return { grid, pMin, pMax, timeStart, timeEnd, candles, currentPrice, timeBuckets: TB, priceBuckets: PB };
}
