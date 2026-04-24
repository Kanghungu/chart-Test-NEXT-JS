"use client";

import { useEffect, useRef } from "react";
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type ISeriesPrimitive,
  type IPrimitivePaneView,
  type IPrimitivePaneRenderer,
  type UTCTimestamp,
  type SeriesMarker,
  type LineData,
  type CandlestickData,
  type Time,
} from "lightweight-charts";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { CryptoSignal } from "@/lib/cryptoSignals";
import styles from "./SignalChartModal.module.css";

const COIN_TINT: Record<string, string> = {
  BTC: "#f7931a", ETH: "#627eea", SOL: "#14f195",
  XRP: "#00a3e0", BNB: "#f3ba2f", ADA: "#0033ad",
  DOGE: "#c2a633",
};

const toTs = (ms: number): UTCTimestamp => Math.floor(ms / 1000) as UTCTimestamp;

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1)    return p.toFixed(3);
  if (p >= 0.01) return p.toFixed(4);
  return p.toFixed(6);
}

// ── Rectangle primitive ───────────────────────────────────────────────────
class RectanglePrimitive implements ISeriesPrimitive<Time> {
  constructor(
    private _chart: IChartApi,
    private _series: ISeriesApi<"Candlestick">,
    private _t1: UTCTimestamp,
    private _t2: UTCTimestamp,
    private _priceLow: number,
    private _priceHigh: number,
    private _fillColor: string,
    private _borderColor: string,
  ) {}

  paneViews(): readonly IPrimitivePaneView[] {
    return [new RectPaneView(this._chart, this._series, this._t1, this._t2, this._priceLow, this._priceHigh, this._fillColor, this._borderColor)];
  }
}

class RectPaneView implements IPrimitivePaneView {
  constructor(
    private _chart: IChartApi,
    private _series: ISeriesApi<"Candlestick">,
    private _t1: UTCTimestamp,
    private _t2: UTCTimestamp,
    private _priceLow: number,
    private _priceHigh: number,
    private _fillColor: string,
    private _borderColor: string,
  ) {}

  zOrder() { return "normal" as const; }

  renderer(): IPrimitivePaneRenderer {
    const chart = this._chart, series = this._series;
    const t1 = this._t1, t2 = this._t2;
    const pLow = this._priceLow, pHigh = this._priceHigh;
    const fill = this._fillColor, border = this._borderColor;

    return {
      draw(target) {
        target.useBitmapCoordinateSpace((scope) => {
          const ts = chart.timeScale();
          const x1 = ts.timeToCoordinate(t1);
          const x2 = ts.timeToCoordinate(t2);
          const yHi = series.priceToCoordinate(pHigh);
          const yLo = series.priceToCoordinate(pLow);
          if (x1 === null || x2 === null || yHi === null || yLo === null) return;
          const ctx = scope.context;
          const hpr = scope.horizontalPixelRatio;
          const vpr = scope.verticalPixelRatio;
          const rx = Math.min(x1, x2) * hpr;
          const rw = Math.abs(x2 - x1) * hpr;
          const ry = Math.min(yHi, yLo) * vpr;
          const rh = Math.abs(yLo - yHi) * vpr;
          ctx.fillStyle = fill;
          ctx.fillRect(rx, ry, rw, rh);
          ctx.strokeStyle = border;
          ctx.lineWidth = Math.max(1, Math.floor(hpr));
          ctx.strokeRect(rx, ry, rw, rh);
        });
      },
    };
  }
}

// ── Main Modal ────────────────────────────────────────────────────────────
export default function SignalChartModal({
  signal,
  onClose,
}: {
  signal: CryptoSignal;
  onClose: () => void;
}) {
  const { language } = useLanguage();
  const priceRef = useRef<HTMLDivElement>(null);
  const rsiRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!priceRef.current) return;
    const container = priceRef.current;
    const tint = COIN_TINT[signal.base] ?? "#64748b";

    const chart: IChartApi = createChart(container, {
      width: container.clientWidth,
      height: signal.viz.kind === "DIVERGENCE" ? 280 : 380,
      layout: {
        background: { color: "transparent" },
        textColor: "#cbd5e1",
        fontFamily: `"JetBrains Mono", ui-monospace, monospace`,
      },
      grid: {
        vertLines: { color: "rgba(51, 65, 85, 0.25)" },
        horzLines: { color: "rgba(51, 65, 85, 0.25)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(51, 65, 85, 0.5)" },
      timeScale: {
        borderColor: "rgba(51, 65, 85, 0.5)",
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#4ade80",
      downColor: "#f87171",
      borderVisible: false,
      wickUpColor: "#4ade80",
      wickDownColor: "#f87171",
    });

    const candleData: CandlestickData[] = signal.candles.map((c) => ({
      time: toTs(c.time),
      open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    candleSeries.setData(candleData);

    // Overlays
    if (signal.viz.kind === "HARMONIC") {
      const { points, przMin, przMax } = signal.viz;
      const lineSeries = chart.addSeries(LineSeries, {
        color: tint, lineWidth: 2, lineStyle: LineStyle.Solid,
        crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false,
      });
      const lineData: LineData[] = points
        .map((p) => ({ time: toTs(p.time), value: p.price }))
        .sort((a, b) => (a.time as number) - (b.time as number));
      lineSeries.setData(lineData);

      const markers: SeriesMarker<UTCTimestamp>[] = points.map((p, idx) => ({
        time: toTs(p.time),
        position: idx % 2 === 0 ? "belowBar" : "aboveBar",
        color: tint, shape: "circle", text: p.label ?? "", size: 2,
      }));
      createSeriesMarkers(candleSeries, markers);

      candleSeries.createPriceLine({ price: przMax, color: "#fbbf24", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "PRZ Max" });
      candleSeries.createPriceLine({ price: przMin, color: "#fbbf24", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "PRZ Min" });
    } else if (signal.viz.kind === "ZONE_BREAK") {
      const { zoneLow, zoneHigh, breakoutTime, zoneStartTime, zoneEndTime } = signal.viz;
      const zoneColor = signal.direction === "BULLISH" ? "#f87171" : "#4ade80";
      const fillColor   = hexToRgba(zoneColor, 0.18);
      const borderColor = hexToRgba(zoneColor, 0.85);
      const rect = new RectanglePrimitive(chart, candleSeries, toTs(zoneStartTime), toTs(zoneEndTime), zoneLow, zoneHigh, fillColor, borderColor);
      candleSeries.attachPrimitive(rect);
      candleSeries.createPriceLine({ price: zoneHigh, color: borderColor, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, lineVisible: false, title: language === "ko" ? "구간 상단" : "Zone High" });
      candleSeries.createPriceLine({ price: zoneLow,  color: borderColor, lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, lineVisible: false, title: language === "ko" ? "구간 하단" : "Zone Low" });
      createSeriesMarkers(candleSeries, [{
        time: toTs(breakoutTime),
        position: signal.direction === "BULLISH" ? "belowBar" : "aboveBar",
        color: signal.direction === "BULLISH" ? "#4ade80" : "#f87171",
        shape: signal.direction === "BULLISH" ? "arrowUp" : "arrowDown",
        text: language === "ko" ? "돌파" : "BREAK",
        size: 2,
      }]);
    } else if (signal.viz.kind === "DIVERGENCE") {
      const { pricePoints } = signal.viz;
      const divColor = signal.direction === "BULLISH" ? "#4ade80" : "#f87171";
      const isPred = Boolean(signal.isPrediction);
      const priceLine = chart.addSeries(LineSeries, {
        color: isPred ? hexToRgba(divColor, 0.55) : divColor,
        lineWidth: isPred ? 1 : 2,
        lineStyle: isPred ? LineStyle.Dotted : LineStyle.Dashed,
        crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false,
      });
      priceLine.setData(
        pricePoints.map((p) => ({ time: toTs(p.time), value: p.price }))
          .sort((a, b) => (a.time as number) - (b.time as number))
      );
      createSeriesMarkers(candleSeries, pricePoints.map((p) => ({
        time: toTs(p.time),
        position: signal.direction === "BULLISH" ? "belowBar" as const : "aboveBar" as const,
        color: isPred ? hexToRgba(divColor, 0.65) : divColor,
        shape: "circle" as const,
        text: p.label ?? "",
        size: isPred ? 1 : 2,
      })));
    }

    chart.timeScale().fitContent();

    // RSI sub-chart
    let rsiChart: IChartApi | null = null;
    if (signal.viz.kind === "DIVERGENCE" && rsiRef.current) {
      const { rsi, rsiPoints } = signal.viz;
      rsiChart = createChart(rsiRef.current!, {
        width: rsiRef.current.clientWidth,
        height: 140,
        layout: {
          background: { color: "transparent" },
          textColor: "#cbd5e1",
          fontFamily: `"JetBrains Mono", ui-monospace, monospace`,
        },
        grid: {
          vertLines: { color: "rgba(51, 65, 85, 0.25)" },
          horzLines: { color: "rgba(51, 65, 85, 0.25)" },
        },
        rightPriceScale: { borderColor: "rgba(51, 65, 85, 0.5)" },
        timeScale: { borderColor: "rgba(51, 65, 85, 0.5)", timeVisible: true, secondsVisible: false },
      });
      const rsiSeries = rsiChart.addSeries(LineSeries, {
        color: "#818cf8", lineWidth: 2, priceLineVisible: false, lastValueVisible: true,
      });
      rsiSeries.setData(rsi.map((p) => ({ time: toTs(p.time), value: p.value })));
      rsiSeries.createPriceLine({ price: 70, color: "rgba(248, 113, 113, 0.4)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "70" });
      rsiSeries.createPriceLine({ price: 30, color: "rgba(74, 222, 128, 0.4)",  lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "30" });

      const divColor = signal.direction === "BULLISH" ? "#4ade80" : "#f87171";
      const isPred = Boolean(signal.isPrediction);
      const divLine = rsiChart.addSeries(LineSeries, {
        color: isPred ? hexToRgba(divColor, 0.55) : divColor,
        lineWidth: isPred ? 1 : 2,
        lineStyle: isPred ? LineStyle.Dotted : LineStyle.Dashed,
        crosshairMarkerVisible: false, priceLineVisible: false, lastValueVisible: false,
      });
      divLine.setData(
        rsiPoints.map((p) => ({ time: toTs(p.time), value: p.price }))
          .sort((a, b) => (a.time as number) - (b.time as number))
      );
      createSeriesMarkers(rsiSeries, rsiPoints.map((p) => ({
        time: toTs(p.time),
        position: signal.direction === "BULLISH" ? "aboveBar" as const : "belowBar" as const,
        color: isPred ? hexToRgba(divColor, 0.65) : divColor,
        shape: "circle" as const,
        text: p.label ?? "",
        size: isPred ? 1 : 2,
      })));

      rsiChart.timeScale().fitContent();

      const priceScale = chart.timeScale();
      const rsiScale = rsiChart.timeScale();
      priceScale.subscribeVisibleLogicalRangeChange((r) => { if (r) rsiScale.setVisibleLogicalRange(r); });
      rsiScale.subscribeVisibleLogicalRangeChange((r)   => { if (r) priceScale.setVisibleLogicalRange(r); });
    }

    const onResize = () => {
      if (priceRef.current) chart.applyOptions({ width: priceRef.current.clientWidth });
      if (rsiChart && rsiRef.current) rsiChart.applyOptions({ width: rsiRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.remove();
      if (rsiChart) rsiChart.remove();
    };
  }, [signal, language]);

  const typeLabel   = TYPE_LABEL[language][signal.type];
  const dirLabel    = signal.direction === "BULLISH" ? (language === "ko" ? "상승" : "Bullish") : (language === "ko" ? "하락" : "Bearish");
  const description = language === "ko" ? signal.descriptionKo : signal.descriptionEn;
  const tint        = COIN_TINT[signal.base] ?? "#64748b";
  const isBull      = signal.direction === "BULLISH";
  const metrics     = buildInfoMetrics(signal, language);
  const noteText    = detailNotes(signal, language);
  const isKo        = language === "ko";

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div
        className={styles.modal}
        onClick={(e) => e.stopPropagation()}
        style={{ "--tint": tint } as React.CSSProperties}
      >
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.tintBar} />
            <div>
              <div className={styles.titleRow}>
                <h2 className={styles.title}>
                  {signal.base}<span className={styles.pair}>/USDT</span>
                </h2>
                <span className={styles.tfBadge}>{signal.timeframe}</span>
                <span className={`${styles.dirBadge} ${isBull ? styles.bull : styles.bear}`}>
                  {isBull ? "▲" : "▼"} {dirLabel}
                </span>
              </div>
              <p className={styles.subtitle}>
                <span className={styles.typeTag}>{typeLabel}</span>
                {signal.patternName && <span className={styles.patternTag}>{signal.patternName}</span>}
                {signal.isPrediction && <span className={styles.predictionTag}>{isKo ? "⏳ 예측" : "⏳ Forecast"}</span>}
                {signal.strength === "STRONG" && <span className={styles.strongTag}>★ STRONG</span>}
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </header>

        {/* Split body: info left + chart right */}
        <div className={styles.splitBody}>
          {/* ── LEFT: Signal info ── */}
          <aside className={styles.infoPanel}>
            <p className={styles.infoDesc}>{description}</p>

            <div className={styles.metricsGrid}>
              {metrics.map((m) => (
                <div key={m.label} className={styles.metricCell}>
                  <span className={styles.metricLabel}>{m.label}</span>
                  <strong className={styles.metricValue}>{m.value}</strong>
                </div>
              ))}
            </div>

            {signal.viz.kind === "ZONE_BREAK" && (
              <div className={styles.infoBlock}>
                <span className={styles.infoBlockLabel}>{isKo ? "매물대 구간" : "Zone Range"}</span>
                <p className={styles.infoBlockText}>
                  ${formatPrice(signal.viz.zoneLow)} – ${formatPrice(signal.viz.zoneHigh)}
                </p>
              </div>
            )}

            {signal.przMin !== undefined && signal.przMax !== undefined && (
              <div className={styles.infoBlock}>
                <span className={styles.infoBlockLabel}>PRZ</span>
                <p className={styles.infoBlockText}>
                  ${formatPrice(signal.przMin)} – ${formatPrice(signal.przMax)}
                </p>
              </div>
            )}

            <div className={styles.infoNote}>
              <span className={styles.noteLabel}>{isKo ? "체크포인트" : "Checkpoint"}</span>
              <p className={styles.noteText}>{noteText}</p>
            </div>

            {/* Legend at bottom of info panel */}
            <div className={styles.infoLegend}>
              <LegendBlock signal={signal} language={language} />
            </div>
          </aside>

          {/* ── RIGHT: Charts ── */}
          <div className={styles.chartArea}>
            <div ref={priceRef} className={styles.priceChart} />
            {signal.viz.kind === "DIVERGENCE" && (
              <>
                <div className={styles.rsiLabel}>
                  RSI (14) · {isKo ? "다이버전스" : "Divergence"}
                  {signal.isPrediction ? (isKo ? " (예측)" : " (forming)") : ""}
                </div>
                <div ref={rsiRef} className={styles.rsiChart} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Info helpers ──────────────────────────────────────────────────────────
function buildInfoMetrics(signal: CryptoSignal, language: "ko" | "en") {
  const isKo = language === "ko";
  const rows = [
    { label: isKo ? "심볼"     : "Symbol",    value: `${signal.base}/USDT` },
    { label: isKo ? "타임프레임": "Timeframe", value: signal.timeframe },
    { label: isKo ? "방향"     : "Direction", value: signal.direction === "BULLISH" ? (isKo ? "상승" : "Bullish") : (isKo ? "하락" : "Bearish") },
    { label: isKo ? "강도"     : "Strength",  value: signal.strength },
    { label: isKo ? "현재가"   : "Price",     value: `$${formatPrice(signal.currentPrice)}` },
    { label: isKo ? "탐지"     : "Detected",  value: new Date(signal.detectedAt).toLocaleTimeString(isKo ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit" }) },
  ];
  if (signal.patternName) rows.splice(2, 0, { label: isKo ? "패턴" : "Pattern", value: signal.patternName });
  if (signal.viz.kind === "DIVERGENCE") {
    const latestRsi = signal.viz.rsi.at(-1)?.value;
    if (latestRsi !== undefined) rows.push({ label: "RSI", value: latestRsi.toFixed(1) });
  }
  return rows;
}

function detailNotes(signal: CryptoSignal, language: "ko" | "en"): string {
  const isKo = language === "ko";
  if (signal.type === "HARMONIC" || signal.type === "HARMONIC_PRZ") {
    return isKo
      ? "PRZ 구간 근처의 반전 반응과 캔들 확인이 핵심입니다. 예측 신호는 아직 완성 전 구간입니다."
      : "Watch price reaction near the PRZ. Predictive signals are not confirmed yet.";
  }
  if (signal.type === "DIVERGENCE") {
    return isKo
      ? "가격 고점/저점과 RSI 방향이 엇갈린 구간입니다. 추세 전환 가능성을 보조 신호와 함께 확인하세요."
      : "Price and RSI are diverging. Confirm with trend and volume before acting.";
  }
  return isKo
    ? "주요 매물대 돌파 또는 돌파 임박 구간입니다. 거래량과 종가 유지 여부가 중요합니다."
    : "This is a zone breakout or approach setup. Volume and close retention matter most.";
}

function LegendBlock({ signal, language }: { signal: CryptoSignal; language: "ko" | "en" }) {
  if (signal.viz.kind === "HARMONIC") {
    return (
      <div className={styles.legendGrid}>
        <LegendItem color="var(--tint)" label={language === "ko" ? "XABCD 피벗" : "XABCD Pivots"} />
        <LegendItem color="#fbbf24" label={language === "ko" ? "PRZ 구간 (반전 예상)" : "PRZ Zone (reversal expected)"} dashed />
      </div>
    );
  }
  if (signal.viz.kind === "ZONE_BREAK") {
    const bull = signal.direction === "BULLISH";
    return (
      <div className={styles.legendGrid}>
        <LegendItem color={bull ? "#f87171" : "#4ade80"} label={bull ? (language === "ko" ? "저항 매물대" : "Resistance zone") : (language === "ko" ? "지지 매물대" : "Support zone")} box />
        <LegendItem color={bull ? "#4ade80" : "#f87171"} label={language === "ko" ? "돌파 지점" : "Breakout point"} arrow />
      </div>
    );
  }
  const divLabel = signal.isPrediction
    ? (language === "ko" ? "다이버전스 추세선 (예측)" : "Divergence (forecast)")
    : (language === "ko" ? "다이버전스 추세선" : "Divergence trendline");
  return (
    <div className={styles.legendGrid}>
      <LegendItem color="#818cf8" label="RSI (14)" />
      <LegendItem color={signal.direction === "BULLISH" ? "#4ade80" : "#f87171"} label={divLabel} dashed />
    </div>
  );
}

function LegendItem({ color, label, dashed, arrow, box }: { color: string; label: string; dashed?: boolean; arrow?: boolean; box?: boolean }) {
  const hexToRgbaSafe = (hex: string, a: number) => {
    try { return hexToRgba(hex, a); } catch { return hex; }
  };
  const swatchStyle: React.CSSProperties = box
    ? { background: hexToRgbaSafe(color, 0.18), border: `1px solid ${hexToRgbaSafe(color, 0.85)}`, color }
    : { background: arrow ? "transparent" : color, borderTop: dashed ? `2px dashed ${color}` : undefined, color };
  return (
    <div className={styles.legendItem}>
      <span className={styles.legendSwatch} style={swatchStyle}>{arrow ? "▲" : ""}</span>
      <span>{label}</span>
    </div>
  );
}

const TYPE_LABEL: Record<"ko" | "en", Record<CryptoSignal["type"], string>> = {
  ko: {
    HARMONIC:      "하모닉",
    DIVERGENCE:    "다이버전스",
    ZONE_BREAK:    "매물대 돌파",
    HARMONIC_PRZ:  "⏳ PRZ 접근",
    ZONE_APPROACH: "⏳ 돌파 임박",
  },
  en: {
    HARMONIC:      "Harmonic",
    DIVERGENCE:    "Divergence",
    ZONE_BREAK:    "Zone Break",
    HARMONIC_PRZ:  "⏳ PRZ Watch",
    ZONE_APPROACH: "⏳ Breakout Soon",
  },
};
