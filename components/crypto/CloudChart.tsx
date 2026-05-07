"use client";

/**
 * 모멘텀 구름대 (Momentum Cloud)
 *
 * 일반 일목균형표와의 차이점:
 *  1. RSI 모멘텀 틴팅 — RSI > 60 = 초록 구름 / 40~60 = 청록 / < 40 = 빨강
 *  2. 이중 구름 (Fast 7/14 + Standard 9/26) — 단기+중기 흐름을 동시에 표시
 *  3. 압력선 (Pressure Band) — 거래량 가중 중심가격선 (VWMA)
 *  4. 구름 강도 스코어 — 구름 두께를 가격 %로 환산한 저항·지지 강도
 *  5. TK 크로스 마커 — Tenkan↑Kijun 골든/데드 크로스 자동 표시
 *  6. 구름 위치 배지 — "구름 위 (강세)" / "구름 속 (관망)" / "구름 아래 (약세)"
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
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
type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };
type Coin   = "BTC" | "ETH" | "SOL" | "XRP" | "BNB";
type TF     = "1h" | "4h" | "1D";

// ── Config ─────────────────────────────────────────────────────────────────
const COINS: Coin[] = ["BTC", "ETH", "SOL", "XRP", "BNB"];
const COIN_TINT: Record<Coin, string> = {
  BTC: "#f7931a", ETH: "#627eea", SOL: "#14f195", XRP: "#00a3e0", BNB: "#f3ba2f",
};

const TF_CFG: Record<TF, { interval: string; limit: number }> = {
  "1h": { interval: "1h", limit: 200 },
  "4h": { interval: "4h", limit: 200 },
  "1D": { interval: "1d", limit: 200 },
};

// ── Math helpers ──────────────────────────────────────────────────────────
function periodHL(highs: number[], lows: number[], from: number, period: number) {
  const h = Math.max(...highs.slice(from, from + period));
  const l = Math.min(...lows.slice(from, from + period));
  return (h + l) / 2;
}

function calcIchimoku(candles: Candle[], tenkanP = 9, kijunP = 26) {
  const n   = candles.length;
  const hs  = candles.map(c => c.high);
  const ls  = candles.map(c => c.low);
  const disp = kijunP;
  const sbP  = kijunP * 2;

  const tenkan  = new Array(n).fill(NaN);
  const kijun   = new Array(n).fill(NaN);
  const spanA   = new Array(n + disp).fill(NaN);
  const spanB   = new Array(n + disp).fill(NaN);
  const chikou  = new Array(n).fill(NaN);

  for (let i = tenkanP - 1; i < n; i++)   tenkan[i] = periodHL(hs, ls, i - tenkanP + 1, tenkanP);
  for (let i = kijunP  - 1; i < n; i++)   kijun[i]  = periodHL(hs, ls, i - kijunP  + 1, kijunP);
  for (let i = kijunP  - 1; i < n; i++) {
    if (isFinite(tenkan[i]) && isFinite(kijun[i]))
      spanA[i + disp] = (tenkan[i] + kijun[i]) / 2;
  }
  for (let i = sbP - 1; i < n; i++)       spanB[i + disp] = periodHL(hs, ls, i - sbP + 1, sbP);
  for (let i = 0; i < n; i++)             chikou[i] = candles[i].close;

  return { tenkan, kijun, spanA, spanB, chikou };
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

/** 거래량 가중 이동평균 (VWMA) — 압력선 */
function calcVWMA(candles: Candle[], period = 20): number[] {
  const out = new Array(candles.length).fill(NaN);
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const sumPV = slice.reduce((s, c) => s + ((c.high + c.low + c.close) / 3) * c.volume, 0);
    const sumV  = slice.reduce((s, c) => s + c.volume, 0);
    out[i] = sumV > 0 ? sumPV / sumV : NaN;
  }
  return out;
}

/** 구름 강도 스코어: 구름 두께 / 현재가 * 100 */
function cloudStrength(spanA: number[], spanB: number[], currentPrice: number): number {
  const lastA = spanA.filter(isFinite).at(-1);
  const lastB = spanB.filter(isFinite).at(-1);
  if (!lastA || !lastB || currentPrice <= 0) return 0;
  return Math.abs(lastA - lastB) / currentPrice * 100;
}

// ── Canvas cloud renderer ─────────────────────────────────────────────────
interface CloudPoint { x: number; ya: number; yb: number }

function drawClouds(
  canvas: HTMLCanvasElement,
  chart: IChartApi,
  priceToY: (p: number) => number | null,
  times: UTCTimestamp[],
  fastA: number[], fastB: number[],
  stdA:  number[], stdB:  number[],
  rsi: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

  const ts = chart.timeScale();

  // RSI-based opacity/hue shift
  const rsiBlend = isFinite(rsi) ? Math.max(0, Math.min(1, (rsi - 40) / 20)) : 0.5;

  function drawLayer(
    spanA: number[],
    spanB: number[],
    opacity: number,
  ) {
    // Collect pixel coordinates
    const pts: CloudPoint[] = [];
    const extLen = Math.max(spanA.length, times.length);
    for (let i = 0; i < extLen; i++) {
      const a = spanA[i], b = spanB[i];
      if (!isFinite(a) || !isFinite(b)) continue;
      const t = times[Math.min(i, times.length - 1)];
      const x = ts.timeToCoordinate(t);
      const ya = priceToY(a);
      const yb = priceToY(b);
      if (x === null || ya === null || yb === null) continue;
      pts.push({ x, ya, yb });
    }

    if (pts.length < 2) return;

    // Split into segments (sign of A-B changes = cloud crossing)
    let seg = 0;
    while (seg < pts.length) {
      const isAAbove = pts[seg].ya < pts[seg].yb; // screen Y: smaller = higher
      let end = seg;
      while (end + 1 < pts.length) {
        const nextAbove = pts[end + 1].ya < pts[end + 1].yb;
        if (nextAbove !== isAAbove) break;
        end++;
      }

      // Draw filled segment
      ctx.beginPath();
      ctx.moveTo(pts[seg].x, pts[seg].ya);
      for (let i = seg + 1; i <= end; i++) ctx.lineTo(pts[i].x, pts[i].ya);
      for (let i = end; i >= seg; i--)     ctx.lineTo(pts[i].x, pts[i].yb);
      ctx.closePath();

      let r: number, g: number, b: number;
      if (isAAbove) {
        // Bullish cloud — RSI < 40 = dim, > 60 = bright green
        r = Math.round(74  + (1 - rsiBlend) * 100);
        g = Math.round(222 - (1 - rsiBlend) * 80);
        b = Math.round(128 - (1 - rsiBlend) * 80);
      } else {
        // Bearish cloud — RSI > 60 = dim, < 40 = bright red
        r = Math.round(248 - rsiBlend * 100);
        g = Math.round(113 + rsiBlend * 80);
        b = Math.round(113 + rsiBlend * 80);
      }
      ctx.fillStyle = `rgba(${r},${g},${b},${opacity})`;
      ctx.fill();

      seg = end + 1;
    }
  }

  // Standard cloud (outer, more transparent)
  drawLayer(stdA, stdB, 0.12);
  // Fast cloud (inner, stronger)
  drawLayer(fastA, fastB, 0.22);
}

// ── Fetch candles ─────────────────────────────────────────────────────────
async function fetchCandles(coin: Coin, tf: TF): Promise<Candle[]> {
  const { interval, limit } = TF_CFG[tf];
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${coin}USDT&interval=${interval}&limit=${limit}`;
  try {
    const res  = await fetch(url, { cache: "no-store" });
    const data = await res.json() as Array<(string | number)[]>;
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
    kicker:     "05 / MOMENTUM CLOUD",
    title:      "모멘텀 구름대",
    hint:       "RSI 색조 이중구름 (Fast 7/14 + Std 9/26) · 거래량 압력선 · TK 크로스 · 구름 강도",
    coin:       "코인",
    tf:         "봉",
    loading:    "구름대 로딩 중...",
    error:      "데이터 로드 실패",
    above:      "구름 위",
    inside:     "구름 속",
    below:      "구름 아래",
    bull:       "강세",
    neutral:    "관망",
    bear:       "약세",
    strength:   "구름 강도",
    rsi:        "RSI(14)",
    tenkan:     "Tenkan (전환선)",
    kijun:      "Kijun (기준선)",
    chikou:     "Chikou (후행스팬)",
    fastCloud:  "Fast 구름 (7/14)",
    stdCloud:   "Standard 구름 (9/26)",
    pressure:   "거래량 압력선 (VWMA20)",
    tkCross:    "TK 크로스",
    info:       "RSI > 60 = 초록 구름 · RSI 40~60 = 청록 · RSI < 40 = 빨강 · Fast 구름이 더 짙게 표시됩니다",
  },
  en: {
    kicker:     "05 / MOMENTUM CLOUD",
    title:      "Momentum Cloud",
    hint:       "RSI-tinted dual cloud (Fast 7/14 + Std 9/26) · Volume pressure line · TK cross · Cloud strength",
    coin:       "Coin",
    tf:         "TF",
    loading:    "Loading momentum cloud...",
    error:      "Failed to load data",
    above:      "Above Cloud",
    inside:     "In Cloud",
    below:      "Below Cloud",
    bull:       "Bullish",
    neutral:    "Neutral",
    bear:       "Bearish",
    strength:   "Cloud Strength",
    rsi:        "RSI(14)",
    tenkan:     "Tenkan (Conversion)",
    kijun:      "Kijun (Base)",
    chikou:     "Chikou (Lagging)",
    fastCloud:  "Fast Cloud (7/14)",
    stdCloud:   "Standard Cloud (9/26)",
    pressure:   "Volume Pressure (VWMA20)",
    tkCross:    "TK Cross",
    info:       "RSI > 60 = green cloud · RSI 40–60 = teal · RSI < 40 = red · Fast cloud rendered darker",
  },
} as const;

// ── Component ─────────────────────────────────────────────────────────────
export default function CloudChart() {
  const { language } = useLanguage();
  const C = COPY[language];

  const [coin,    setCoin]    = useState<Coin>("BTC");
  const [tf,      setTf]      = useState<TF>("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const canvasOverlayRef  = useRef<HTMLCanvasElement>(null);
  const chartRef          = useRef<IChartApi | null>(null);
  const rafRef            = useRef<number>(0);

  // ── Load candles ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true); setError(false);
    const data = await fetchCandles(coin, tf);
    if (data.length === 0) { setError(true); setLoading(false); return; }
    setCandles(data);
    setLoading(false);
  }, [coin, tf]);

  useEffect(() => { load(); }, [load]);

  // ── Build chart ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;
    const container = chartContainerRef.current;
    const tint      = COIN_TINT[coin];

    // Destroy old chart
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(container, {
      width:  container.clientWidth,
      height: 460,
      layout: {
        background:  { color: "transparent" },
        textColor:   "#94a3b8",
        fontFamily:  "ui-monospace, monospace",
      },
      grid: {
        vertLines: { color: "rgba(51,65,85,0.2)" },
        horzLines: { color: "rgba(51,65,85,0.2)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(51,65,85,0.4)" },
      timeScale: {
        borderColor:     "rgba(51,65,85,0.4)",
        timeVisible:     true,
        secondsVisible:  false,
      },
    });
    chartRef.current = chart;

    const toTs = (ms: number): UTCTimestamp => Math.floor(ms / 1000) as UTCTimestamp;

    // ── Compute indicators ───────────────────────────────────────────────
    const closes  = candles.map(c => c.close);
    const rsiArr  = calcRSI(closes, 14);
    const latestRSI = rsiArr.filter(isFinite).at(-1) ?? 50;

    const fast = calcIchimoku(candles, 7, 14);
    const std  = calcIchimoku(candles, 9, 26);
    const vwma = calcVWMA(candles, 20);

    // Extended time axis (for Senkou displacement)
    const dT = candles.length > 1 ? candles[1].time - candles[0].time : 3_600_000;
    const extTimes: UTCTimestamp[] = [];
    const stdDisp = 26, fastDisp = 14;
    const maxDisp = stdDisp;
    for (let i = 0; i < candles.length + maxDisp; i++) {
      extTimes.push(toTs(candles[0].time + i * dT));
    }

    // ── Candlestick series ───────────────────────────────────────────────
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:      "#4ade80",
      downColor:    "#f87171",
      borderVisible: false,
      wickUpColor:   "#4ade80",
      wickDownColor: "#f87171",
    });
    candleSeries.setData(
      candles.map(c => ({ time: toTs(c.time), open: c.open, high: c.high, low: c.low, close: c.close })),
    );

    // ── Tenkan-sen (전환선) — orange ─────────────────────────────────────
    const tenkanSeries = chart.addSeries(LineSeries, {
      color: "#fb923c", lineWidth: 1, lineStyle: LineStyle.Solid,
      priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
    });
    tenkanSeries.setData(
      candles
        .map((c, i) => ({ time: toTs(c.time), value: fast.tenkan[i] }))
        .filter(d => isFinite(d.value)),
    );

    // ── Kijun-sen (기준선) — sky blue ────────────────────────────────────
    const kijunSeries = chart.addSeries(LineSeries, {
      color: "#38bdf8", lineWidth: 1, lineStyle: LineStyle.Solid,
      priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
    });
    kijunSeries.setData(
      candles
        .map((c, i) => ({ time: toTs(c.time), value: std.kijun[i] }))
        .filter(d => isFinite(d.value)),
    );

    // ── Chikou Span (후행스팬) — purple ──────────────────────────────────
    const chikouSeries = chart.addSeries(LineSeries, {
      color: "rgba(167,139,250,0.7)", lineWidth: 1, lineStyle: LineStyle.Dotted,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    const chikouDisp = std.chikou.length > 0 ? 26 : 14;
    chikouSeries.setData(
      candles
        .slice(0, candles.length - chikouDisp)
        .map((_, i) => ({
          time: toTs(candles[i + chikouDisp].time),
          value: candles[i].close,
        }))
        .filter(d => isFinite(d.value)),
    );

    // ── Standard Senkou lines (edge lines of std cloud) ──────────────────
    const spanAStdSeries = chart.addSeries(LineSeries, {
      color: "rgba(74,222,128,0.4)", lineWidth: 1, lineStyle: LineStyle.Dotted,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    spanAStdSeries.setData(
      extTimes
        .map((t, i) => ({ time: t, value: std.spanA[i] }))
        .filter(d => isFinite(d.value)),
    );

    const spanBStdSeries = chart.addSeries(LineSeries, {
      color: "rgba(248,113,113,0.4)", lineWidth: 1, lineStyle: LineStyle.Dotted,
      priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
    });
    spanBStdSeries.setData(
      extTimes
        .map((t, i) => ({ time: t, value: std.spanB[i] }))
        .filter(d => isFinite(d.value)),
    );

    // ── Volume Pressure Line (VWMA20) — tint colored ─────────────────────
    const vwmaSeries = chart.addSeries(LineSeries, {
      color: `${tint}cc`, lineWidth: 2, lineStyle: LineStyle.Dashed,
      priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
      title: "VWMA",
    });
    vwmaSeries.setData(
      candles
        .map((c, i) => ({ time: toTs(c.time), value: vwma[i] }))
        .filter(d => isFinite(d.value)),
    );

    // ── TK Cross markers ─────────────────────────────────────────────────
    const tkMarkers: SeriesMarker<UTCTimestamp>[] = [];
    for (let i = 1; i < candles.length; i++) {
      const t0 = fast.tenkan[i - 1], k0 = fast.kijun[i - 1];
      const t1 = fast.tenkan[i],     k1 = fast.kijun[i];
      if (!isFinite(t0) || !isFinite(k0) || !isFinite(t1) || !isFinite(k1)) continue;
      const wasBelowT = t0 <= k0, isAboveT = t1 > k1;
      const wasAboveT = t0 >= k0, isBelowT = t1 < k1;
      if (wasBelowT && isAboveT) {
        tkMarkers.push({
          time: toTs(candles[i].time), position: "belowBar",
          color: "#4ade80", shape: "arrowUp", text: "TK↑", size: 1,
        });
      } else if (wasAboveT && isBelowT) {
        tkMarkers.push({
          time: toTs(candles[i].time), position: "aboveBar",
          color: "#f87171", shape: "arrowDown", text: "TK↓", size: 1,
        });
      }
    }
    if (tkMarkers.length > 0) createSeriesMarkers(candleSeries, tkMarkers);

    chart.timeScale().fitContent();

    // ── Canvas cloud overlay ─────────────────────────────────────────────
    const overlay = canvasOverlayRef.current;
    if (overlay) {
      const syncCanvas = () => {
        const rect = container.getBoundingClientRect();
        const dpr  = window.devicePixelRatio || 1;
        overlay.width  = rect.width  * dpr;
        overlay.height = rect.height * dpr;
        overlay.style.width  = `${rect.width}px`;
        overlay.style.height = `${rect.height}px`;
        const ctx = overlay.getContext("2d")!;
        ctx.scale(dpr, dpr);
      };
      syncCanvas();

      const priceToY = (p: number) => candleSeries.priceToCoordinate(p);

      const redraw = () => {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
          drawClouds(
            overlay, chart, priceToY,
            extTimes,
            fast.spanA, fast.spanB,
            std.spanA,  std.spanB,
            latestRSI,
          );
        });
      };

      redraw();
      chart.timeScale().subscribeVisibleLogicalRangeChange(redraw);
      chart.subscribeCrosshairMove(redraw);
    }

    // ── Resize ───────────────────────────────────────────────────────────
    const onResize = () => {
      if (!chartContainerRef.current) return;
      chart.applyOptions({ width: chartContainerRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
      chart.remove();
      chartRef.current = null;
    };
  }, [candles, coin]);

  // ── Derived state for UI ─────────────────────────────────────────────────
  const closes = candles.map(c => c.close);
  const rsiVal = calcRSI(closes, 14).at(-1) ?? NaN;
  const currentPrice = closes.at(-1) ?? 0;

  const std  = candles.length > 0 ? calcIchimoku(candles, 9, 26) : null;
  const lastA = std ? [...std.spanA].filter(isFinite).at(-1) : NaN;
  const lastB = std ? [...std.spanB].filter(isFinite).at(-1) : NaN;
  const strength = (lastA && lastB && currentPrice)
    ? Math.abs(lastA - lastB) / currentPrice * 100
    : NaN;

  let cloudPos: "above" | "inside" | "below" = "inside";
  if (lastA && lastB && currentPrice) {
    const cloudTop = Math.max(lastA, lastB);
    const cloudBot = Math.min(lastA, lastB);
    if (currentPrice > cloudTop)   cloudPos = "above";
    else if (currentPrice < cloudBot) cloudPos = "below";
  }

  const rsiState = isFinite(rsiVal)
    ? rsiVal > 60 ? "bull" : rsiVal < 40 ? "bear" : "neutral"
    : "neutral";

  const posLabel: Record<string, string> = {
    above:  `☁️ ${C.above} (${C.bull})`,
    inside: `☁️ ${C.inside} (${C.neutral})`,
    below:  `☁️ ${C.below} (${C.bear})`,
  };

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
          {loading ? "⟳" : "새로고침"}
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
            {(["1h", "4h", "1D"] as TF[]).map(t => (
              <button
                key={t}
                className={`${styles.ctrlBtn} ${tf === t ? styles.ctrlBtnActive : ""}`}
                onClick={() => setTf(t)}
              >{t}</button>
            ))}
          </div>
        </div>
      </div>

      {/* State strip */}
      {!loading && !error && candles.length > 0 && (
        <div className={styles.stateStrip}>
          <span className={`${styles.posBadge} ${styles[`pos_${cloudPos}`]}`}>
            {posLabel[cloudPos]}
          </span>
          <span className={`${styles.rsiBadge} ${styles[`rsi_${rsiState}`]}`}>
            RSI {isFinite(rsiVal) ? rsiVal.toFixed(1) : "—"}
          </span>
          {isFinite(strength) && (
            <span className={styles.strengthBadge}>
              {C.strength}: {strength.toFixed(2)}%
              <span className={styles.strengthBar}>
                <span
                  className={styles.strengthFill}
                  style={{ width: `${Math.min(100, strength * 10)}%` }}
                />
              </span>
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      {loading ? (
        <div className={styles.loadingBox}>
          <span className={styles.spinner} />
          <span>{C.loading}</span>
        </div>
      ) : error ? (
        <div className={styles.loadingBox}>
          <span style={{ color: "#f87171" }}>{C.error}</span>
        </div>
      ) : (
        <div className={styles.chartWrap}>
          <div ref={chartContainerRef} className={styles.chartInner} />
          <canvas ref={canvasOverlayRef} className={styles.cloudCanvas} />
        </div>
      )}

      {/* Legend */}
      {!loading && !error && (
        <div className={styles.legend}>
          <LegendItem color="#fb923c"                  label={C.tenkan} />
          <LegendItem color="#38bdf8"                  label={C.kijun} />
          <LegendItem color="rgba(167,139,250,0.7)"   label={C.chikou} dashed />
          <LegendItem color="rgba(74,222,128,0.7)"    label={C.fastCloud} box />
          <LegendItem color="rgba(74,222,128,0.35)"   label={C.stdCloud} box />
          <LegendItem color={COIN_TINT[coin]}          label={C.pressure} dashed />
          <LegendItem color="#4ade80"                  label={`${C.tkCross} ↑`} arrow />
          <LegendItem color="#f87171"                  label={`${C.tkCross} ↓`} arrowDown />
        </div>
      )}

      <p className={styles.infoNote}>{C.info}</p>
    </section>
  );
}

function LegendItem({
  color, label, dashed, box, arrow, arrowDown,
}: {
  color: string; label: string; dashed?: boolean; box?: boolean; arrow?: boolean; arrowDown?: boolean;
}) {
  return (
    <span className={styles.legendItem}>
      {box ? (
        <span className={styles.legendBox} style={{ background: color }} />
      ) : arrow ? (
        <span className={styles.legendArrow} style={{ color }}>▲</span>
      ) : arrowDown ? (
        <span className={styles.legendArrow} style={{ color }}>▼</span>
      ) : (
        <span
          className={styles.legendLine}
          style={{ borderTopStyle: dashed ? "dashed" : "solid", borderTopColor: color }}
        />
      )}
      <span>{label}</span>
    </span>
  );
}
