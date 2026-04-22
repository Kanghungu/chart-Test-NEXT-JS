/**
 * Client-safe crypto signal detection.
 *
 * Runs entirely in the browser — fetches OHLCV directly from exchange APIs,
 * which works because the user's browser is NOT blocked (Vercel servers are).
 *
 * Exchange fallback chain: Binance → OKX → Bybit.
 * Detects: harmonic patterns, RSI divergence, volume-weighted zone breakouts.
 */

// ── Types ──────────────────────────────────────────────────────────────────
export type TF = "15m" | "1h" | "4h";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type Pivot = {
  type: "high" | "low";
  price: number;
  index: number;
  time: number;
};

export type VizPoint = { time: number; price: number; label?: string };

export type SignalViz =
  | { kind: "HARMONIC"; points: VizPoint[]; przMin: number; przMax: number }
  | { kind: "DIVERGENCE"; pricePoints: VizPoint[]; rsiPoints: VizPoint[]; rsi: Array<{ time: number; value: number }> }
  | { kind: "ZONE_BREAK"; zoneLow: number; zoneHigh: number; breakoutTime: number; zoneStartTime: number; zoneEndTime: number };

export type CryptoSignal = {
  id: string;
  symbol: string;
  base: string;
  timeframe: TF;
  type: "HARMONIC" | "DIVERGENCE" | "ZONE_BREAK";
  direction: "BULLISH" | "BEARISH";
  patternName?: string;
  currentPrice: number;
  przMin?: number;
  przMax?: number;
  strength: "STRONG" | "MEDIUM";
  descriptionKo: string;
  descriptionEn: string;
  detectedAt: number;
  /** Last ~120 candles for chart rendering. */
  candles: Candle[];
  /** Pattern-specific overlay geometry. */
  viz: SignalViz;
};

// ── Config ─────────────────────────────────────────────────────────────────
export const CRYPTO_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT", "ADAUSDT", "DOGEUSDT",
  "VIRTUALUSDT", "TAOUSDT", "WLDUSDT", "MAGICUSDT", "LTCUSDT", "ENAUSDT", "TURBOUSDT",
];
export const CRYPTO_TFS: TF[] = ["15m", "1h", "4h"];

const PIVOT_N:  Record<TF, number> = { "15m": 3,  "1h": 4,  "4h": 5  };
const RECENCY:  Record<TF, number> = { "15m": 24, "1h": 20, "4h": 14 };

const BYBIT_IV: Record<TF, string> = { "15m": "15",  "1h": "60", "4h": "240" };
const OKX_IV:   Record<TF, string> = { "15m": "15m", "1h": "1H", "4h": "4H"  };

// ── OHLCV Fetch: Binance → OKX → Bybit fallback ───────────────────────────
async function fetchCandles(symbol: string, tf: TF, limit = 200): Promise<Candle[]> {
  // 1) Binance (browser origin accepted)
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=${limit}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const raw: unknown[][] = await res.json();
      return raw.map((d) => ({
        time: d[0] as number,
        open: parseFloat(d[1] as string),
        high: parseFloat(d[2] as string),
        low:  parseFloat(d[3] as string),
        close: parseFloat(d[4] as string),
        volume: parseFloat(d[5] as string),
      }));
    }
  } catch { /* fall through */ }

  // 2) OKX
  try {
    const base = symbol.replace("USDT", "");
    const url = `https://www.okx.com/api/v5/market/candles?instId=${base}-USDT&bar=${OKX_IV[tf]}&limit=${limit}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data.code === "0" && Array.isArray(data.data) && data.data.length > 0) {
        return (data.data as string[][]).slice().reverse().map((d) => ({
          time: parseInt(d[0]),
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low:  parseFloat(d[3]),
          close: parseFloat(d[4]),
          volume: parseFloat(d[5]),
        }));
      }
    }
  } catch { /* fall through */ }

  // 3) Bybit
  try {
    const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${BYBIT_IV[tf]}&limit=${limit}`;
    const res = await fetch(url, { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      const list: string[][] = data?.result?.list;
      if (Array.isArray(list) && list.length > 0) {
        return list.slice().reverse().map((d) => ({
          time: parseInt(d[0]),
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low:  parseFloat(d[3]),
          close: parseFloat(d[4]),
          volume: parseFloat(d[5]),
        }));
      }
    }
  } catch { /* fall through */ }

  return [];
}

// ── RSI (Wilder smoothing) ─────────────────────────────────────────────────
function calcRSI(closes: number[], period = 14): number[] {
  const out: number[] = new Array(period).fill(NaN);
  if (closes.length <= period) return out;
  let ag = 0, al = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    ag += d > 0 ? d : 0;
    al += d < 0 ? -d : 0;
  }
  ag /= period; al /= period;
  out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period;
    al = (al * (period - 1) + (d < 0 ? -d : 0)) / period;
    out.push(al === 0 ? 100 : 100 - 100 / (1 + ag / al));
  }
  return out;
}

// ── Pivots ────────────────────────────────────────────────────────────────
function findPivots(candles: Candle[], n: number): Pivot[] {
  const pivots: Pivot[] = [];
  for (let i = n; i < candles.length - n; i++) {
    let isH = true, isL = true;
    for (let j = i - n; j <= i + n; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isH = false;
      if (candles[j].low  <= candles[i].low)  isL = false;
    }
    if (isH) pivots.push({ type: "high", price: candles[i].high, index: i, time: candles[i].time });
    else if (isL) pivots.push({ type: "low",  price: candles[i].low,  index: i, time: candles[i].time });
  }
  return pivots;
}

// ── Harmonic ──────────────────────────────────────────────────────────────
// Tolerance: ±5% for B/XA, C ratios; ±6% for D ratios
const H_TOL_BC = 0.05;
const H_TOL_D  = 0.06;

function inRange(v: number, lo: number, hi: number, tol: number): boolean {
  return v >= lo - tol && v <= hi + tol;
}

/**
 * C-point measurement variants:
 *   "c_ab"  : |BC| / |AB|           – standard retracement of AB
 *   "bc_xb" : |BC| / |XB|           – Cypher: C extension relative to XB leg
 *   "xc_xa" : |XC| / |XA|           – Shark:  C extends BEYOND A (>1.0)
 *
 * D-point measurement variants:
 *   "ad_xa" : |AD| / |XA|           – standard (Gartley, Bat, Butterfly, Crab…)
 *   "cd_xc" : |CD| / |XC|           – Cypher: D retraces XC leg
 */
type CCheck =
  | { type: "c_ab";  range: [number, number] }
  | { type: "bc_xb"; range: [number, number] }
  | { type: "xc_xa"; range: [number, number] };

type DCheck =
  | { type: "ad_xa"; range: [number, number] }
  | { type: "cd_xc"; range: [number, number] };

type HarmonicDef = {
  name: string;
  b_xa:   [number, number];   // |AB| / |XA|
  c_check: CCheck;
  d_check: DCheck;
  cd_bc?: [number, number];   // optional |CD| / |BC| confluence check
};

const HARMONIC_DEFS: HarmonicDef[] = [
  // ── Classic patterns ────────────────────────────────────────────────────
  {
    name: "Gartley",
    b_xa:    [0.566, 0.670],
    c_check: { type: "c_ab",  range: [0.382, 0.886] },
    d_check: { type: "ad_xa", range: [0.726, 0.846] },
    cd_bc:   [1.13, 1.618],
  },
  {
    name: "Bat",
    b_xa:    [0.332, 0.530],
    c_check: { type: "c_ab",  range: [0.382, 0.886] },
    d_check: { type: "ad_xa", range: [0.836, 0.936] },
    cd_bc:   [1.618, 2.618],
  },
  {
    name: "Alt Bat",
    b_xa:    [0.332, 0.432],
    c_check: { type: "c_ab",  range: [0.382, 0.886] },
    d_check: { type: "ad_xa", range: [1.080, 1.180] },
    cd_bc:   [2.0,   3.618],
  },
  {
    name: "Butterfly",
    b_xa:    [0.736, 0.836],
    c_check: { type: "c_ab",  range: [0.382, 0.886] },
    d_check: { type: "ad_xa", range: [1.202, 1.342] },
    cd_bc:   [1.618, 2.24],
  },
  {
    name: "Crab",
    b_xa:    [0.332, 0.668],
    c_check: { type: "c_ab",  range: [0.382, 0.886] },
    d_check: { type: "ad_xa", range: [1.568, 1.668] },
    cd_bc:   [2.24,  3.618],
  },
  {
    name: "Deep Crab",
    b_xa:    [0.836, 0.936],
    c_check: { type: "c_ab",  range: [0.382, 0.886] },
    d_check: { type: "ad_xa", range: [1.568, 1.668] },
    cd_bc:   [2.0,   3.618],
  },
  // ── Special patterns ────────────────────────────────────────────────────
  {
    // Shark: B is inside XA; C extends BEYOND A (|XC|/XA > 1.0); D between X and A
    name: "Shark",
    b_xa:    [0.332, 0.668],
    c_check: { type: "xc_xa", range: [1.080, 1.668] },
    d_check: { type: "ad_xa", range: [0.836, 1.180] },
    cd_bc:   [1.618, 2.24],
  },
  {
    // Cypher: B inside XA; C measured vs |XB| leg; D retraces XC to 0.786
    name: "Cypher",
    b_xa:    [0.332, 0.668],
    c_check: { type: "bc_xb", range: [1.222, 1.464] },
    d_check: { type: "cd_xc", range: [0.736, 0.836] },
  },
];

type HarmonicHit = {
  name: string;
  direction: "BULLISH" | "BEARISH";
  przMin: number;
  przMax: number;
  detectedAt: number;
  points: VizPoint[];
};

function detectHarmonics(pivots: Pivot[], candles: Candle[], recency: number): HarmonicHit[] {
  const hits: HarmonicHit[] = [];
  if (pivots.length < 5) return hits;

  const recent = pivots.slice(-16);
  const candleLen = candles.length;

  for (let i = 0; i <= recent.length - 5; i++) {
    const [X, A, B, C, D] = recent.slice(i, i + 5);

    // XABCD must alternate high/low
    if (X.type === A.type || A.type === B.type || B.type === C.type || C.type === D.type) continue;

    // Bullish: X=low, A=high, B=low, C=high, D=low  → buy at D
    // Bearish: X=high, A=low, B=high, C=low, D=high → sell at D
    const bullish = X.type === "low"  && D.type === "low";
    const bearish = X.type === "high" && D.type === "high";
    if (!bullish && !bearish) continue;

    // D must be recent enough
    if (D.index < candleLen - recency) continue;

    // Core leg measurements
    const XA = Math.abs(A.price - X.price);
    const AB = Math.abs(B.price - A.price);
    const BC = Math.abs(C.price - B.price);
    const CD = Math.abs(D.price - C.price);
    const XB = Math.abs(B.price - X.price);
    const XC = Math.abs(C.price - X.price);
    const AD = Math.abs(D.price - A.price);
    if (XA < 1e-10 || AB < 1e-10 || BC < 1e-10 || CD < 1e-10) continue;

    const direction: "BULLISH" | "BEARISH" = bullish ? "BULLISH" : "BEARISH";

    for (const def of HARMONIC_DEFS) {
      // ① B/XA retracement
      if (!inRange(AB / XA, def.b_xa[0], def.b_xa[1], H_TOL_BC)) continue;

      // ② C check (varies by pattern)
      let cOk = false;
      const cc = def.c_check;
      if (cc.type === "c_ab")  cOk = inRange(BC / AB, cc.range[0], cc.range[1], H_TOL_BC);
      if (cc.type === "bc_xb") cOk = XB > 1e-10 && inRange(BC / XB, cc.range[0], cc.range[1], H_TOL_BC);
      if (cc.type === "xc_xa") cOk = inRange(XC / XA, cc.range[0], cc.range[1], H_TOL_BC);
      if (!cOk) continue;

      // ③ D check (varies by pattern)
      let dOk = false;
      const dc = def.d_check;
      if (dc.type === "ad_xa") dOk = inRange(AD / XA, dc.range[0], dc.range[1], H_TOL_D);
      if (dc.type === "cd_xc") dOk = XC > 1e-10 && inRange(CD / XC, dc.range[0], dc.range[1], H_TOL_D);
      if (!dOk) continue;

      // ④ CD/BC confluence (optional, skip if not defined)
      if (def.cd_bc) {
        if (!inRange(CD / BC, def.cd_bc[0], def.cd_bc[1], H_TOL_D)) continue;
      }

      // ── PRZ calculation ──────────────────────────────────────────────
      // Primary: D itself
      // Secondary: AB=CD confluence — project CD leg from C
      const abcd = bullish
        ? C.price - AB   // C minus AB length → projected D
        : C.price + AB;
      const przLow  = Math.min(D.price, abcd) * 0.995;
      const przHigh = Math.max(D.price, abcd) * 1.005;

      hits.push({
        name: def.name,
        direction,
        przMin: przLow,
        przMax: przHigh,
        detectedAt: D.time,
        points: [
          { time: X.time, price: X.price, label: "X" },
          { time: A.time, price: A.price, label: "A" },
          { time: B.time, price: B.price, label: "B" },
          { time: C.time, price: C.price, label: "C" },
          { time: D.time, price: D.price, label: "D" },
        ],
      });
      break; // first matching def wins
    }
  }

  // Deduplicate: keep the most-recent occurrence of each name+direction pair
  const seen = new Map<string, HarmonicHit>();
  for (const h of hits) {
    const k = `${h.name}-${h.direction}`;
    if (!seen.has(k) || h.detectedAt > seen.get(k)!.detectedAt) seen.set(k, h);
  }
  return Array.from(seen.values());
}

// ── Divergence ────────────────────────────────────────────────────────────
type DivHit = {
  direction: "BULLISH" | "BEARISH";
  strength: "STRONG" | "MEDIUM";
  detectedAt: number;
  pricePoints: VizPoint[];
  rsiPoints: VizPoint[];
};

function detectDivergence(candles: Candle[], rsi: number[]): DivHit[] {
  const hits: DivHit[] = [];
  const len = candles.length;
  if (len < 35 || rsi.length < len) return hits;

  const window = 60;
  // rsiTime: actual candle where RSI peaked/troughed (may differ from price pivot candle)
  const lows:  Array<{ i: number; price: number; r: number; time: number; rsiTime: number; vol: number }> = [];
  const highs: Array<{ i: number; price: number; r: number; time: number; rsiTime: number; vol: number }> = [];

  for (let i = Math.max(2, len - window); i < len - 2; i++) {
    const r = rsi[i];
    if (isNaN(r)) continue;
    const c = candles[i];
    const isLow =
      c.low  < candles[i-1].low  && c.low  < candles[i-2].low  &&
      c.low  < candles[i+1].low  && c.low  < candles[i+2].low;
    const isHigh =
      c.high > candles[i-1].high && c.high > candles[i-2].high &&
      c.high > candles[i+1].high && c.high > candles[i+2].high;

    if (isHigh) {
      // Find the actual RSI peak within ±3 candles of the price peak
      let rsiPeak = r, rsiPeakTime = c.time;
      for (let d = -3; d <= 3; d++) {
        const j = i + d;
        if (j < 0 || j >= len || isNaN(rsi[j])) continue;
        if (rsi[j] > rsiPeak) { rsiPeak = rsi[j]; rsiPeakTime = candles[j].time; }
      }
      highs.push({ i, price: c.high, r: rsiPeak, time: c.time, rsiTime: rsiPeakTime, vol: c.volume });
    }

    if (isLow) {
      // Find the actual RSI trough within ±3 candles of the price trough
      let rsiTrough = r, rsiTroughTime = c.time;
      for (let d = -3; d <= 3; d++) {
        const j = i + d;
        if (j < 0 || j >= len || isNaN(rsi[j])) continue;
        if (rsi[j] < rsiTrough) { rsiTrough = rsi[j]; rsiTroughTime = candles[j].time; }
      }
      lows.push({ i, price: c.low, r: rsiTrough, time: c.time, rsiTime: rsiTroughTime, vol: c.volume });
    }
  }

  // Volume cool-down check: second pivot's volume must be meaningfully lower than first's.
  // Allow up to ~15% tolerance to avoid missing slight bumps.
  const VOL_COOL_RATIO = 0.85;

  // ── BULLISH divergence ──────────────────────────────────────────────────
  // Price: lower low (L2 < L1).  RSI: higher low (R2 > R1).
  // R1 = actual RSI MINIMUM in the entire range [L1 → L2] — catches cases
  // where RSI dips deeper at a non-pivot candle between the two price lows.
  if (lows.length >= 2) {
    const last = lows[lows.length - 1];
    if (last.i >= len - 25) {
      // Scan back through recent lows to find a valid L1 (oversold anchor)
      for (let k = lows.length - 2; k >= Math.max(0, lows.length - 8); k--) {
        const prev = lows[k];
        if (prev.i >= last.i - 3) continue;           // need gap between pivots
        if (prev.r >= 30) continue;                    // L1 must be oversold (<30)
        if (last.price >= prev.price) continue;        // L2 must be a lower low

        // Find the actual RSI MINIMUM between L1 and L2 (any candle, not just pivots)
        let rsiMinVal = prev.r, rsiMinTime = prev.rsiTime;
        for (let j = prev.i; j < last.i; j++) {
          if (!isNaN(rsi[j]) && rsi[j] < rsiMinVal) {
            rsiMinVal = rsi[j]; rsiMinTime = candles[j].time;
          }
        }

        // R2 must be a "higher low" vs the true RSI minimum, and still depressed (≤45)
        if (last.r <= rsiMinVal + 2) break;            // R2 not meaningfully higher
        if (last.r > 45 || last.r <= 30) break;        // R2 out of depressed zone
        if (last.vol >= prev.vol * VOL_COOL_RATIO) break; // volume not cooled

        hits.push({
          direction: "BULLISH",
          strength: (rsiMinVal < 30 && last.r < 40 && last.vol < prev.vol * 0.8) ? "STRONG" : "MEDIUM",
          detectedAt: last.time,
          pricePoints: [
            { time: prev.time,    price: prev.price, label: "L1" },
            { time: last.time,    price: last.price, label: "L2" },
          ],
          rsiPoints: [
            { time: rsiMinTime,   price: rsiMinVal,  label: "R1" },
            { time: last.rsiTime, price: last.r,     label: "R2" },
          ],
        });
        break; // use the most recent valid L1
      }
    }
  }

  // ── BEARISH divergence ──────────────────────────────────────────────────
  // Price: higher high (H2 > H1).  RSI: lower high (R2 < R1).
  // R1 = actual RSI MAXIMUM in the entire range [H1 → H2] — captures the case
  // where RSI spikes even higher between H1 and H2 (at pivot OR non-pivot candles).
  if (highs.length >= 2) {
    const last = highs[highs.length - 1];
    if (last.i >= len - 25) {
      for (let k = highs.length - 2; k >= Math.max(0, highs.length - 8); k--) {
        const prev = highs[k];
        if (prev.i >= last.i - 3) continue;           // need gap
        if (prev.r <= 70) continue;                    // H1 must be overbought (>70)
        if (last.price <= prev.price) continue;        // H2 must be a higher high

        // Find the actual RSI MAXIMUM between H1 and H2 (any candle, not just pivots)
        let rsiMaxVal = prev.r, rsiMaxTime = prev.rsiTime;
        for (let j = prev.i; j < last.i; j++) {
          if (!isNaN(rsi[j]) && rsi[j] > rsiMaxVal) {
            rsiMaxVal = rsi[j]; rsiMaxTime = candles[j].time;
          }
        }

        // R2 must be a "lower high" vs the true RSI maximum, and still elevated (55~70)
        if (last.r >= rsiMaxVal - 2) break;            // R2 not meaningfully lower
        if (last.r < 55 || last.r >= 70) break;        // R2 out of elevated zone
        if (last.vol >= prev.vol * VOL_COOL_RATIO) break; // volume not cooled

        hits.push({
          direction: "BEARISH",
          strength: (rsiMaxVal > 70 && last.r > 60 && last.vol < prev.vol * 0.8) ? "STRONG" : "MEDIUM",
          detectedAt: last.time,
          pricePoints: [
            { time: prev.time,    price: prev.price, label: "H1" },
            { time: last.time,    price: last.price, label: "H2" },
          ],
          rsiPoints: [
            { time: rsiMaxTime,   price: rsiMaxVal,  label: "R1" },
            { time: last.rsiTime, price: last.r,     label: "R2" },
          ],
        });
        break; // use the most recent valid H1
      }
    }
  }

  return hits;
}

// ── Zone Breakout ─────────────────────────────────────────────────────────
type ZoneHit = {
  direction: "BULLISH" | "BEARISH";
  strength: "STRONG" | "MEDIUM";
  detectedAt: number;
  zoneLow: number;
  zoneHigh: number;
};

function detectZoneBreak(candles: Candle[]): ZoneHit[] {
  if (candles.length < 70) return [];

  const hist = candles.slice(-70, -20);
  if (hist.length < 20) return [];

  const sortedMid = [...hist].map((c) => (c.high + c.low) / 2).sort((a, b) => a - b);
  const p80 = sortedMid[Math.floor(sortedMid.length * 0.80)];
  const p20 = sortedMid[Math.floor(sortedMid.length * 0.20)];

  const vwap = (cs: Candle[]) => {
    const totalVol = cs.reduce((s, c) => s + c.volume, 0);
    if (totalVol < 1e-10) return (cs[0]?.high + cs[0]?.low) / 2 || 0;
    return cs.reduce((s, c) => s + (c.high + c.low) / 2 * c.volume, 0) / totalVol;
  };

  const resHist = hist.filter((c) => (c.high + c.low) / 2 >= p80);
  const supHist = hist.filter((c) => (c.high + c.low) / 2 <= p20);
  const resistance = vwap(resHist);
  const support    = vwap(supHist);
  const avgVol     = hist.reduce((s, c) => s + c.volume, 0) / hist.length;

  // Zone bands — top/bottom of the cluster of bars in each zone
  const resBand: [number, number] = resHist.length > 0
    ? [Math.min(...resHist.map((c) => c.low)), Math.max(...resHist.map((c) => c.high))]
    : [resistance * 0.995, resistance * 1.005];
  const supBand: [number, number] = supHist.length > 0
    ? [Math.min(...supHist.map((c) => c.low)), Math.max(...supHist.map((c) => c.high))]
    : [support * 0.995, support * 1.005];

  const hits: ZoneHit[] = [];
  // Exclude the last candle (still forming — close not final).
  // Also require the breakout candle's close to be meaningfully above/below
  // the zone (≥ 0.25% buffer) to filter out wicks and borderline touches.
  const recent = candles.slice(-20);
  const BREAK_BUFFER = 0.0025; // 0.25% min close distance past the zone

  for (let i = 1; i < recent.length - 1; i++) {   // ← -1: skip forming candle
    const prev = recent[i - 1].close;
    const curr = recent[i].close;
    const vol  = recent[i].volume;
    const volStrong = vol > avgVol * 1.3;

    // Bullish: closed convincingly above resistance
    if (prev < resistance && curr > resistance * (1 + BREAK_BUFFER)) {
      hits.push({
        direction: "BULLISH",
        strength: volStrong ? "STRONG" : "MEDIUM",
        detectedAt: recent[i].time,
        zoneLow: resBand[0], zoneHigh: resBand[1],
      });
    }
    // Bearish: closed convincingly below support
    if (prev > support && curr < support * (1 - BREAK_BUFFER)) {
      hits.push({
        direction: "BEARISH",
        strength: volStrong ? "STRONG" : "MEDIUM",
        detectedAt: recent[i].time,
        zoneLow: supBand[0], zoneHigh: supBand[1],
      });
    }
  }

  // Keep the most recent of each direction
  const result: ZoneHit[] = [];
  const dirs = new Set<string>();
  for (const h of [...hits].reverse()) {
    if (!dirs.has(h.direction)) {
      dirs.add(h.direction);
      result.push(h);
    }
  }
  return result;
}

// ── Description builders ──────────────────────────────────────────────────
function buildDesc(
  base: string,
  tf: TF,
  type: CryptoSignal["type"],
  dir: CryptoSignal["direction"],
  pat?: string,
): { ko: string; en: string } {
  const tf_ko  = tf === "15m" ? "15분봉" : tf === "1h" ? "1시간봉" : "4시간봉";
  const dir_ko = dir === "BULLISH" ? "상승" : "하락";
  if (type === "HARMONIC") return {
    ko: `${base} ${tf_ko} — ${dir_ko} ${pat} 하모닉 패턴. PRZ 구간 반전 주시`,
    en: `${base} ${tf} — ${dir} ${pat} harmonic pattern. Watch PRZ for reversal`,
  };
  if (type === "DIVERGENCE") return {
    ko: `${base} ${tf_ko} — RSI ${dir_ko} 다이버전스. 추세 전환 가능성`,
    en: `${base} ${tf} — RSI ${dir} divergence. Potential trend reversal`,
  };
  const zone_ko = dir === "BULLISH" ? "저항대" : "지지대";
  return {
    ko: `${base} ${tf_ko} — ${zone_ko} 돌파. ${dir_ko} 모멘텀 확인`,
    en: `${base} ${tf} — ${dir === "BULLISH" ? "Resistance" : "Support"} zone breakout. ${dir} momentum`,
  };
}

// ── Process cell ──────────────────────────────────────────────────────────
async function processCell(symbol: string, tf: TF): Promise<CryptoSignal[]> {
  const candles = await fetchCandles(symbol, tf, 200);
  if (candles.length < 60) return [];

  const base    = symbol.replace("USDT", "");
  const closes  = candles.map((c) => c.close);
  const price   = closes[closes.length - 1];
  const rsi     = calcRSI(closes);
  const pivots  = findPivots(candles, PIVOT_N[tf]);
  const recency = RECENCY[tf];
  const out: CryptoSignal[] = [];

  // Last ~120 candles for chart rendering
  const vizCandles = candles.slice(-120);
  const rsiSeries = candles.map((c, i) => ({ time: c.time, value: rsi[i] })).filter((p) => !isNaN(p.value)).slice(-120);

  for (const d of detectDivergence(candles, rsi)) {
    const { ko, en } = buildDesc(base, tf, "DIVERGENCE", d.direction);
    out.push({
      id: `${symbol}-${tf}-div-${d.direction}`,
      symbol, base, timeframe: tf,
      type: "DIVERGENCE", direction: d.direction,
      currentPrice: price, strength: d.strength,
      descriptionKo: ko, descriptionEn: en, detectedAt: d.detectedAt,
      candles: vizCandles,
      viz: { kind: "DIVERGENCE", pricePoints: d.pricePoints, rsiPoints: d.rsiPoints, rsi: rsiSeries },
    });
  }

  for (const h of detectHarmonics(pivots, candles, recency)) {
    const { ko, en } = buildDesc(base, tf, "HARMONIC", h.direction, h.name);
    out.push({
      id: `${symbol}-${tf}-har-${h.name}-${h.direction}`,
      symbol, base, timeframe: tf,
      type: "HARMONIC", direction: h.direction, patternName: h.name,
      currentPrice: price, przMin: h.przMin, przMax: h.przMax,
      strength: "MEDIUM",
      descriptionKo: ko, descriptionEn: en, detectedAt: h.detectedAt,
      candles: vizCandles,
      viz: { kind: "HARMONIC", points: h.points, przMin: h.przMin, przMax: h.przMax },
    });
  }

  for (const z of detectZoneBreak(candles)) {
    const { ko, en } = buildDesc(base, tf, "ZONE_BREAK", z.direction);
    out.push({
      id: `${symbol}-${tf}-zone-${z.direction}`,
      symbol, base, timeframe: tf,
      type: "ZONE_BREAK", direction: z.direction,
      currentPrice: price, strength: z.strength,
      descriptionKo: ko, descriptionEn: en, detectedAt: z.detectedAt,
      candles: vizCandles,
      viz: {
        kind: "ZONE_BREAK",
        zoneLow: z.zoneLow,
        zoneHigh: z.zoneHigh,
        breakoutTime: z.detectedAt,
        // Zone historical window was candles.slice(-70, -20); box spans from there to last candle
        zoneStartTime: candles[Math.max(0, candles.length - 70)].time,
        zoneEndTime:   candles[candles.length - 1].time,
      },
    });
  }

  return out;
}

// ── Public API: scan all symbols × TFs ────────────────────────────────────
export async function scanAllCryptoSignals(
  symbols: string[] = CRYPTO_SYMBOLS,
  tfs: TF[] = CRYPTO_TFS,
): Promise<CryptoSignal[]> {
  const tasks  = symbols.flatMap((sym) => tfs.map((tf) => processCell(sym, tf)));
  const nested = await Promise.all(tasks);
  const signals = nested.flat();

  const typeScore = { HARMONIC: 2, DIVERGENCE: 1, ZONE_BREAK: 0 };
  signals.sort((a, b) => {
    if (a.strength !== b.strength) return a.strength === "STRONG" ? -1 : 1;
    if (b.detectedAt !== a.detectedAt) return b.detectedAt - a.detectedAt;
    return typeScore[b.type] - typeScore[a.type];
  });

  return signals;
}

// ── Utility: format "X분 전" / "X min ago" ────────────────────────────────
export function formatRelativeTime(ts: number, lang: "ko" | "en"): string {
  const diffMs = Date.now() - ts;
  const mins   = Math.round(diffMs / 60_000);
  if (mins < 1)       return lang === "ko" ? "방금" : "just now";
  if (mins < 60)      return lang === "ko" ? `${mins}분 전` : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs  < 24)      return lang === "ko" ? `${hrs}시간 전` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return lang === "ko" ? `${days}일 전` : `${days}d ago`;
}
