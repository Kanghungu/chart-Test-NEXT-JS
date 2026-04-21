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
  detectedAt: number;
};

// ── Config ─────────────────────────────────────────────────────────────────
export const CRYPTO_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT", "ADAUSDT", "DOGEUSDT",
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
const HARMONIC_DEFS: Array<{ name: string; ab_xa: [number, number]; xd_xa: [number, number] }> = [
  { name: "Bat",       ab_xa: [0.28, 0.55], xd_xa: [0.80, 0.96] },
  { name: "Gartley",   ab_xa: [0.54, 0.68], xd_xa: [0.72, 0.84] },
  { name: "Butterfly", ab_xa: [0.70, 0.86], xd_xa: [1.15, 1.75] },
  { name: "Crab",      ab_xa: [0.28, 0.66], xd_xa: [1.54, 1.75] },
  { name: "Deep Crab", ab_xa: [0.80, 0.95], xd_xa: [1.54, 1.75] },
  { name: "Shark",     ab_xa: [1.00, 1.80], xd_xa: [0.80, 1.20] },
  { name: "Cypher",    ab_xa: [0.33, 0.65], xd_xa: [0.72, 0.84] },
];

function inRange(v: number, lo: number, hi: number, tol = 0.08): boolean {
  return v >= lo - tol && v <= hi + tol;
}

type HarmonicHit = {
  name: string;
  direction: "BULLISH" | "BEARISH";
  przMin: number;
  przMax: number;
  detectedAt: number;
};

function detectHarmonics(pivots: Pivot[], candles: Candle[], recency: number): HarmonicHit[] {
  const hits: HarmonicHit[] = [];
  if (pivots.length < 5) return hits;

  const recent = pivots.slice(-14);
  const candleLen = candles.length;

  for (let i = 0; i <= recent.length - 5; i++) {
    const [X, A, B, C, D] = recent.slice(i, i + 5);
    if (X.type === A.type || A.type === B.type || B.type === C.type || C.type === D.type) continue;

    const bullish = X.type === "low"  && D.type === "low";
    const bearish = X.type === "high" && D.type === "high";
    if (!bullish && !bearish) continue;

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

  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = `${h.name}-${h.direction}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ── Divergence ────────────────────────────────────────────────────────────
type DivHit = { direction: "BULLISH" | "BEARISH"; strength: "STRONG" | "MEDIUM"; detectedAt: number };

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
    const isLow =
      c.low  < candles[i-1].low  && c.low  < candles[i-2].low  &&
      c.low  < candles[i+1].low  && c.low  < candles[i+2].low;
    const isHigh =
      c.high > candles[i-1].high && c.high > candles[i-2].high &&
      c.high > candles[i+1].high && c.high > candles[i+2].high;
    if (isLow)  lows.push({ i, price: c.low,  r, time: c.time });
    if (isHigh) highs.push({ i, price: c.high, r, time: c.time });
  }

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

// ── Zone Breakout ─────────────────────────────────────────────────────────
type ZoneHit = { direction: "BULLISH" | "BEARISH"; strength: "STRONG" | "MEDIUM"; detectedAt: number };

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

  for (let i = 1; i < recent.length; i++) {
    const prev = recent[i - 1].close;
    const curr = recent[i].close;
    const vol  = recent[i].volume;
    const volStrong = vol > avgVol * 1.3;

    if (prev < resistance && curr > resistance) {
      hits.push({ direction: "BULLISH", strength: volStrong ? "STRONG" : "MEDIUM", detectedAt: recent[i].time });
    }
    if (prev > support && curr < support) {
      hits.push({ direction: "BEARISH", strength: volStrong ? "STRONG" : "MEDIUM", detectedAt: recent[i].time });
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

  for (const d of detectDivergence(candles, rsi)) {
    const { ko, en } = buildDesc(base, tf, "DIVERGENCE", d.direction);
    out.push({
      id: `${symbol}-${tf}-div-${d.direction}`,
      symbol, base, timeframe: tf,
      type: "DIVERGENCE", direction: d.direction,
      currentPrice: price, strength: d.strength,
      descriptionKo: ko, descriptionEn: en, detectedAt: d.detectedAt,
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
