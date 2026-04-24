/**
 * Personal-use technical signal scanner.
 * Detects: EMA Cross · Bollinger Band Squeeze · Volume Spike · Stochastic RSI
 *
 * Runs entirely in the browser — same Binance→OKX→Bybit fallback chain.
 */

import type { TF } from "./cryptoSignals";

type Candle = {
  time: number;
  open: number; high: number; low: number; close: number;
  volume: number;
};

export type TechSignalType = "EMA_CROSS" | "BB_SQUEEZE" | "VOL_SPIKE" | "STOCH_RSI";

export type TechSignal = {
  id: string;
  symbol: string;
  base: string;
  timeframe: TF;
  type: TechSignalType;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  strength: "STRONG" | "MEDIUM";
  label: string;
  descKo: string;
  descEn: string;
  currentPrice: number;
  detectedAt: number;
  extra?: Record<string, string | number>;
};

// ── OHLCV fetch (Binance → OKX → Bybit) ──────────────────────────────────
const BYBIT_IV: Record<TF, string> = { "15m": "15", "1h": "60", "4h": "240" };
const OKX_IV:   Record<TF, string> = { "15m": "15m", "1h": "1H", "4h": "4H" };

async function fetchCandles(symbol: string, tf: TF, limit = 220): Promise<Candle[]> {
  // 1) Binance
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=${limit}`,
      { cache: "no-store" },
    );
    if (res.ok) {
      const raw: unknown[][] = await res.json();
      return raw.map((d) => ({
        time:   d[0] as number,
        open:   parseFloat(d[1] as string),
        high:   parseFloat(d[2] as string),
        low:    parseFloat(d[3] as string),
        close:  parseFloat(d[4] as string),
        volume: parseFloat(d[5] as string),
      }));
    }
  } catch { /* fall through */ }
  // 2) OKX
  try {
    const res = await fetch(
      `https://www.okx.com/api/v5/market/candles?instId=${symbol.replace("USDT", "-USDT")}&bar=${OKX_IV[tf]}&limit=${limit}`,
      { cache: "no-store" },
    );
    if (res.ok) {
      const { data } = await res.json() as { data: string[][] };
      return data.reverse().map((d) => ({
        time:   parseInt(d[0]),
        open:   parseFloat(d[1]),
        high:   parseFloat(d[2]),
        low:    parseFloat(d[3]),
        close:  parseFloat(d[4]),
        volume: parseFloat(d[5]),
      }));
    }
  } catch { /* fall through */ }
  // 3) Bybit
  try {
    const res = await fetch(
      `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${BYBIT_IV[tf]}&limit=${limit}`,
      { cache: "no-store" },
    );
    if (res.ok) {
      const { result } = await res.json() as { result: { list: string[][] } };
      return result.list.reverse().map((d) => ({
        time:   parseInt(d[0]),
        open:   parseFloat(d[1]),
        high:   parseFloat(d[2]),
        low:    parseFloat(d[3]),
        close:  parseFloat(d[4]),
        volume: parseFloat(d[5]),
      }));
    }
  } catch { /* fall through */ }
  return [];
}

// ── Math helpers ──────────────────────────────────────────────────────────

function calcEMA(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i === 0) { ema.push(values[0]); continue; }
    ema.push(values[i] * k + ema[i - 1] * (1 - k));
  }
  return ema;
}

function calcBBWidth(closes: number[], period = 20, mult = 2): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean  = slice.reduce((s, v) => s + v, 0) / period;
    const std   = Math.sqrt(slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period);
    out[i] = (mult * 2 * std) / mean; // bandwidth relative to mid
  }
  return out;
}

function calcBBMid(closes: number[], period = 20): number[] {
  const out: number[] = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    out[i] = slice.reduce((s, v) => s + v, 0) / period;
  }
  return out;
}

function calcRSI(closes: number[], period = 14): number[] {
  const rsi: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return rsi;
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) avgGain += d; else avgLoss -= d;
  }
  avgGain /= period; avgLoss /= period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const d    = closes[i] - closes[i - 1];
    const gain = d > 0 ? d : 0;
    const loss = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
}

function calcStochRSI(
  rsi: number[],
  stochPeriod = 14,
  kSmooth = 3,
  dSmooth = 3,
): { k: number; d: number }[] {
  const rawK: number[] = new Array(rsi.length).fill(NaN);
  for (let i = stochPeriod - 1; i < rsi.length; i++) {
    const slice = rsi.slice(i - stochPeriod + 1, i + 1).filter((v) => !isNaN(v));
    if (slice.length < stochPeriod) continue;
    const lo = Math.min(...slice);
    const hi = Math.max(...slice);
    rawK[i] = hi === lo ? 50 : (rsi[i] - lo) / (hi - lo) * 100;
  }
  const smoothK = calcEMA(rawK.map((v) => (isNaN(v) ? 50 : v)), kSmooth);
  const smoothD = calcEMA(smoothK, dSmooth);
  return rsi.map((_, i) => ({ k: smoothK[i], d: smoothD[i] }));
}

// ── Signal detectors ──────────────────────────────────────────────────────

type EMACrossHit = {
  pair: [number, number];
  direction: "BULLISH" | "BEARISH";
  strength: "STRONG" | "MEDIUM";
  candleIdx: number;
};

function detectEMACross(candles: Candle[]): EMACrossHit[] {
  const closes = candles.map((c) => c.close);
  const pairs: [number, number][] = [[20, 50], [50, 200]];
  const out: EMACrossHit[] = [];

  for (const [fast, slow] of pairs) {
    if (closes.length < slow + 5) continue;
    const emaF = calcEMA(closes, fast);
    const emaS = calcEMA(closes, slow);
    // Scan last 5 closed candles for a cross (exclude the forming one)
    for (let i = closes.length - 5; i < closes.length - 1; i++) {
      if (i < 1) continue;
      const prev = emaF[i - 1] - emaS[i - 1];
      const curr = emaF[i]     - emaS[i];
      if (prev <= 0 && curr > 0) {
        out.push({ pair: [fast, slow], direction: "BULLISH", strength: slow >= 200 ? "STRONG" : "MEDIUM", candleIdx: i });
      } else if (prev >= 0 && curr < 0) {
        out.push({ pair: [fast, slow], direction: "BEARISH", strength: slow >= 200 ? "STRONG" : "MEDIUM", candleIdx: i });
      }
    }
  }
  return out;
}

type BBSqueezeHit = {
  isSqueeze: boolean;
  expanding: boolean;
  direction: "BULLISH" | "BEARISH" | "NEUTRAL";
  widthNow: number;
  widthMin: number;
};

function detectBBSqueeze(candles: Candle[]): BBSqueezeHit | null {
  if (candles.length < 80) return null;
  const closes = candles.map((c) => c.close);
  const widths = calcBBWidth(closes);
  const mids   = calcBBMid(closes);

  const lookback = widths.slice(-60).filter((v) => !isNaN(v));
  if (lookback.length < 20) return null;

  const widthMin  = Math.min(...lookback);
  const widthNow  = widths[widths.length - 1];
  const widthPrev = widths[widths.length - 2] ?? widthNow;
  if (isNaN(widthNow)) return null;

  const SQUEEZE_THRESH = widthMin * 1.15;
  const isSqueeze = widthNow <= SQUEEZE_THRESH;
  const expanding = !isSqueeze && widthNow > widthPrev * 1.02;

  if (!isSqueeze && !expanding) return null;

  const price = closes[closes.length - 1];
  const mid   = mids[mids.length - 1];
  const direction = price > mid ? "BULLISH" : price < mid ? "BEARISH" : "NEUTRAL";

  return { isSqueeze, expanding, direction, widthNow, widthMin };
}

type VolSpikeHit = {
  direction: "BULLISH" | "BEARISH";
  ratio: number;
  candleIdx: number;
};

function detectVolSpike(candles: Candle[]): VolSpikeHit | null {
  if (candles.length < 30) return null;
  const hist   = candles.slice(-50, -1);
  const avgVol = hist.reduce((s, c) => s + c.volume, 0) / hist.length;

  // Check last 3 closed candles (skip forming)
  for (let i = candles.length - 2; i >= Math.max(0, candles.length - 4); i--) {
    const c     = candles[i];
    const ratio = c.volume / avgVol;
    if (ratio < 3.0) continue;
    const bodyPct = (c.close - c.open) / c.open * 100;
    if (bodyPct >  0.5) return { direction: "BULLISH", ratio, candleIdx: i };
    if (bodyPct < -0.5) return { direction: "BEARISH", ratio, candleIdx: i };
  }
  return null;
}

type StochRSIHit = {
  direction: "BULLISH" | "BEARISH";
  strength: "STRONG" | "MEDIUM";
  k: number;
  d: number;
};

function detectStochRSI(candles: Candle[]): StochRSIHit | null {
  if (candles.length < 70) return null;
  const closes = candles.map((c) => c.close);
  const rsi    = calcRSI(closes);
  const stoch  = calcStochRSI(rsi);
  const len    = stoch.length;
  if (len < 3) return null;

  const curr = stoch[len - 2]; // skip forming candle
  const prev = stoch[len - 3];
  if ([curr.k, curr.d, prev.k, prev.d].some(isNaN)) return null;

  if (prev.k <= prev.d && curr.k > curr.d && curr.k < 30) {
    return { direction: "BULLISH", strength: curr.k < 20 ? "STRONG" : "MEDIUM", k: curr.k, d: curr.d };
  }
  if (prev.k >= prev.d && curr.k < curr.d && curr.k > 70) {
    return { direction: "BEARISH", strength: curr.k > 80 ? "STRONG" : "MEDIUM", k: curr.k, d: curr.d };
  }
  return null;
}

// ── Process one (symbol × tf) cell ────────────────────────────────────────

async function processCell(symbol: string, tf: TF): Promise<TechSignal[]> {
  const candles = await fetchCandles(symbol, tf, 220);
  if (candles.length < 60) return [];

  const base   = symbol.replace("USDT", "");
  const price  = candles[candles.length - 1].close;
  const closes = candles.map((c) => c.close);
  const out: TechSignal[] = [];

  // ① EMA Cross
  for (const hit of detectEMACross(candles)) {
    const [fast, slow] = hit.pair;
    const emaF = calcEMA(closes, fast);
    const emaS = calcEMA(closes, slow);
    const isBull = hit.direction === "BULLISH";
    out.push({
      id: `${symbol}-${tf}-ema-${fast}-${slow}-${hit.direction}`,
      symbol, base, timeframe: tf,
      type: "EMA_CROSS",
      direction: hit.direction,
      strength: hit.strength,
      label: isBull ? `EMA ${fast}/${slow} 골든크로스` : `EMA ${fast}/${slow} 데드크로스`,
      descKo: `${base} ${tf} — EMA${fast}이 EMA${slow}를 ${isBull ? "상향" : "하향"} 돌파. ${hit.strength === "STRONG" ? "주요 추세 전환 신호" : "단기 모멘텀 변화"}`,
      descEn: `${base} ${tf} — EMA${fast} ${isBull ? "crossed above" : "crossed below"} EMA${slow}. ${hit.strength === "STRONG" ? "Major trend signal" : "Short-term momentum shift"}`,
      currentPrice: price,
      detectedAt: candles[hit.candleIdx]?.time ?? Date.now(),
      extra: {
        [`ema${fast}`]: +emaF[hit.candleIdx].toFixed(2),
        [`ema${slow}`]: +emaS[hit.candleIdx].toFixed(2),
      },
    });
  }

  // ② BB Squeeze
  const bb = detectBBSqueeze(candles);
  if (bb) {
    const isExpanding = bb.expanding && !bb.isSqueeze;
    out.push({
      id: `${symbol}-${tf}-bb-squeeze`,
      symbol, base, timeframe: tf,
      type: "BB_SQUEEZE",
      direction: bb.direction,
      strength: isExpanding ? "STRONG" : "MEDIUM",
      label: bb.isSqueeze ? "BB 스퀴즈 활성" : "BB 스퀴즈 해제",
      descKo: bb.isSqueeze
        ? `${base} ${tf} — 볼린저 밴드 수축 중. 변동성 폭발 임박 (${bb.direction === "BULLISH" ? "상승" : "하락"} 방향 선호)`
        : `${base} ${tf} — BB 스퀴즈 해제, 밴드 확장 시작. ${bb.direction === "BULLISH" ? "상승" : "하락"} 방향 돌파 전개`,
      descEn: bb.isSqueeze
        ? `${base} ${tf} — Bollinger Band squeeze active. Volatility breakout imminent (${bb.direction.toLowerCase()} bias)`
        : `${base} ${tf} — BB squeeze releasing, bandwidth expanding. ${bb.direction.toLowerCase()} breakout developing`,
      currentPrice: price,
      detectedAt: candles[candles.length - 1].time,
      extra: { widthNow: +bb.widthNow.toFixed(4), widthMin: +bb.widthMin.toFixed(4) },
    });
  }

  // ③ Volume Spike
  const vol = detectVolSpike(candles);
  if (vol) {
    out.push({
      id: `${symbol}-${tf}-vol-spike`,
      symbol, base, timeframe: tf,
      type: "VOL_SPIKE",
      direction: vol.direction,
      strength: vol.ratio >= 5 ? "STRONG" : "MEDIUM",
      label: `거래량 급등 ×${vol.ratio.toFixed(1)}`,
      descKo: `${base} ${tf} — 거래량이 평균의 ${vol.ratio.toFixed(1)}배 급등. ${vol.direction === "BULLISH" ? "강한 매수세 유입" : "강한 매도세 출현"} 확인`,
      descEn: `${base} ${tf} — Volume spike ×${vol.ratio.toFixed(1)} vs average. ${vol.direction === "BULLISH" ? "Strong buying pressure" : "Heavy selling pressure"} confirmed`,
      currentPrice: price,
      detectedAt: candles[vol.candleIdx]?.time ?? Date.now(),
      extra: { ratio: +vol.ratio.toFixed(2) },
    });
  }

  // ④ Stochastic RSI
  const stoch = detectStochRSI(candles);
  if (stoch) {
    const isBull = stoch.direction === "BULLISH";
    out.push({
      id: `${symbol}-${tf}-stochrsi-${stoch.direction}`,
      symbol, base, timeframe: tf,
      type: "STOCH_RSI",
      direction: stoch.direction,
      strength: stoch.strength,
      label: isBull ? "Stoch RSI 과매도 상향교차" : "Stoch RSI 과매수 하향교차",
      descKo: isBull
        ? `${base} ${tf} — Stoch RSI K(${stoch.k.toFixed(1)})가 과매도 구간에서 D를 상향 돌파. 반등 가능성`
        : `${base} ${tf} — Stoch RSI K(${stoch.k.toFixed(1)})가 과매수 구간에서 D를 하향 돌파. 조정 가능성`,
      descEn: isBull
        ? `${base} ${tf} — Stoch RSI K(${stoch.k.toFixed(1)}) crossed above D in oversold zone. Potential bounce`
        : `${base} ${tf} — Stoch RSI K(${stoch.k.toFixed(1)}) crossed below D in overbought zone. Potential pullback`,
      currentPrice: price,
      detectedAt: candles[candles.length - 2]?.time ?? Date.now(),
      extra: { k: +stoch.k.toFixed(2), d: +stoch.d.toFixed(2) },
    });
  }

  return out;
}

// ── Public API ────────────────────────────────────────────────────────────

export const TECH_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT", "ADAUSDT", "DOGEUSDT",
  "VIRTUALUSDT", "TAOUSDT", "WLDUSDT", "MAGICUSDT", "LTCUSDT", "ENAUSDT", "TURBOUSDT",
];

export const TECH_TFS: TF[] = ["1h", "4h"];

const TYPE_SCORE: Record<TechSignalType, number> = {
  EMA_CROSS: 3,
  STOCH_RSI: 2,
  VOL_SPIKE: 2,
  BB_SQUEEZE: 1,
};

export async function scanTechnicalSignals(
  symbols: string[] = TECH_SYMBOLS,
  tfs: TF[] = TECH_TFS,
): Promise<TechSignal[]> {
  const tasks  = symbols.flatMap((sym) => tfs.map((tf) => processCell(sym, tf)));
  const nested = await Promise.all(tasks);
  const signals = nested.flat();

  signals.sort((a, b) => {
    if (a.strength !== b.strength) return a.strength === "STRONG" ? -1 : 1;
    const ts = TYPE_SCORE[b.type] - TYPE_SCORE[a.type];
    return ts !== 0 ? ts : a.base.localeCompare(b.base);
  });

  return signals;
}

export function formatRelativeTimeTech(ts: number, lang: "ko" | "en"): string {
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 1)  return lang === "ko" ? "방금" : "just now";
  if (mins < 60) return lang === "ko" ? `${mins}분 전` : `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  return lang === "ko" ? `${hrs}시간 전` : `${hrs}h ago`;
}

export function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1)    return p.toFixed(3);
  if (p >= 0.01) return p.toFixed(4);
  return p.toFixed(6);
}
