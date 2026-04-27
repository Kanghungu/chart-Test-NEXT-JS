/**
 * Liquidation Heatmap — Coinglass-style self-developed algorithm.
 *
 * Key insight vs previous broken version:
 *   WRONG: compute liq levels per-time-step → diagonal staircase as price moves
 *   RIGHT: compute a GLOBAL profile (sum across all history), replicate horizontally,
 *          then modulate per time step by OI magnitude → proper horizontal bands
 *
 * Algorithm:
 *   1. For each historical candle (entry price + OI):
 *        For each leverage L in 5x→200x (continuous, log-normal weighted):
 *          long_liq  = entry × (1 − 1/L)
 *          short_liq = entry × (1 + 1/L)
 *          globalProfile[liq_price_bucket] += OI × side_ratio × w(L)
 *   2. Gaussian-smooth globalProfile in price axis → thick continuous bands
 *   3. Build grid: grid[tx][py] = globalProfile[py] × oiModulation(tx)
 *        (horizontal bands, slightly brighter/dimmer as OI changes over time)
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

// ── Continuous log-normal leverage distribution ────────────────────────────
// Peaks around 15x, covers 5x → 200x
const LEV_LEVELS: Array<{ lev: number; w: number }> = [];
{
  const MU    = Math.log(15);  // peak leverage
  const SIGMA = 0.9;
  let total = 0;
  for (let lev = 5; lev <= 200; lev++) {
    const logL = Math.log(lev);
    const w = Math.exp(-((logL - MU) ** 2) / (2 * SIGMA * SIGMA)) / lev; // /lev for density
    LEV_LEVELS.push({ lev, w });
    total += w;
  }
  LEV_LEVELS.forEach(l => (l.w /= total)); // normalize to sum=1
}

// ── Gaussian smoothing kernel (price axis) ─────────────────────────────────
const GAUSS_R   = 2;
const GAUSS_SIG = 0.7;
const GAUSS_K: number[] = [];
{
  let s = 0;
  for (let d = -GAUSS_R; d <= GAUSS_R; d++) {
    const v = Math.exp(-(d * d) / (2 * GAUSS_SIG * GAUSS_SIG));
    GAUSS_K.push(v);
    s += v;
  }
  for (let i = 0; i < GAUSS_K.length; i++) GAUSS_K[i] /= s;
}

// Window config — more candles for better overlay
export const WINDOW_CFG = {
  "1h":  { oiPeriod: "5m",  oiLimit: 12,  cInterval: "1m",  cLimit: 60  },
  "4h":  { oiPeriod: "5m",  oiLimit: 48,  cInterval: "1m",  cLimit: 240 },
  "12h": { oiPeriod: "5m",  oiLimit: 144, cInterval: "5m",  cLimit: 144 },
  "24h": { oiPeriod: "15m", oiLimit: 96,  cInterval: "15m", cLimit: 96  },
} as const;
export type WindowKey = keyof typeof WINDOW_CFG;

// ── Helpers ────────────────────────────────────────────────────────────────
async function get<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return r.ok ? (r.json() as Promise<T>) : null;
  } catch { return null; }
}

function nearest<T extends { ts: number }>(arr: T[], target: number): T | undefined {
  if (!arr.length) return undefined;
  return arr.reduce((b, c) => Math.abs(c.ts - target) < Math.abs(b.ts - target) ? c : b);
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

  // ── Price range: median ±10% so all leverage levels are visible ──────────
  const sorted = [...candles.map(c => c.close)].sort((a, b) => a - b);
  const med    = sorted[Math.floor(sorted.length / 2)];
  const pMin   = med * 0.900;
  const pMax   = med * 1.100;
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

  // ── Step 1: Build GLOBAL profile (horizontal bands, no staircase) ────────
  // Sum OI contributions from ALL candles into one price profile.
  // This is the key change vs the broken version: we DON'T compute per time step.
  const rawProfile = new Float32Array(PB);

  // Recency weight: recent candles count more (current positions dominate)
  const N = candles.length;
  for (let i = 0; i < N; i++) {
    const c     = candles[i];
    const recency = Math.exp(-2.0 * (N - 1 - i) / N); // 0→~0.14 (old), 1 (newest)
    const oi    = nearest(oiArr, c.ts)?.v ?? 0;
    const ls    = nearest(lsArr, c.ts);
    const longP  = ls?.long  ?? 0.5;
    const shortP = ls?.short ?? 0.5;
    const entry  = (c.open + c.close) / 2;
    const heat   = oi * recency;

    for (const { lev, w } of LEV_LEVELS) {
      const longLiq  = entry * (1 - 1 / lev);
      const shortLiq = entry * (1 + 1 / lev);
      const pyL = priceToBucket(longLiq);
      const pyS = priceToBucket(shortLiq);
      if (pyL >= 0) rawProfile[PB - 1 - pyL] += heat * longP  * w;
      if (pyS >= 0) rawProfile[PB - 1 - pyS] += heat * shortP * w;
    }
  }

  // ── Step 2: Gaussian smooth profile (price axis) — smooth bands ──────────
  const profile = new Float32Array(PB);
  for (let py = 0; py < PB; py++) {
    let sum = 0;
    for (let d = -GAUSS_R; d <= GAUSS_R; d++) {
      const py2 = py + d;
      if (py2 < 0 || py2 >= PB) continue;
      sum += rawProfile[py2] * GAUSS_K[d + GAUSS_R];
    }
    profile[py] = sum;
  }

  // Normalize profile to [0, 1]
  let maxP = 0;
  for (let py = 0; py < PB; py++) if (profile[py] > maxP) maxP = profile[py];
  if (maxP > 0) for (let py = 0; py < PB; py++) profile[py] /= maxP;

  // ── Step 3: OI time series for modulation ────────────────────────────────
  // Compute per-time-bucket OI to modulate band brightness over time
  const oiAtTx = new Float32Array(TB).fill(1.0);
  let oiSum = 0, oiCount = 0;
  for (const o of oiArr) { oiSum += o.v; oiCount++; }
  const oiAvg = oiCount > 0 ? oiSum / oiCount : 1;

  for (const o of oiArr) {
    const tx = Math.min(TB - 1, Math.floor(((o.ts - timeStart) / timeRange) * TB));
    if (tx >= 0) oiAtTx[tx] = o.v / oiAvg; // ratio vs average
  }

  // Smooth oiAtTx with box filter to avoid spiky jumps
  const oiSmooth = new Float32Array(TB);
  for (let tx = 0; tx < TB; tx++) {
    let s = 0, cnt = 0;
    for (let d = -3; d <= 3; d++) {
      const tx2 = tx + d;
      if (tx2 >= 0 && tx2 < TB) { s += oiAtTx[tx2]; cnt++; }
    }
    oiSmooth[tx] = cnt > 0 ? s / cnt : 1;
  }

  // ── Step 4: Build final grid ──────────────────────────────────────────────
  // Base: globalProfile replicated across time (gives horizontal bands)
  // Modulated: ±15% by OI changes (subtle time variation without destroying bands)
  const grid = new Float32Array(TB * PB);
  for (let tx = 0; tx < TB; tx++) {
    const mod = 0.85 + 0.15 * Math.min(2, oiSmooth[tx]); // clamp modulation 0.85–1.15
    for (let py = 0; py < PB; py++) {
      grid[tx * PB + py] = profile[py] * mod;
    }
  }

  return { grid, pMin, pMax, timeStart, timeEnd, candles, currentPrice, timeBuckets: TB, priceBuckets: PB };
}
