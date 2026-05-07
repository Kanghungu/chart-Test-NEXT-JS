"use client";

/**
 * Trading Edge Cloud — 실전 트레이딩용 모멘텀 구름대
 *
 * 일반 일목균형표와의 차별점:
 *  1. 셋업 스코어 (0~10) — 진입 조건 가중합산으로 신호 품질 정량화
 *  2. 진입 / 손절 / 목표가 자동 산출 + RR 비율
 *  3. 플랫 Kijun 감지 — 수평선이면 최강 지지·저항으로 강조
 *  4. 거래량 확인 패널 — 신호 신뢰도 필터링
 *  5. 미래 구름 프리뷰 — 26봉 선행으로 추세 반전 조기 감지
 *  6. 고품질 TK 크로스만 — 구름 외부에서 발생한 것만 표시
 *  7. Chikou 클리어런스 체크 — 26봉 전 가격 장애물 없는지 확인
 *  8. ATR 기반 동적 손절 — 단순 %가 아닌 변동성 반영
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type UTCTimestamp,
  type SeriesMarker,
} from "lightweight-charts";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import styles from "./CloudChart.module.css";

// ── Types ─────────────────────────────────────────────────────────────────
type Candle = {
  time: number; open: number; high: number; low: number; close: number; volume: number;
};
type Coin = "BTC" | "ETH" | "SOL" | "XRP" | "BNB";
type TF   = "1h" | "4h" | "1D";

type SetupResult = {
  score:       number;          // 0~10
  stars:       number;          // 0~5
  direction:   "LONG" | "SHORT" | "NEUTRAL";
  confidence:  "HIGH" | "MEDIUM" | "LOW";
  entry:       number;
  stopLoss:    number;
  target1:     number;
  target2:     number;
  rr1:         number;
  rr2:         number;
  reasons:     string[];
  warnings:    string[];
};

// ── Config ─────────────────────────────────────────────────────────────────
const COINS: Coin[] = ["BTC", "ETH", "SOL", "XRP", "BNB"];
const COIN_TINT: Record<Coin, string> = {
  BTC: "#f7931a", ETH: "#627eea", SOL: "#14f195", XRP: "#00a3e0", BNB: "#f3ba2f",
};
const TF_CFG: Record<TF, { interval: string; limit: number }> = {
  "1h": { interval: "1h", limit: 300 },
  "4h": { interval: "4h", limit: 300 },
  "1D": { interval: "1d", limit: 300 },
};

// ── Math ──────────────────────────────────────────────────────────────────
function periodHL(hs: number[], ls: number[], from: number, n: number) {
  const slice_h = hs.slice(from, from + n);
  const slice_l = ls.slice(from, from + n);
  return (Math.max(...slice_h) + Math.min(...slice_l)) / 2;
}

function calcIchimoku(candles: Candle[], tP = 9, kP = 26) {
  const n   = candles.length;
  const hs  = candles.map(c => c.high);
  const ls  = candles.map(c => c.low);
  const sbP = kP * 2;
  const disp = kP;

  const tenkan = new Array(n).fill(NaN);
  const kijun  = new Array(n).fill(NaN);
  const spanA  = new Array(n + disp).fill(NaN);
  const spanB  = new Array(n + disp).fill(NaN);
  const chikou = new Array(n).fill(NaN);

  for (let i = tP  - 1; i < n; i++) tenkan[i] = periodHL(hs, ls, i - tP  + 1, tP);
  for (let i = kP  - 1; i < n; i++) kijun[i]  = periodHL(hs, ls, i - kP  + 1, kP);
  for (let i = kP  - 1; i < n; i++) {
    if (isFinite(tenkan[i]) && isFinite(kijun[i]))
      spanA[i + disp] = (tenkan[i] + kijun[i]) / 2;
  }
  for (let i = sbP - 1; i < n; i++) spanB[i + disp] = periodHL(hs, ls, i - sbP + 1, sbP);
  for (let i = 0; i < n; i++)       chikou[i]        = candles[i].close;

  return { tenkan, kijun, spanA, spanB, chikou };
}

function calcATR(candles: Candle[], period = 14): number[] {
  const out = new Array(candles.length).fill(NaN);
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    const curr = candles[i];
    const tr = Math.max(curr.high - curr.low, Math.abs(curr.high - prev), Math.abs(curr.low - prev));
    if (i < period) { out[i] = tr; continue; }
    if (i === period) {
      out[i] = candles.slice(1, period + 1)
        .reduce((s, c, j) => {
          const p = candles[j].close;
          return s + Math.max(c.high - c.low, Math.abs(c.high - p), Math.abs(c.low - p));
        }, 0) / period;
    } else {
      out[i] = (out[i - 1] * (period - 1) + tr) / period;
    }
  }
  return out;
}

function calcRSI(closes: number[], period = 14): number[] {
  const out = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return out;
  let avgG = 0, avgL = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    avgG += Math.max(0, d); avgL += Math.max(0, -d);
  }
  avgG /= period; avgL /= period;
  out[period] = 100 - 100 / (1 + (avgL === 0 ? Infinity : avgG / avgL));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + Math.max(0, d)) / period;
    avgL = (avgL * (period - 1) + Math.max(0, -d)) / period;
    out[i] = 100 - 100 / (1 + (avgL === 0 ? Infinity : avgG / avgL));
  }
  return out;
}

function calcVolMA(volumes: number[], period = 20): number[] {
  const out = new Array(volumes.length).fill(NaN);
  for (let i = period - 1; i < volumes.length; i++) {
    out[i] = volumes.slice(i - period + 1, i + 1).reduce((s, v) => s + v, 0) / period;
  }
  return out;
}

/** 플랫 Kijun 감지 — N봉 동안 기울기 임계값 미만이면 수평 */
function detectFlatKijun(kijun: number[], price: number, flatBars = 3, threshold = 0.0015): number[] {
  const levels: number[] = [];
  const n = kijun.length;
  for (let i = flatBars; i < n; i++) {
    const k = kijun[i];
    if (!isFinite(k)) continue;
    const maxDiff = kijun.slice(i - flatBars, i + 1)
      .filter(isFinite)
      .reduce((mx, v) => Math.max(mx, Math.abs(v - k) / price), 0);
    if (maxDiff < threshold && !levels.some(l => Math.abs(l - k) / price < 0.002)) {
      levels.push(k);
    }
  }
  return levels.slice(-3); // 최근 3개만
}

/** Chikou 클리어런스 — 26봉 전 가격 장애물이 없는지 */
function chikouIsClear(candles: Candle[], disp = 26): boolean {
  const n = candles.length;
  if (n <= disp) return false;
  const chikou = candles[n - 1].close;
  const historicHighs = candles.slice(n - 1 - disp, n - 1).map(c => c.high);
  const historicLows  = candles.slice(n - 1 - disp, n - 1).map(c => c.low);
  const aboveAll = historicHighs.every(h => chikou > h);
  const belowAll  = historicLows.every(l => chikou < l);
  return aboveAll || belowAll;
}

// ── Trading Setup Scorer ──────────────────────────────────────────────────
function scoreSetup(
  candles: Candle[],
  ich:     ReturnType<typeof calcIchimoku>,
  rsiArr:  number[],
  atrArr:  number[],
  volMA:   number[],
  isKo:    boolean,
): SetupResult {
  const n = candles.length;
  const i = n - 1;
  const price = candles[i].close;
  const t = ich.tenkan[i], k = ich.kijun[i];
  const a = ich.spanA[i], b = ich.spanB[i]; // current cloud (not future)
  const rsi = rsiArr[i];
  const atr = atrArr[i];
  const vol = candles[i].volume;
  const vma = volMA[i];

  const cloudTop = isFinite(a) && isFinite(b) ? Math.max(a, b) : NaN;
  const cloudBot = isFinite(a) && isFinite(b) ? Math.min(a, b) : NaN;
  const cloudBull = isFinite(a) && isFinite(b) && a > b;
  const aboveCloud = price > cloudTop;
  const belowCloud = price < cloudBot;
  const inCloud    = !aboveCloud && !belowCloud;

  // TK direction
  const prevT = ich.tenkan[i - 1], prevK = ich.kijun[i - 1];
  const tkBullCross = isFinite(t) && isFinite(k) && isFinite(prevT) && isFinite(prevK)
    && prevT <= prevK && t > k;
  const tkBearCross = isFinite(t) && isFinite(k) && isFinite(prevT) && isFinite(prevK)
    && prevT >= prevK && t < k;
  const tkAbove = isFinite(t) && isFinite(k) && t > k;
  const tkBelow = isFinite(t) && isFinite(k) && t < k;

  const aboveKijun = isFinite(k) && price > k;
  const belowKijun = isFinite(k) && price < k;
  const volSpike   = isFinite(vma) && vol > vma * 1.4;
  const chiClear   = chikouIsClear(candles);
  const rsiLong    = isFinite(rsi) && rsi > 50 && rsi < 70;
  const rsiShort   = isFinite(rsi) && rsi < 50 && rsi > 30;
  const rsiOB      = isFinite(rsi) && rsi >= 70;
  const rsiOS      = isFinite(rsi) && rsi <= 30;

  // ── LONG scoring ─────────────────────────────────────────────────────
  let longScore = 0;
  const longReasons: string[] = [];
  const longWarnings: string[] = [];

  if (aboveCloud)        { longScore += 2; longReasons.push(isKo ? "가격 구름 위" : "Price above cloud"); }
  if (tkBullCross && aboveCloud) { longScore += 3; longReasons.push(isKo ? "✦ 구름 위 TK 골든크로스" : "✦ TK golden cross above cloud"); }
  else if (tkBullCross)  { longScore += 1; longReasons.push(isKo ? "TK 골든크로스 (구름 밖)" : "TK golden cross (outside cloud)"); }
  if (tkAbove && aboveCloud) { longScore += 1; longReasons.push(isKo ? "TK 정배열" : "TK bullish"); }
  if (cloudBull)         { longScore += 1; longReasons.push(isKo ? "구름 양전 (강세)" : "Bullish cloud"); }
  if (aboveKijun)        { longScore += 1; longReasons.push(isKo ? "기준선 위" : "Above Kijun"); }
  if (chiClear)          { longScore += 1; longReasons.push(isKo ? "Chikou 클리어" : "Chikou clear"); }
  if (rsiLong)           { longScore += 1; longReasons.push(isKo ? `RSI 모멘텀 (${rsi.toFixed(0)})` : `RSI momentum (${rsi.toFixed(0)})`); }
  if (volSpike)          { longScore += 1; longReasons.push(isKo ? "거래량 급증 확인" : "Volume spike confirmed"); }
  if (rsiOB)             { longWarnings.push(isKo ? "RSI 과매수 주의" : "RSI overbought caution"); }
  if (inCloud)           { longScore -= 1; longWarnings.push(isKo ? "가격 구름 속 (위험 구간)" : "Price in cloud (danger zone)"); }
  if (belowCloud)        { longScore -= 3; longWarnings.push(isKo ? "가격 구름 아래 — 롱 비권장" : "Price below cloud — avoid long"); }

  // ── SHORT scoring ─────────────────────────────────────────────────────
  let shortScore = 0;
  const shortReasons: string[] = [];
  const shortWarnings: string[] = [];

  if (belowCloud)        { shortScore += 2; shortReasons.push(isKo ? "가격 구름 아래" : "Price below cloud"); }
  if (tkBearCross && belowCloud) { shortScore += 3; shortReasons.push(isKo ? "✦ 구름 아래 TK 데드크로스" : "✦ TK dead cross below cloud"); }
  else if (tkBearCross)  { shortScore += 1; shortReasons.push(isKo ? "TK 데드크로스" : "TK dead cross"); }
  if (tkBelow && belowCloud) { shortScore += 1; shortReasons.push(isKo ? "TK 역배열" : "TK bearish"); }
  if (!cloudBull)        { shortScore += 1; shortReasons.push(isKo ? "구름 음전 (약세)" : "Bearish cloud"); }
  if (belowKijun)        { shortScore += 1; shortReasons.push(isKo ? "기준선 아래" : "Below Kijun"); }
  if (chiClear)          { shortScore += 1; shortReasons.push(isKo ? "Chikou 클리어" : "Chikou clear"); }
  if (rsiShort)          { shortScore += 1; shortReasons.push(isKo ? `RSI 하락 (${rsi.toFixed(0)})` : `RSI bearish (${rsi.toFixed(0)})`); }
  if (volSpike)          { shortScore += 1; shortReasons.push(isKo ? "거래량 급증 확인" : "Volume spike confirmed"); }
  if (rsiOS)             { shortWarnings.push(isKo ? "RSI 과매도 주의" : "RSI oversold caution"); }
  if (inCloud)           { shortScore -= 1; shortWarnings.push(isKo ? "가격 구름 속 (위험 구간)" : "Price in cloud (danger zone)"); }
  if (aboveCloud)        { shortScore -= 3; shortWarnings.push(isKo ? "가격 구름 위 — 숏 비권장" : "Price above cloud — avoid short"); }

  // ── Direction & entry/SL/target ───────────────────────────────────────
  const dir: "LONG" | "SHORT" | "NEUTRAL" = longScore > shortScore && longScore >= 4
    ? "LONG"
    : shortScore > longScore && shortScore >= 4
      ? "SHORT"
      : "NEUTRAL";

  const rawScore = dir === "LONG" ? longScore : dir === "SHORT" ? shortScore : 0;
  const score = Math.max(0, Math.min(10, rawScore));
  const stars = score >= 9 ? 5 : score >= 7 ? 4 : score >= 5 ? 3 : score >= 3 ? 2 : 1;
  const confidence: SetupResult["confidence"] = score >= 7 ? "HIGH" : score >= 5 ? "MEDIUM" : "LOW";
  const atrVal = isFinite(atr) ? atr : price * 0.01;

  let entry = price, stopLoss = 0, target1 = 0, target2 = 0;

  if (dir === "LONG") {
    entry   = isFinite(k) && k < price ? Math.max(price, k) : price;
    stopLoss = isFinite(cloudBot) ? cloudBot - atrVal * 0.5 : price - atrVal * 2;
    target1  = isFinite(k) ? price + (price - stopLoss) * 1.5 : price + atrVal * 3;
    target2  = price + (price - stopLoss) * 2.5;
  } else if (dir === "SHORT") {
    entry   = isFinite(k) && k > price ? Math.min(price, k) : price;
    stopLoss = isFinite(cloudTop) ? cloudTop + atrVal * 0.5 : price + atrVal * 2;
    target1  = price - (stopLoss - price) * 1.5;
    target2  = price - (stopLoss - price) * 2.5;
  } else {
    entry = price; stopLoss = price; target1 = price; target2 = price;
  }

  const risk   = Math.abs(entry - stopLoss);
  const rr1    = risk > 0 ? Math.abs(target1 - entry) / risk : 0;
  const rr2    = risk > 0 ? Math.abs(target2 - entry) / risk : 0;

  return {
    score, stars, direction: dir, confidence,
    entry, stopLoss, target1, target2, rr1, rr2,
    reasons:  dir === "LONG" ? longReasons  : shortReasons,
    warnings: dir === "LONG" ? longWarnings : shortWarnings,
  };
}

// ── Canvas cloud renderer ─────────────────────────────────────────────────
function drawClouds(
  canvas:   HTMLCanvasElement,
  chart:    IChartApi,
  priceToY: (p: number) => number | null,
  times:    UTCTimestamp[],
  spanA:    number[],
  spanB:    number[],
  rsi:      number,
  setup:    SetupResult,
  flatLevels: number[],
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width / dpr, H = canvas.height / dpr;
  ctx.clearRect(0, 0, W, H);

  const ts = chart.timeScale();

  // RSI blend: 0=bear, 0.5=neutral, 1=bull
  const rsiBlend = isFinite(rsi) ? Math.max(0, Math.min(1, (rsi - 40) / 20)) : 0.5;

  // Determine where the "present" splits from the future cloud
  const lastTime = times.at(-1);

  function drawCloudLayer(opacity: number, isFuture: boolean) {
    const pts: {x: number; ya: number; yb: number; isFut: boolean}[] = [];
    for (let i = 0; i < times.length; i++) {
      const a = spanA[i], b = spanB[i];
      if (!isFinite(a) || !isFinite(b)) continue;
      const x  = ts.timeToCoordinate(times[i]);
      const ya = priceToY(a);
      const yb = priceToY(b);
      if (x === null || ya === null || yb === null) continue;
      const fut = lastTime ? (times[i] as number) > (lastTime as number) : false;
      if (isFuture !== fut) continue;
      pts.push({ x, ya, yb, isFut: fut });
    }
    if (pts.length < 2) return;

    let seg = 0;
    while (seg < pts.length) {
      const isAAbove = pts[seg].ya < pts[seg].yb;
      let end = seg;
      while (end + 1 < pts.length && (pts[end + 1].ya < pts[end + 1].yb) === isAAbove) end++;

      ctx.beginPath();
      ctx.moveTo(pts[seg].x, pts[seg].ya);
      for (let j = seg + 1; j <= end; j++) ctx.lineTo(pts[j].x, pts[j].ya);
      for (let j = end; j >= seg; j--)    ctx.lineTo(pts[j].x, pts[j].yb);
      ctx.closePath();

      let r: number, g: number, b: number;
      if (isAAbove) { // bullish
        r = Math.round(50  + (1 - rsiBlend) * 120);
        g = Math.round(220 - (1 - rsiBlend) * 60);
        b = Math.round(100 - (1 - rsiBlend) * 60);
      } else { // bearish
        r = Math.round(240 - rsiBlend * 120);
        g = Math.round(80  + rsiBlend * 80);
        b = Math.round(80  + rsiBlend * 60);
      }

      // Future cloud is more transparent + pattern fill
      const alphaBase = isFuture ? opacity * 0.55 : opacity;
      ctx.fillStyle = `rgba(${r},${g},${b},${alphaBase})`;
      ctx.fill();

      // Future cloud border
      if (isFuture) {
        ctx.strokeStyle = isAAbove ? `rgba(74,222,128,0.4)` : `rgba(248,113,113,0.4)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      seg = end + 1;
    }
  }

  // Past/present cloud
  drawCloudLayer(0.22, false);
  // Future cloud (preview next 26 bars)
  drawCloudLayer(0.14, true);

  // Flat Kijun horizontal highlight bands
  flatLevels.forEach((level, idx) => {
    const y = priceToY(level);
    if (y === null) return;
    // Glow band
    const grad = ctx.createLinearGradient(0, y - 12, 0, y + 12);
    const colors = ["rgba(251,191,36,0.15)", "rgba(251,191,36,0)", "rgba(251,191,36,0)"];
    grad.addColorStop(0, colors[0]);
    grad.addColorStop(0.5, colors[1]);
    grad.addColorStop(1, colors[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, y - 12, W, 24);

    // Dashed horizontal line
    ctx.strokeStyle = "rgba(251,191,36,0.6)";
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // Entry/SL/TP lines on chart
  const lineConfigs = setup.direction !== "NEUTRAL"
    ? [
        { price: setup.entry,   color: "rgba(56,189,248,0.7)",  label: "진입",   dash: [4,4]  },
        { price: setup.stopLoss,color: "rgba(248,113,113,0.7)", label: "손절",   dash: [6,3]  },
        { price: setup.target1, color: "rgba(74,222,128,0.6)",  label: `TP1`,    dash: [4,4]  },
        { price: setup.target2, color: "rgba(74,222,128,0.4)",  label: `TP2`,    dash: [3,5]  },
      ]
    : [];

  ctx.font = "bold 10px ui-monospace, monospace";
  ctx.textBaseline = "middle";

  lineConfigs.forEach(({ price: lp, color, label, dash }) => {
    const y = priceToY(lp);
    if (y === null || y < 0 || y > H) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash(dash);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W - 70, y);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.fillText(`${label}`, W - 68, y);
  });
}

// ── Fetch candles ─────────────────────────────────────────────────────────
async function fetchCandles(coin: Coin, tf: TF): Promise<Candle[]> {
  const { interval, limit } = TF_CFG[tf];
  try {
    const res  = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${coin}USDT&interval=${interval}&limit=${limit}`,
      { cache: "no-store" },
    );
    const data = await res.json() as Array<(string|number)[]>;
    return data.map(k => ({
      time:   Number(k[0]),
      open:   parseFloat(k[1] as string),
      high:   parseFloat(k[2] as string),
      low:    parseFloat(k[3] as string),
      close:  parseFloat(k[4] as string),
      volume: parseFloat(k[5] as string),
    }));
  } catch { return []; }
}

// ── Copy ──────────────────────────────────────────────────────────────────
const COPY = {
  ko: {
    kicker:    "05 / TRADING EDGE CLOUD",
    title:     "트레이딩 엣지 구름대",
    hint:      "셋업 스코어 · 진입/손절/목표 자동산출 · 플랫 Kijun · 거래량 필터 · 미래 구름 프리뷰",
    coin: "코인", tf: "봉", refresh: "새로고침",
    loading: "데이터 로딩 중...", error: "로드 실패",
    score: "셋업 스코어", direction: "방향",
    entry: "진입", sl: "손절", tp1: "목표1", tp2: "목표2", rr: "RR",
    long: "롱", short: "숏", neutral: "중립",
    high: "고품질", medium: "보통", low: "저품질",
    above: "구름 위 ✦", inside: "구름 속", below: "구름 아래",
    flatKijun: "플랫 기준선 (강한 S/R)",
    chikou: "Chikou 클리어",
    volFilter: "거래량 확인",
    reasons: "조건", warnings: "주의",
    futureCloud: "미래 구름 (점선)",
    legend: {
      tenkan: "전환선 (Tenkan)", kijun: "기준선 (Kijun)",
      spanA: "선행A", spanB: "선행B", chikou: "후행스팬",
      flatK: "플랫 Kijun (S/R)", entry: "진입선", sl: "손절선", tp: "목표선",
    },
    info: "✦ 최고 품질 셋업: 구름 외부에서 TK 크로스 + 거래량 확인 + Chikou 클리어 | 플랫 Kijun은 강한 지지·저항 | 미래 구름(점선)으로 추세 전환 조기 감지",
  },
  en: {
    kicker:    "05 / TRADING EDGE CLOUD",
    title:     "Trading Edge Cloud",
    hint:      "Setup score · Auto entry/SL/TP · Flat Kijun S/R · Volume filter · Future cloud preview",
    coin: "Coin", tf: "TF", refresh: "Refresh",
    loading: "Loading...", error: "Failed to load",
    score: "Setup Score", direction: "Direction",
    entry: "Entry", sl: "Stop", tp1: "TP1", tp2: "TP2", rr: "RR",
    long: "Long", short: "Short", neutral: "Neutral",
    high: "High Quality", medium: "Medium", low: "Low Quality",
    above: "Above Cloud ✦", inside: "In Cloud", below: "Below Cloud",
    flatKijun: "Flat Kijun (Strong S/R)",
    chikou: "Chikou Clear",
    volFilter: "Volume Confirmed",
    reasons: "Conditions", warnings: "Warnings",
    futureCloud: "Future Cloud (dashed)",
    legend: {
      tenkan: "Tenkan (Conversion)", kijun: "Kijun (Base)",
      spanA: "Span A", spanB: "Span B", chikou: "Chikou",
      flatK: "Flat Kijun (S/R)", entry: "Entry", sl: "Stop Loss", tp: "Take Profit",
    },
    info: "✦ Best setup: TK cross outside cloud + volume spike + Chikou clear | Flat Kijun = strong S/R | Future cloud (dashed) = early trend reversal detection",
  },
} as const;

// ── Component ─────────────────────────────────────────────────────────────
export default function CloudChart() {
  const { language } = useLanguage();
  const C = COPY[language];
  const isKo = language === "ko";

  const [coin,    setCoin]    = useState<Coin>("BTC");
  const [tf,      setTf]      = useState<TF>("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const chartRef    = useRef<HTMLDivElement>(null);
  const volRef      = useRef<HTMLDivElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const chartApiRef = useRef<IChartApi | null>(null);
  const rafRef      = useRef<number>(0);

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    const data = await fetchCandles(coin, tf);
    if (!data.length) { setError(true); setLoading(false); return; }
    setCandles(data);
    setLoading(false);
  }, [coin, tf]);

  useEffect(() => { load(); }, [load]);

  // ── Build charts ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current || !candles.length) return;
    const container = chartRef.current;
    const tint = COIN_TINT[coin];

    if (chartApiRef.current) { chartApiRef.current.remove(); chartApiRef.current = null; }

    const chart = createChart(container, {
      width: container.clientWidth, height: 420,
      layout: {
        background: { color: "transparent" },
        textColor: "#94a3b8",
        fontFamily: "ui-monospace, monospace",
      },
      grid: { vertLines: { color: "rgba(51,65,85,0.18)" }, horzLines: { color: "rgba(51,65,85,0.18)" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(51,65,85,0.4)" },
      timeScale: { borderColor: "rgba(51,65,85,0.4)", timeVisible: true, secondsVisible: false },
    });
    chartApiRef.current = chart;

    const toTs = (ms: number): UTCTimestamp => Math.floor(ms / 1000) as UTCTimestamp;
    const closes  = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    const rsiArr  = calcRSI(closes, 14);
    const atrArr  = calcATR(candles, 14);
    const volMA   = calcVolMA(volumes, 20);
    const ich     = calcIchimoku(candles, 9, 26);
    const price   = closes.at(-1) ?? 0;
    const flatLvl = detectFlatKijun(ich.kijun, price);

    // Extend time axis for future cloud (26 bars ahead)
    const dT = candles.length > 1 ? candles[1].time - candles[0].time : 3_600_000;
    const extTimes: UTCTimestamp[] = [];
    for (let i = 0; i < candles.length + 26; i++)
      extTimes.push(toTs(candles[0].time + i * dT));

    // ── Candles ───────────────────────────────────────────────────────
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#4ade80", downColor: "#f87171",
      borderVisible: false, wickUpColor: "#4ade80", wickDownColor: "#f87171",
    });
    candleSeries.setData(
      candles.map(c => ({ time: toTs(c.time), open: c.open, high: c.high, low: c.low, close: c.close })),
    );

    // ── Tenkan (전환선) — orange ──────────────────────────────────────
    const tenkanSeries = chart.addSeries(LineSeries, {
      color: "#fb923c", lineWidth: 1,
      priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
    });
    tenkanSeries.setData(
      candles.map((c, i) => ({ time: toTs(c.time), value: ich.tenkan[i] })).filter(d => isFinite(d.value)),
    );

    // ── Kijun (기준선) — blue, thicker = S/R ─────────────────────────
    const kijunSeries = chart.addSeries(LineSeries, {
      color: "#38bdf8", lineWidth: 2,
      priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
    });
    kijunSeries.setData(
      candles.map((c, i) => ({ time: toTs(c.time), value: ich.kijun[i] })).filter(d => isFinite(d.value)),
    );

    // ── Chikou Span (후행스팬) — purple dotted ────────────────────────
    const chikouSeries = chart.addSeries(LineSeries, {
      color: "rgba(167,139,250,0.65)", lineWidth: 1, lineStyle: LineStyle.Dotted,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    chikouSeries.setData(
      candles.slice(0, candles.length - 26).map((_, i) => ({
        time: toTs(candles[i + 26].time),
        value: candles[i].close,
      })).filter(d => isFinite(d.value)),
    );

    // ── Senkou edge lines ─────────────────────────────────────────────
    for (const [vals, color] of [
      [ich.spanA, "rgba(74,222,128,0.45)"],
      [ich.spanB, "rgba(248,113,113,0.45)"],
    ] as [number[], string][]) {
      const s = chart.addSeries(LineSeries, {
        color, lineWidth: 1, lineStyle: LineStyle.Solid,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      });
      s.setData(
        extTimes.map((t, i) => ({ time: t, value: vals[i] })).filter(d => isFinite(d.value)),
      );
    }

    // ── Flat Kijun price lines ────────────────────────────────────────
    flatLvl.forEach((lvl) => {
      candleSeries.createPriceLine({
        price: lvl,
        color: "rgba(251,191,36,0.7)",
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: isKo ? "Kijun S/R" : "Kijun S/R",
      });
    });

    // ── HIGH-QUALITY TK Cross markers only ───────────────────────────
    // Only show crosses that happen outside the cloud (highest reliability)
    const markers: SeriesMarker<UTCTimestamp>[] = [];
    for (let i = 2; i < candles.length; i++) {
      const t0 = ich.tenkan[i-1], k0 = ich.kijun[i-1];
      const t1 = ich.tenkan[i],   k1 = ich.kijun[i];
      if (!isFinite(t0)||!isFinite(k0)||!isFinite(t1)||!isFinite(k1)) continue;

      const a = ich.spanA[i], b = ich.spanB[i];
      const cloudTop = isFinite(a) && isFinite(b) ? Math.max(a, b) : NaN;
      const cloudBot = isFinite(a) && isFinite(b) ? Math.min(a, b) : NaN;
      const pAbove = candles[i].close > cloudTop;
      const pBelow = candles[i].close < cloudBot;
      const vol_i  = candles[i].volume;
      const volma_i = volMA[i];
      const volOk  = isFinite(volma_i) ? vol_i >= volma_i * 1.0 : true;

      const isBullCross = t0 <= k0 && t1 > k1;
      const isBearCross = t0 >= k0 && t1 < k1;

      if (isBullCross && pAbove && volOk) {
        markers.push({
          time: toTs(candles[i].time), position: "belowBar",
          color: "#4ade80", shape: "arrowUp",
          text: isKo ? "✦TK↑" : "✦TK↑", size: 2,
        });
      } else if (isBullCross) {
        markers.push({
          time: toTs(candles[i].time), position: "belowBar",
          color: "#86efac", shape: "arrowUp", text: "TK↑", size: 1,
        });
      } else if (isBearCross && pBelow && volOk) {
        markers.push({
          time: toTs(candles[i].time), position: "aboveBar",
          color: "#f87171", shape: "arrowDown",
          text: isKo ? "✦TK↓" : "✦TK↓", size: 2,
        });
      } else if (isBearCross) {
        markers.push({
          time: toTs(candles[i].time), position: "aboveBar",
          color: "#fca5a5", shape: "arrowDown", text: "TK↓", size: 1,
        });
      }
    }
    if (markers.length) createSeriesMarkers(candleSeries, markers);

    chart.timeScale().fitContent();

    // ── Volume sub-chart ──────────────────────────────────────────────
    let volChart: IChartApi | null = null;
    if (volRef.current) {
      volChart = createChart(volRef.current, {
        width: volRef.current.clientWidth, height: 80,
        layout: { background: { color: "transparent" }, textColor: "#64748b", fontFamily: "ui-monospace, monospace" },
        grid: { vertLines: { color: "transparent" }, horzLines: { color: "rgba(51,65,85,0.15)" } },
        rightPriceScale: { borderColor: "rgba(51,65,85,0.4)", scaleMargins: { top: 0.1, bottom: 0 } },
        timeScale: { borderColor: "rgba(51,65,85,0.4)", timeVisible: true, secondsVisible: false },
        crosshair: { mode: CrosshairMode.Normal },
      });

      const volSeries = volChart.addSeries(HistogramSeries, {
        priceScaleId: "right", priceLineVisible: false, lastValueVisible: false,
      });
      volSeries.setData(candles.map((c, i) => {
        const ma  = volMA[i];
        const big = isFinite(ma) && c.volume > ma * 1.4;
        return {
          time:  toTs(c.time),
          value: c.volume,
          color: big
            ? (c.close >= c.open ? "rgba(74,222,128,0.8)" : "rgba(248,113,113,0.8)")
            : (c.close >= c.open ? "rgba(74,222,128,0.4)" : "rgba(248,113,113,0.4)"),
        };
      }));

      const volMASeries = volChart.addSeries(LineSeries, {
        color: `${tint}99`, lineWidth: 1, priceLineVisible: false,
        lastValueVisible: false, crosshairMarkerVisible: false,
      });
      volMASeries.setData(
        candles.map((c, i) => ({ time: toTs(c.time), value: volMA[i] })).filter(d => isFinite(d.value)),
      );

      volChart.timeScale().fitContent();

      // Sync time scales
      const priceTS = chart.timeScale();
      const volTS   = volChart.timeScale();
      const u1 = (r: ReturnType<typeof priceTS.getVisibleLogicalRange>) => { if (r) volTS.setVisibleLogicalRange(r); };
      const u2 = (r: ReturnType<typeof volTS.getVisibleLogicalRange>)   => { if (r) priceTS.setVisibleLogicalRange(r); };
      priceTS.subscribeVisibleLogicalRangeChange(u1);
      volTS.subscribeVisibleLogicalRangeChange(u2);
    }

    // ── Canvas cloud overlay ──────────────────────────────────────────
    const overlay = canvasRef.current;
    const latestRSI = rsiArr.filter(isFinite).at(-1) ?? 50;
    const setup = scoreSetup(candles, ich, rsiArr, atrArr, volMA, isKo);

    if (overlay) {
      const syncSize = () => {
        const rect = container.getBoundingClientRect();
        const dpr  = window.devicePixelRatio || 1;
        overlay.width  = rect.width  * dpr;
        overlay.height = rect.height * dpr;
        overlay.style.width  = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
        const ctx = overlay.getContext("2d")!;
        ctx.scale(dpr, dpr);
      };
      syncSize();

      const redraw = () => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          drawClouds(
            overlay, chart,
            (p) => candleSeries.priceToCoordinate(p),
            extTimes,
            ich.spanA, ich.spanB,
            latestRSI, setup, flatLvl,
          );
        });
      };

      redraw();
      chart.timeScale().subscribeVisibleLogicalRangeChange(redraw);
      chart.subscribeCrosshairMove(redraw);
    }

    const onResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
      if (volChart && volRef.current) volChart.applyOptions({ width: volRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
      chart.remove();
      if (volChart) volChart.remove();
      chartApiRef.current = null;
    };
  }, [candles, coin, isKo]);

  // ── Derived state ────────────────────────────────────────────────────────
  const closes  = candles.map(c => c.close);
  const rsiArr  = calcRSI(closes, 14);
  const atrArr  = calcATR(candles, 14);
  const volMA   = calcVolMA(candles.map(c => c.volume), 20);
  const ich     = candles.length > 0 ? calcIchimoku(candles, 9, 26) : null;
  const price   = closes.at(-1) ?? 0;
  const setup   = ich && candles.length > 0
    ? scoreSetup(candles, ich, rsiArr, atrArr, volMA, isKo)
    : null;

  const lastA = ich ? [...ich.spanA].filter(isFinite).at(-1) : NaN;
  const lastB = ich ? [...ich.spanB].filter(isFinite).at(-1) : NaN;
  const cloudTop = (lastA && lastB) ? Math.max(lastA, lastB) : NaN;
  const cloudBot = (lastA && lastB) ? Math.min(lastA, lastB) : NaN;
  const cloudPos = isFinite(cloudTop) && isFinite(cloudBot)
    ? price > cloudTop ? "above" : price < cloudBot ? "below" : "inside"
    : "inside";

  const flatLvl = ich ? detectFlatKijun(ich.kijun, price) : [];
  const rsiVal  = rsiArr.filter(isFinite).at(-1) ?? NaN;
  const chiClear = candles.length > 0 ? chikouIsClear(candles) : false;
  const lastVol = candles.at(-1)?.volume ?? 0;
  const lastVMA = volMA.filter(isFinite).at(-1) ?? 0;
  const volOk   = lastVol > lastVMA * 1.4;

  function fmt(p: number) {
    if (!isFinite(p) || p === 0) return "—";
    return p >= 1000 ? `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : `$${p.toFixed(4)}`;
  }
  function pct(a: number, b: number) {
    if (!isFinite(a) || !isFinite(b) || b === 0) return "";
    return `(${((a - b) / b * 100).toFixed(2)}%)`;
  }

  const starStr = setup ? "★".repeat(setup.stars) + "☆".repeat(5 - setup.stars) : "—";
  const dirColor = setup?.direction === "LONG" ? "#4ade80" : setup?.direction === "SHORT" ? "#f87171" : "#94a3b8";

  return (
    <section className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>{C.kicker}</p>
          <h2 className={styles.title}>{C.title}</h2>
          <p className={styles.hint}>{C.hint}</p>
        </div>
        <button className={styles.refreshBtn} onClick={load} disabled={loading}>
          {loading ? "⟳" : C.refresh}
        </button>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <span className={styles.ctrlLabel}>{C.coin}</span>
          <div className={styles.btnGroup}>
            {COINS.map(c => (
              <button
                key={c}
                className={`${styles.ctrlBtn} ${coin === c ? styles.ctrlBtnActive : ""}`}
                style={coin === c ? { borderColor: `${COIN_TINT[c]}80`, color: COIN_TINT[c] } : undefined}
                onClick={() => setCoin(c)}
              >{c}</button>
            ))}
          </div>
        </div>
        <div className={styles.controlGroup}>
          <span className={styles.ctrlLabel}>{C.tf}</span>
          <div className={styles.btnGroup}>
            {(["1h","4h","1D"] as TF[]).map(t => (
              <button key={t} className={`${styles.ctrlBtn} ${tf === t ? styles.ctrlBtnActive : ""}`}
                onClick={() => setTf(t)}>{t}
              </button>
            ))}
          </div>
        </div>

        {/* Quick status indicators */}
        <div className={styles.quickStatus}>
          <span className={`${styles.qBadge} ${cloudPos === "above" ? styles.qGreen : cloudPos === "below" ? styles.qRed : styles.qYellow}`}>
            {cloudPos === "above" ? C.above : cloudPos === "below" ? C.below : C.inside}
          </span>
          {chiClear && <span className={styles.qBadge + " " + styles.qGreen}>{C.chikou} ✓</span>}
          {volOk    && <span className={styles.qBadge + " " + styles.qGreen}>{C.volFilter} ✓</span>}
        </div>
      </div>

      {/* Setup panel */}
      {setup && setup.direction !== "NEUTRAL" && (
        <div className={`${styles.setupPanel} ${setup.direction === "LONG" ? styles.setupLong : styles.setupShort}`}>
          <div className={styles.setupLeft}>
            <div className={styles.setupScore}>
              <span className={styles.setupStars} style={{ color: dirColor }}>{starStr}</span>
              <span className={styles.setupLabel}>
                {C.score} {setup.score}/10 —{" "}
                <strong style={{ color: dirColor }}>
                  {setup.direction === "LONG" ? C.long : C.short}
                </strong>
                {" "}({setup.confidence === "HIGH" ? C.high : setup.confidence === "MEDIUM" ? C.medium : C.low})
              </span>
            </div>
            <div className={styles.setupReasons}>
              {setup.reasons.map((r, i) => <span key={i} className={styles.setupReason}>{r}</span>)}
              {setup.warnings.map((w, i) => <span key={`w${i}`} className={styles.setupWarning}>⚠ {w}</span>)}
            </div>
          </div>
          <div className={styles.setupRight}>
            <div className={styles.setupGrid}>
              <div className={styles.setupCell}>
                <span className={styles.setupCellLabel}>{C.entry}</span>
                <span className={styles.setupCellVal} style={{ color: "#38bdf8" }}>{fmt(setup.entry)}</span>
              </div>
              <div className={styles.setupCell}>
                <span className={styles.setupCellLabel}>{C.sl}</span>
                <span className={styles.setupCellVal} style={{ color: "#f87171" }}>
                  {fmt(setup.stopLoss)} <small>{pct(setup.stopLoss, setup.entry)}</small>
                </span>
              </div>
              <div className={styles.setupCell}>
                <span className={styles.setupCellLabel}>{C.tp1} (RR {setup.rr1.toFixed(1)})</span>
                <span className={styles.setupCellVal} style={{ color: "#4ade80" }}>
                  {fmt(setup.target1)} <small>{pct(setup.target1, setup.entry)}</small>
                </span>
              </div>
              <div className={styles.setupCell}>
                <span className={styles.setupCellLabel}>{C.tp2} (RR {setup.rr2.toFixed(1)})</span>
                <span className={styles.setupCellVal} style={{ color: "#86efac" }}>
                  {fmt(setup.target2)} <small>{pct(setup.target2, setup.entry)}</small>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No setup message */}
      {setup && setup.direction === "NEUTRAL" && (
        <div className={styles.neutralBox}>
          <span>⏳ {isKo ? "현재 명확한 셋업 없음 — 구름대 경계 돌파 또는 TK 크로스 대기" : "No clear setup — wait for cloud boundary break or TK cross"}</span>
        </div>
      )}

      {/* Flat Kijun levels */}
      {flatLvl.length > 0 && (
        <div className={styles.flatKijunBar}>
          <span className={styles.flatKijunLabel}>🟡 {C.flatKijun}:</span>
          {flatLvl.map((l, i) => (
            <span key={i} className={styles.flatKijunLevel}>{fmt(l)}</span>
          ))}
        </div>
      )}

      {/* Charts */}
      {loading ? (
        <div className={styles.loadingBox}><span className={styles.spinner} /><span>{C.loading}</span></div>
      ) : error ? (
        <div className={styles.loadingBox}><span style={{ color: "#f87171" }}>{C.error}</span></div>
      ) : (
        <>
          <div className={styles.chartWrap}>
            <div ref={chartRef} className={styles.chartInner} />
            <canvas ref={canvasRef} className={styles.cloudCanvas} />
          </div>
          <div className={styles.volWrap}>
            <span className={styles.volLabel}>
              VOL · {isKo ? "밝은색 = 평균 1.4× 이상 (신호 확인)" : "Bright = 1.4× above avg (signal confirmation)"}
            </span>
            <div ref={volRef} className={styles.volChart} />
          </div>
        </>
      )}

      {/* Legend */}
      {!loading && !error && (
        <div className={styles.legend}>
          {[
            { color: "#fb923c", label: C.legend.tenkan },
            { color: "#38bdf8", label: C.legend.kijun, thick: true },
            { color: "rgba(167,139,250,0.65)", label: C.legend.chikou, dashed: true },
            { color: "rgba(74,222,128,0.7)", label: C.legend.spanA },
            { color: "rgba(248,113,113,0.7)", label: C.legend.spanB },
            { color: "rgba(251,191,36,0.7)", label: C.legend.flatK, dashed: true },
            { color: "#38bdf8", label: C.legend.entry, dashed: true },
            { color: "#f87171", label: C.legend.sl, dashed: true },
            { color: "#4ade80", label: C.legend.tp, dashed: true },
          ].map(({ color, label, dashed, thick }) => (
            <span key={label} className={styles.legendItem}>
              <span className={styles.legendLine}
                style={{ borderTopStyle: dashed ? "dashed" : "solid",
                         borderTopColor: color, borderTopWidth: thick ? "2px" : "1px" }} />
              <span>{label}</span>
            </span>
          ))}
          <span className={styles.legendItem}>
            <span style={{ color: "#4ade80", fontSize: "0.7rem" }}>✦TK↑</span>
            <span>{isKo ? "구름 위 골든크로스" : "Golden cross above cloud"}</span>
          </span>
          <span className={styles.legendItem}>
            <span style={{ color: "#f87171", fontSize: "0.7rem" }}>✦TK↓</span>
            <span>{isKo ? "구름 아래 데드크로스" : "Dead cross below cloud"}</span>
          </span>
        </div>
      )}

      <p className={styles.infoNote}>{C.info}</p>
    </section>
  );
}
