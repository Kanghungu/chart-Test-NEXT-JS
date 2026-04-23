import { NextResponse } from "next/server";

export const revalidate = 60;

// ── Types ──────────────────────────────────────────────────────────────────
export type TF = "15m" | "1h" | "4h";

type Candle = {
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
  detectedAt: number; // actual candle timestamp
  /** 다이버전스 형성 중 등 */
  isPrediction?: boolean;
};

export type CryptoSignalsResponse = {
  signals: CryptoSignal[];
  fetchedAt: string;
};

// ── Config ─────────────────────────────────────────────────────────────────
const SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT", "ADAUSDT", "DOGEUSDT",
  "VIRTUALUSDT", "TAOUSDT", "WLDUSDT", "MAGICUSDT", "LTCUSDT", "ENAUSDT", "TURBOUSDT",
];
const TIMEFRAMES: TF[] = ["15m", "1h", "4h"];
const PIVOT_N: Record<TF, number> = { "15m": 3, "1h": 4, "4h": 5 };
const RECENCY: Record<TF, number> = { "15m": 30, "1h": 20, "4h": 14 };
const OHLCV_LIMIT: Record<TF, number> = { "15m": 500, "1h": 220, "4h": 220 };
const HARMONIC_PIVOT_TAIL: Record<TF, number> = { "15m": 26, "1h": 14, "4h": 14 };

// Exchange interval codes
const BYBIT_IV: Record<TF, string> = { "15m": "15", "1h": "60", "4h": "240" };
const OKX_IV:   Record<TF, string> = { "15m": "15m", "1h": "1H", "4h": "4H" };

// ── OHLCV Fetch: OKX → Bybit → Binance fallback chain ─────────────────────
async function fetchCandles(symbol: string, tf: TF, limit = 200): Promise<Candle[]> {
  const base = symbol.replace("USDT", "");

  // 1) OKX
  try {
    const url = `https://www.okx.com/api/v5/market/candles?instId=${base}-USDT&bar=${OKX_IV[tf]}&limit=${limit}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json();
      if (data.code === "0" && Array.isArray(data.data) && data.data.length > 0) {
        return (data.data as string[][]).slice().reverse().map((d) => ({
          time: parseInt(d[0]), open: parseFloat(d[1]), high: parseFloat(d[2]),
          low:  parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]),
        }));
      }
    }
    console.error(`[crypto] OKX ${symbol} ${tf} status=${res.status}`);
  } catch (e) { console.error(`[crypto] OKX ${symbol} ${tf} err:`, String(e)); }

  // 2) Bybit
  try {
    const url = `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${BYBIT_IV[tf]}&limit=${limit}`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      const list: string[][] = data?.result?.list;
      if (Array.isArray(list) && list.length > 0) {
        return list.slice().reverse().map((d) => ({
          time: parseInt(d[0]), open: parseFloat(d[1]), high: parseFloat(d[2]),
          low:  parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]),
        }));
      }
    }
    console.error(`[crypto] Bybit ${symbol} ${tf} status=${res.status}`);
  } catch (e) { console.error(`[crypto] Bybit ${symbol} ${tf} err:`, String(e)); }

  // 3) Binance backup endpoints
  for (const host of ["https://api1.binance.com", "https://api2.binance.com"]) {
    try {
      const url = `${host}/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=${limit}`;
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const raw: unknown[][] = await res.json();
        return raw.map((d) => ({
          time: d[0] as number, open: parseFloat(d[1] as string), high: parseFloat(d[2] as string),
          low:  parseFloat(d[3] as string), close: parseFloat(d[4] as string), volume: parseFloat(d[5] as string),
        }));
      }
    } catch { /* try next */ }
  }

  console.error(`[crypto] ALL sources failed for ${symbol} ${tf}`);
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

// ── Pivot Points ───────────────────────────────────────────────────────────
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
    else if (isL) pivots.push({ type: "low", price: candles[i].low, index: i, time: candles[i].time });
  }
  return pivots;
}

// ── Fibonacci helpers ──────────────────────────────────────────────────────
function inRange(v: number, lo: number, hi: number, tol = 0.08): boolean {
  return v >= lo - tol && v <= hi + tol;
}

// ── Harmonic Pattern Definitions ───────────────────────────────────────────
const HARMONIC_DEFS: Array<{ name: string; ab_xa: [number, number]; xd_xa: [number, number] }> = [
  { name: "Bat",       ab_xa: [0.28, 0.55], xd_xa: [0.80, 0.96] },
  { name: "Gartley",   ab_xa: [0.54, 0.68], xd_xa: [0.72, 0.84] },
  { name: "Butterfly", ab_xa: [0.70, 0.86], xd_xa: [1.15, 1.75] },
  { name: "Crab",      ab_xa: [0.28, 0.66], xd_xa: [1.54, 1.75] },
  { name: "Deep Crab", ab_xa: [0.80, 0.95], xd_xa: [1.54, 1.75] },
  { name: "Shark",     ab_xa: [1.00, 1.80], xd_xa: [0.80, 1.20] },
  { name: "Cypher",    ab_xa: [0.33, 0.65], xd_xa: [0.72, 0.84] },
];

type HarmonicHit = {
  name: string;
  direction: "BULLISH" | "BEARISH";
  przMin: number;
  przMax: number;
  detectedAt: number;
};

/**
 * Detects harmonic patterns among recent pivots.
 * Key change from v1: we no longer require current price to be near D.
 * Instead, D just needs to have formed within RECENCY[tf] candles.
 */
function detectHarmonics(
  pivots: Pivot[],
  candles: Candle[],
  recency: number,
  pivotTail: number,
): HarmonicHit[] {
  const hits: HarmonicHit[] = [];
  if (pivots.length < 5) return hits;

  const tail = Math.max(5, Math.min(pivotTail, pivots.length));
  const recent = pivots.slice(-tail);
  const candleLen = candles.length;

  for (let i = 0; i <= recent.length - 5; i++) {
    const [X, A, B, C, D] = recent.slice(i, i + 5);

    // Alternation must be strict
    if (X.type === A.type || A.type === B.type || B.type === C.type || C.type === D.type) continue;

    const bullish = X.type === "low"  && D.type === "low";
    const bearish = X.type === "high" && D.type === "high";
    if (!bullish && !bearish) continue;

    // D must have formed within the recency window
    if (D.index < candleLen - recency) continue;

    const XA = Math.abs(A.price - X.price);
    const AB = Math.abs(B.price - A.price);
    if (XA < 1e-10 || AB < 1e-10) continue;

    const ab_xa = AB / XA;
    const xd_xa = Math.abs(D.price - X.price) / XA;
    const spread = D.price * 0.02;
    const direction: "BULLISH" | "BEARISH" = bullish ? "BULLISH" : "BEARISH";

    for (const def of HARMONIC_DEFS) {
      if (inRange(ab_xa, def.ab_xa[0], def.ab_xa[1]) &&
          inRange(xd_xa, def.xd_xa[0], def.xd_xa[1])) {
        hits.push({
          name: def.name,
          direction,
          przMin: D.price - spread,
          przMax: D.price + spread,
          detectedAt: D.time,
        });
        break;
      }
    }
  }

  // Deduplicate by name+direction
  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = `${h.name}-${h.direction}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── RSI Divergence ─────────────────────────────────────────────────────────
type DivHit = {
  direction: "BULLISH" | "BEARISH";
  strength: "STRONG" | "MEDIUM";
  detectedAt: number;
};

/**
 * Key changes from v1:
 * - Scan last 60 candles (was 40)
 * - Signal valid if extreme occurred in last 25 candles (was 12)
 * - RSI delta threshold lowered to 0.8 (was 1.5)
 */
function detectDivergence(candles: Candle[], rsi: number[]): DivHit[] {
  const hits: DivHit[] = [];
  const len = candles.length;
  if (len < 35 || rsi.length < len) return hits;

  const window = 60;
  const lows:  Array<{ i: number; price: number; r: number; time: number }> = [];
  const highs: Array<{ i: number; price: number; r: number; time: number }> = [];

  for (let i = Math.max(2, len - window); i < len - 2; i++) {
    const r = rsi[i];
    if (isNaN(r)) continue;
    const c = candles[i];
    const isLow  = c.low  < candles[i-1].low  && c.low  < candles[i-2].low  && c.low  < candles[i+1].low  && c.low  < candles[i+2].low;
    const isHigh = c.high > candles[i-1].high && c.high > candles[i-2].high && c.high > candles[i+1].high && c.high > candles[i+2].high;
    if (isLow)  lows.push({ i, price: c.low,  r, time: c.time });
    if (isHigh) highs.push({ i, price: c.high, r, time: c.time });
  }

  // Bullish: lower low in price, higher low in RSI — last extreme within 25 candles
  if (lows.length >= 2) {
    const last = lows[lows.length - 1];
    const prev = lows[lows.length - 2];
    if (last.i >= len - 25 && last.price < prev.price && last.r > prev.r + 0.8) {
      hits.push({
        direction: "BULLISH",
        strength: last.r < 38 ? "STRONG" : "MEDIUM",
        detectedAt: last.time,
      });
    }
  }

  // Bearish: higher high in price, lower high in RSI — last extreme within 25 candles
  if (highs.length >= 2) {
    const last = highs[highs.length - 1];
    const prev = highs[highs.length - 2];
    if (last.i >= len - 25 && last.price > prev.price && last.r < prev.r - 0.8) {
      hits.push({
        direction: "BEARISH",
        strength: last.r > 62 ? "STRONG" : "MEDIUM",
        detectedAt: last.time,
      });
    }
  }

  return hits;
}

/** 클라이언트 스캐너와 동일: 확정 다이버전스 없을 때만 형성 중 후보 */
function detectDivergencePrediction(
  candles: Candle[],
  rsi: number[],
  confirmedDirections: ReadonlySet<"BULLISH" | "BEARISH">,
): DivHit[] {
  const hits: DivHit[] = [];
  const len = candles.length;
  if (len < 35 || rsi.length < len) return hits;

  const window = 60;
  const lows:  Array<{ i: number; price: number; r: number; time: number }> = [];
  const highs: Array<{ i: number; price: number; r: number; time: number }> = [];

  for (let i = Math.max(2, len - window); i < len - 2; i++) {
    const r = rsi[i];
    if (isNaN(r)) continue;
    const c = candles[i];
    const isLow  = c.low  < candles[i-1].low  && c.low  < candles[i-2].low  && c.low  < candles[i+1].low  && c.low  < candles[i+2].low;
    const isHigh = c.high > candles[i-1].high && c.high > candles[i-2].high && c.high > candles[i+1].high && c.high > candles[i+2].high;
    if (isLow)  lows.push({ i, price: c.low,  r, time: c.time });
    if (isHigh) highs.push({ i, price: c.high, r, time: c.time });
  }

  if (!confirmedDirections.has("BULLISH") && lows.length >= 2) {
    const last = lows[lows.length - 1];
    const prev = lows[lows.length - 2];
    if (
      last.i >= len - 30 &&
      last.price < prev.price &&
      prev.r < 34 &&
      last.r < prev.r + 0.75 &&
      last.r > prev.r - 0.35
    ) {
      hits.push({ direction: "BULLISH", strength: "MEDIUM", detectedAt: last.time });
    }
  }

  if (!confirmedDirections.has("BEARISH") && highs.length >= 2) {
    const last = highs[highs.length - 1];
    const prev = highs[highs.length - 2];
    if (
      last.i >= len - 30 &&
      last.price > prev.price &&
      prev.r > 66 &&
      last.r > prev.r - 0.75 &&
      last.r < prev.r + 0.35
    ) {
      hits.push({ direction: "BEARISH", strength: "MEDIUM", detectedAt: last.time });
    }
  }

  return hits;
}

// ── Volume Zone Breakout ───────────────────────────────────────────────────
type ZoneHit = {
  direction: "BULLISH" | "BEARISH";
  strength: "STRONG" | "MEDIUM";
  detectedAt: number;
};

/**
 * Key changes from v1:
 * - Scan last 20 candles for break events (was 1)
 * - Volume threshold lowered to 1.3x (was 1.8x)
 */
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

  const resistance = vwap(hist.filter((c) => (c.high + c.low) / 2 >= p80));
  const support    = vwap(hist.filter((c) => (c.high + c.low) / 2 <= p20));
  const avgVol     = hist.reduce((s, c) => s + c.volume, 0) / hist.length;

  const hits: ZoneHit[] = [];
  const recent = candles.slice(-20);
  const BREAK_BUFFER = 0.0025;

  for (let i = 1; i < recent.length - 1; i++) {
    const prev = recent[i - 1].close;
    const curr = recent[i].close;
    const vol  = recent[i].volume;
    const volStrong = vol > avgVol * 1.3;

    if (prev < resistance && curr > resistance * (1 + BREAK_BUFFER)) {
      hits.push({ direction: "BULLISH", strength: volStrong ? "STRONG" : "MEDIUM", detectedAt: recent[i].time });
    }
    if (prev > support && curr < support * (1 - BREAK_BUFFER)) {
      hits.push({ direction: "BEARISH", strength: volStrong ? "STRONG" : "MEDIUM", detectedAt: recent[i].time });
    }
  }

  // Return the most recent of each direction (deduplicate)
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

// ── Description builders ───────────────────────────────────────────────────
function buildDesc(
  base: string, tf: TF,
  type: CryptoSignal["type"],
  dir: CryptoSignal["direction"],
  pat?: string,
  isPrediction?: boolean,
): { ko: string; en: string } {
  const tf_ko  = tf === "15m" ? "15분봉" : tf === "1h" ? "1시간봉" : "4시간봉";
  const dir_ko = dir === "BULLISH" ? "상승" : "하락";
  if (type === "HARMONIC") return {
    ko: `${base} ${tf_ko} — ${dir_ko} ${pat} 하모닉 패턴. PRZ 구간 반전 주시`,
    en: `${base} ${tf} — ${dir} ${pat} harmonic pattern. Watch PRZ for reversal`,
  };
  if (type === "DIVERGENCE") {
    if (isPrediction) {
      return {
        ko: `${base} ${tf_ko} — RSI ${dir_ko} 다이버전스 (예측·형성 중). 확정 전 신호`,
        en: `${base} ${tf} — RSI ${dir} divergence (forming). Not yet confirmed`,
      };
    }
    return {
      ko: `${base} ${tf_ko} — RSI ${dir_ko} 다이버전스. 추세 전환 가능성`,
      en: `${base} ${tf} — RSI ${dir} divergence. Potential trend reversal`,
    };
  }
  const zone_ko = dir === "BULLISH" ? "저항대" : "지지대";
  return {
    ko: `${base} ${tf_ko} — ${zone_ko} 돌파. ${dir_ko} 모멘텀 확인`,
    en: `${base} ${tf} — ${dir === "BULLISH" ? "Resistance" : "Support"} zone breakout. ${dir} momentum`,
  };
}

// ── Per-cell processor ─────────────────────────────────────────────────────
async function processCell(symbol: string, tf: TF): Promise<CryptoSignal[]> {
  const limit = OHLCV_LIMIT[tf];
  const candles = await fetchCandles(symbol, tf, limit);
  if (candles.length < 60) return [];

  const base    = symbol.replace("USDT", "");
  const closes  = candles.map((c) => c.close);
  const price   = closes[closes.length - 1];
  const rsi     = calcRSI(closes);
  const pivots  = findPivots(candles, PIVOT_N[tf]);
  const recency = RECENCY[tf];
  const pivotTail = HARMONIC_PIVOT_TAIL[tf];
  const out: CryptoSignal[] = [];

  const confirmedDivs = detectDivergence(candles, rsi);
  const confirmedDir = new Set(confirmedDivs.map((d) => d.direction));

  for (const d of confirmedDivs) {
    const { ko, en } = buildDesc(base, tf, "DIVERGENCE", d.direction, undefined, false);
    out.push({
      id: `${symbol}-${tf}-div-${d.direction}`,
      symbol, base, timeframe: tf,
      type: "DIVERGENCE", direction: d.direction,
      currentPrice: price,
      strength: d.strength,
      isPrediction: false,
      descriptionKo: ko, descriptionEn: en,
      detectedAt: d.detectedAt,
    });
  }

  for (const d of detectDivergencePrediction(candles, rsi, confirmedDir)) {
    const { ko, en } = buildDesc(base, tf, "DIVERGENCE", d.direction, undefined, true);
    out.push({
      id: `${symbol}-${tf}-div-pred-${d.direction}`,
      symbol, base, timeframe: tf,
      type: "DIVERGENCE", direction: d.direction,
      currentPrice: price,
      strength: "MEDIUM",
      isPrediction: true,
      descriptionKo: ko, descriptionEn: en,
      detectedAt: d.detectedAt,
    });
  }

  for (const h of detectHarmonics(pivots, candles, recency, pivotTail)) {
    const { ko, en } = buildDesc(base, tf, "HARMONIC", h.direction, h.name);
    out.push({
      id: `${symbol}-${tf}-har-${h.name}-${h.direction}`,
      symbol, base, timeframe: tf,
      type: "HARMONIC", direction: h.direction, patternName: h.name,
      currentPrice: price,
      przMin: h.przMin, przMax: h.przMax,
      strength: "MEDIUM",
      isPrediction: false,
      descriptionKo: ko, descriptionEn: en,
      detectedAt: h.detectedAt,
    });
  }

  for (const z of detectZoneBreak(candles)) {
    const { ko, en } = buildDesc(base, tf, "ZONE_BREAK", z.direction);
    out.push({
      id: `${symbol}-${tf}-zone-${z.direction}`,
      symbol, base, timeframe: tf,
      type: "ZONE_BREAK", direction: z.direction,
      currentPrice: price,
      strength: z.strength,
      isPrediction: false,
      descriptionKo: ko, descriptionEn: en,
      detectedAt: z.detectedAt,
    });
  }

  return out;
}

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const tasks  = SYMBOLS.flatMap((sym) => TIMEFRAMES.map((tf) => processCell(sym, tf)));
    const nested = await Promise.all(tasks);
    const signals = nested.flat();

    // Sort: STRONG first → by detectedAt desc (most recent first) → HARMONIC > DIVERGENCE > ZONE
    const typeScore = { HARMONIC: 2, DIVERGENCE: 1, ZONE_BREAK: 0 };
    signals.sort((a, b) => {
      const predA = a.isPrediction ? 1 : 0;
      const predB = b.isPrediction ? 1 : 0;
      if (predA !== predB) return predA - predB;
      if (a.strength !== b.strength) return a.strength === "STRONG" ? -1 : 1;
      if (b.detectedAt !== a.detectedAt) return b.detectedAt - a.detectedAt;
      return typeScore[b.type] - typeScore[a.type];
    });

    return NextResponse.json({ signals, fetchedAt: new Date().toISOString() } satisfies CryptoSignalsResponse);
  } catch {
    return NextResponse.json({ signals: [], fetchedAt: new Date().toISOString() } satisfies CryptoSignalsResponse);
  }
}
