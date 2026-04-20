import { NextResponse } from "next/server";

export const revalidate = 60; // 1분 캐시

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
};

export type CryptoSignal = {
  id: string;
  symbol: string;       // "BTCUSDT"
  base: string;         // "BTC"
  timeframe: TF;
  type: "HARMONIC" | "DIVERGENCE" | "ZONE_BREAK";
  direction: "BULLISH" | "BEARISH";
  patternName?: string; // Bat / Gartley / Butterfly / Crab / Shark / Cypher
  currentPrice: number;
  przMin?: number;
  przMax?: number;
  strength: "STRONG" | "MEDIUM";
  descriptionKo: string;
  descriptionEn: string;
  detectedAt: number;
};

export type CryptoSignalsResponse = {
  signals: CryptoSignal[];
  fetchedAt: string;
};

// ── Config ─────────────────────────────────────────────────────────────────
const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT", "ADAUSDT", "DOGEUSDT"];
const TIMEFRAMES: TF[] = ["15m", "1h", "4h"];
const PIVOT_N: Record<TF, number> = { "15m": 3, "1h": 5, "4h": 7 };

// ── Binance OHLCV Fetch ────────────────────────────────────────────────────
async function fetchCandles(symbol: string, interval: string, limit = 200): Promise<Candle[]> {
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const raw: unknown[][] = await res.json();
    return raw.map((d) => ({
      time:   d[0] as number,
      open:   parseFloat(d[1] as string),
      high:   parseFloat(d[2] as string),
      low:    parseFloat(d[3] as string),
      close:  parseFloat(d[4] as string),
      volume: parseFloat(d[5] as string),
    }));
  } catch {
    return [];
  }
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

// ── Pivot Points (ZigZag) ──────────────────────────────────────────────────
function findPivots(candles: Candle[], n: number): Pivot[] {
  const pivots: Pivot[] = [];
  for (let i = n; i < candles.length - n; i++) {
    let isH = true, isL = true;
    for (let j = i - n; j <= i + n; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isH = false;
      if (candles[j].low  <= candles[i].low)  isL = false;
    }
    if (isH) pivots.push({ type: "high", price: candles[i].high, index: i });
    else if (isL) pivots.push({ type: "low",  price: candles[i].low,  index: i });
  }
  return pivots;
}

// ── Fibonacci helpers ──────────────────────────────────────────────────────
function inRange(v: number, lo: number, hi: number, tol = 0.06): boolean {
  return v >= lo - tol && v <= hi + tol;
}

// ── Harmonic Pattern Definitions ───────────────────────────────────────────
// Each pattern defined by AB/XA ratio range and XD/XA ratio range
const HARMONIC_DEFS: Array<{
  name: string;
  ab_xa: [number, number];
  xd_xa: [number, number];
}> = [
  { name: "Bat",       ab_xa: [0.30, 0.55], xd_xa: [0.82, 0.95] },  // B@.382-.5, D@.886 of XA
  { name: "Gartley",   ab_xa: [0.55, 0.68], xd_xa: [0.73, 0.84] },  // B@.618, D@.786 of XA
  { name: "Butterfly", ab_xa: [0.72, 0.84], xd_xa: [1.17, 1.72] },  // B@.786, D@1.27-1.618 of XA
  { name: "Crab",      ab_xa: [0.30, 0.65], xd_xa: [1.55, 1.72] },  // B@.382-.618, D@1.618 of XA
  { name: "Deep Crab", ab_xa: [0.82, 0.93], xd_xa: [1.55, 1.72] },  // B@.886, D@1.618 of XA
  { name: "Shark",     ab_xa: [1.05, 1.72], xd_xa: [0.82, 1.18] },  // B beyond A (extension)
  { name: "Cypher",    ab_xa: [0.35, 0.62], xd_xa: [0.73, 0.84] },  // B@.382-.618, D@.786 of XC
];

type HarmonicHit = {
  name: string;
  direction: "BULLISH" | "BEARISH";
  przMin: number;
  przMax: number;
};

function detectHarmonics(pivots: Pivot[], currentPrice: number): HarmonicHit[] {
  const hits: HarmonicHit[] = [];
  if (pivots.length < 5) return hits;

  const recent = pivots.slice(-10);

  for (let i = 0; i <= recent.length - 5; i++) {
    const [X, A, B, C, D] = recent.slice(i, i + 5);

    // Strict alternation check
    if (X.type === A.type || A.type === B.type || B.type === C.type || C.type === D.type) continue;

    const bullish = X.type === "low"  && D.type === "low";
    const bearish = X.type === "high" && D.type === "high";
    if (!bullish && !bearish) continue;

    // D must be a recent pivot (last 3)
    const lastPivotIdx = pivots[pivots.length - 1].index;
    const thirdLastIdx = pivots[Math.max(0, pivots.length - 3)].index;
    if (D.index < thirdLastIdx) continue;

    // Price must be within 2.5% of D
    if (Math.abs(currentPrice - D.price) / D.price > 0.025) continue;

    const XA = Math.abs(A.price - X.price);
    const AB = Math.abs(B.price - A.price);
    if (XA < 1e-10 || AB < 1e-10) continue;

    const ab_xa = AB / XA;
    const xd_xa = Math.abs(D.price - X.price) / XA;

    const spread = D.price * 0.018;
    const direction: "BULLISH" | "BEARISH" = bullish ? "BULLISH" : "BEARISH";

    for (const def of HARMONIC_DEFS) {
      if (inRange(ab_xa, def.ab_xa[0], def.ab_xa[1]) &&
          inRange(xd_xa, def.xd_xa[0], def.xd_xa[1])) {
        hits.push({
          name: def.name,
          direction,
          przMin: D.price - spread,
          przMax: D.price + spread,
        });
        break; // one pattern per XABCD set
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
type DivHit = { direction: "BULLISH" | "BEARISH"; strength: "STRONG" | "MEDIUM" };

function detectDivergence(candles: Candle[], rsi: number[]): DivHit[] {
  const hits: DivHit[] = [];
  const len = candles.length;
  if (len < 35 || rsi.length < len) return hits;

  const window = 40;
  const lows:  Array<{ i: number; price: number; r: number }> = [];
  const highs: Array<{ i: number; price: number; r: number }> = [];

  for (let i = len - window; i < len - 2; i++) {
    const r = rsi[i];
    if (isNaN(r) || i < 2) continue;
    const c = candles[i];
    const isLocalLow  = c.low  < candles[i-1].low  && c.low  < candles[i-2].low  && c.low  < candles[i+1].low  && c.low  < candles[i+2].low;
    const isLocalHigh = c.high > candles[i-1].high && c.high > candles[i-2].high && c.high > candles[i+1].high && c.high > candles[i+2].high;
    if (isLocalLow)  lows.push({ i, price: c.low,  r });
    if (isLocalHigh) highs.push({ i, price: c.high, r });
  }

  // Bullish divergence: lower low in price, higher low in RSI, recent
  if (lows.length >= 2) {
    const last = lows[lows.length - 1];
    const prev = lows[lows.length - 2];
    if (last.i >= len - 12 && last.price < prev.price && last.r > prev.r + 1.5) {
      hits.push({ direction: "BULLISH", strength: last.r < 35 ? "STRONG" : "MEDIUM" });
    }
  }

  // Bearish divergence: higher high in price, lower high in RSI, recent
  if (highs.length >= 2) {
    const last = highs[highs.length - 1];
    const prev = highs[highs.length - 2];
    if (last.i >= len - 12 && last.price > prev.price && last.r < prev.r - 1.5) {
      hits.push({ direction: "BEARISH", strength: last.r > 65 ? "STRONG" : "MEDIUM" });
    }
  }

  return hits;
}

// ── Volume Zone (Supply / Demand) Breakout ─────────────────────────────────
function detectZoneBreak(candles: Candle[]): {
  direction: "BULLISH" | "BEARISH";
  strength: "STRONG" | "MEDIUM";
} | null {
  if (candles.length < 70) return null;

  const hist = candles.slice(-70, -4);
  const recent = candles.slice(-4);

  if (hist.length < 20) return null;

  // Volume-weighted resistance & support via price percentile buckets
  const prices = hist.map((c) => (c.high + c.low) / 2).sort((a, b) => a - b);
  const p80 = prices[Math.floor(prices.length * 0.80)];
  const p20 = prices[Math.floor(prices.length * 0.20)];

  const topCandles = hist.filter((c) => (c.high + c.low) / 2 >= p80);
  const botCandles = hist.filter((c) => (c.high + c.low) / 2 <= p20);

  const vwap = (cs: Candle[]) =>
    cs.reduce((s, c) => s + (c.high + c.low) / 2 * c.volume, 0) /
    Math.max(1e-10, cs.reduce((s, c) => s + c.volume, 0));

  const resistance = vwap(topCandles);
  const support    = vwap(botCandles);

  const avgVol  = hist.reduce((s, c) => s + c.volume, 0) / hist.length;
  const prevClose = candles[candles.length - 5].close;
  const currClose = recent[recent.length - 1].close;
  const currVol   = recent[recent.length - 1].volume;
  const volStrong = currVol > avgVol * 1.8;

  // Breakout above resistance zone
  if (prevClose < resistance && currClose > resistance) {
    return { direction: "BULLISH", strength: volStrong ? "STRONG" : "MEDIUM" };
  }
  // Breakdown below support zone
  if (prevClose > support && currClose < support) {
    return { direction: "BEARISH", strength: volStrong ? "STRONG" : "MEDIUM" };
  }
  return null;
}

// ── Description builders ───────────────────────────────────────────────────
function buildDesc(
  base: string, tf: TF,
  type: CryptoSignal["type"],
  dir: CryptoSignal["direction"],
  pat?: string,
): { ko: string; en: string } {
  const tf_ko = tf === "15m" ? "15분봉" : tf === "1h" ? "1시간봉" : "4시간봉";
  const dir_ko = dir === "BULLISH" ? "상승" : "하락";

  if (type === "HARMONIC") return {
    ko: `${base} ${tf_ko} — ${dir_ko} ${pat} 하모닉 패턴. PRZ 구간 도달 시 반전 주시`,
    en: `${base} ${tf} — ${dir} ${pat} harmonic. Watch PRZ for reversal`,
  };
  if (type === "DIVERGENCE") return {
    ko: `${base} ${tf_ko} — RSI ${dir_ko} 다이버전스. 추세 전환 가능성`,
    en: `${base} ${tf} — RSI ${dir} divergence. Potential trend reversal`,
  };
  const zone_ko = dir === "BULLISH" ? "저항대" : "지지대";
  return {
    ko: `${base} ${tf_ko} — ${zone_ko} 돌파. ${dir_ko} 모멘텀 확인`,
    en: `${base} ${tf} — ${dir === "BULLISH" ? "Resistance" : "Support"} zone break. ${dir} momentum`,
  };
}

// ── Per-symbol-timeframe processor ────────────────────────────────────────
async function processCell(symbol: string, tf: TF): Promise<CryptoSignal[]> {
  const candles = await fetchCandles(symbol, tf, 200);
  if (candles.length < 60) return [];

  const base   = symbol.replace("USDT", "");
  const closes = candles.map((c) => c.close);
  const price  = closes[closes.length - 1];
  const rsi    = calcRSI(closes);
  const pivots = findPivots(candles, PIVOT_N[tf]);
  const now    = Date.now();
  const out: CryptoSignal[] = [];

  // Divergence
  for (const d of detectDivergence(candles, rsi)) {
    const { ko, en } = buildDesc(base, tf, "DIVERGENCE", d.direction);
    out.push({
      id: `${symbol}-${tf}-div-${d.direction}`,
      symbol, base, timeframe: tf,
      type: "DIVERGENCE", direction: d.direction,
      currentPrice: price, strength: d.strength,
      descriptionKo: ko, descriptionEn: en, detectedAt: now,
    });
  }

  // Harmonic
  for (const h of detectHarmonics(pivots, price)) {
    const { ko, en } = buildDesc(base, tf, "HARMONIC", h.direction, h.name);
    out.push({
      id: `${symbol}-${tf}-har-${h.name}-${h.direction}`,
      symbol, base, timeframe: tf,
      type: "HARMONIC", direction: h.direction, patternName: h.name,
      currentPrice: price, przMin: h.przMin, przMax: h.przMax,
      strength: "MEDIUM",
      descriptionKo: ko, descriptionEn: en, detectedAt: now,
    });
  }

  // Zone breakout
  const zb = detectZoneBreak(candles);
  if (zb) {
    const { ko, en } = buildDesc(base, tf, "ZONE_BREAK", zb.direction);
    out.push({
      id: `${symbol}-${tf}-zone-${zb.direction}`,
      symbol, base, timeframe: tf,
      type: "ZONE_BREAK", direction: zb.direction,
      currentPrice: price, strength: zb.strength,
      descriptionKo: ko, descriptionEn: en, detectedAt: now,
    });
  }

  return out;
}

// ── GET ────────────────────────────────────────────────────────────────────
export async function GET() {
  try {
    const tasks = SYMBOLS.flatMap((sym) => TIMEFRAMES.map((tf) => processCell(sym, tf)));
    const nested = await Promise.all(tasks);
    const signals = nested.flat();

    // Sort: STRONG first → HARMONIC > DIVERGENCE > ZONE_BREAK
    const typeScore = { HARMONIC: 2, DIVERGENCE: 1, ZONE_BREAK: 0 };
    signals.sort((a, b) => {
      if (a.strength !== b.strength) return a.strength === "STRONG" ? -1 : 1;
      return typeScore[b.type] - typeScore[a.type];
    });

    return NextResponse.json({ signals, fetchedAt: new Date().toISOString() } satisfies CryptoSignalsResponse);
  } catch {
    return NextResponse.json({ signals: [], fetchedAt: new Date().toISOString() } satisfies CryptoSignalsResponse);
  }
}
