"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type CandlestickData,
  type UTCTimestamp,
} from "lightweight-charts";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import {
  formatRelativeTimeTech,
  formatPrice,
  type TechSignal,
  type TechSignalType,
} from "@/lib/technicalSignals";
import styles from "./TechChartModal.module.css";

const COIN_TINT: Record<string, string> = {
  BTC: "#f7931a", ETH: "#627eea", SOL: "#14f195", XRP: "#00a3e0",
  BNB: "#f3ba2f", ADA: "#0033ad", DOGE: "#c2a633", LTC: "#bfbbbb",
  TAO: "#7c3aed", WLD: "#06b6d4", ENA: "#ec4899", MAGIC: "#f59e0b",
  VIRTUAL: "#a78bfa", TURBO: "#fb923c",
};

const OKX_IV: Record<string, string>   = { "15m": "15m", "1h": "1H", "4h": "4H" };
const BYBIT_IV: Record<string, string> = { "15m": "15",  "1h": "60", "4h": "240" };

type Candle = { time: number; open: number; high: number; low: number; close: number; volume: number };

async function fetchCandles(symbol: string, tf: string, limit = 200): Promise<Candle[]> {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${tf}&limit=${limit}`, { cache: "no-store" });
    if (res.ok) {
      const raw: unknown[][] = await res.json();
      return raw.map((d) => ({ time: d[0] as number, open: parseFloat(d[1] as string), high: parseFloat(d[2] as string), low: parseFloat(d[3] as string), close: parseFloat(d[4] as string), volume: parseFloat(d[5] as string) }));
    }
  } catch { /* fall through */ }
  try {
    const id = symbol.replace("USDT", "-USDT");
    const res = await fetch(`https://www.okx.com/api/v5/market/candles?instId=${id}&bar=${OKX_IV[tf] ?? "1H"}&limit=${limit}`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      return (json.data as string[][]).reverse().map((d) => ({ time: parseInt(d[0]), open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]) }));
    }
  } catch { /* fall through */ }
  try {
    const res = await fetch(`https://api.bybit.com/v5/market/kline?symbol=${symbol}&interval=${BYBIT_IV[tf] ?? "60"}&limit=${limit}`, { cache: "no-store" });
    if (res.ok) {
      const json = await res.json();
      return (json.result?.list as string[][] ?? []).reverse().map((d) => ({ time: parseInt(d[0]), open: parseFloat(d[1]), high: parseFloat(d[2]), low: parseFloat(d[3]), close: parseFloat(d[4]), volume: parseFloat(d[5]) }));
    }
  } catch { /* fall through */ }
  return [];
}

const toTs = (ms: number): UTCTimestamp => Math.floor(ms / 1000) as UTCTimestamp;

const TYPE_LABEL_MAP: Record<TechSignalType, Record<"ko" | "en", string>> = {
  EMA_CROSS:  { ko: "EMA 크로스",  en: "EMA Cross"  },
  BB_SQUEEZE: { ko: "BB 스퀴즈",   en: "BB Squeeze" },
  VOL_SPIKE:  { ko: "거래량 급등", en: "Vol Spike"  },
  STOCH_RSI:  { ko: "Stoch RSI",  en: "Stoch RSI"  },
};

export default function TechChartModal({
  signal,
  onClose,
}: {
  signal: TechSignal;
  onClose: () => void;
}) {
  const { language } = useLanguage();
  const chartRef = useRef<HTMLDivElement>(null);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);

  const tint    = COIN_TINT[signal.base] ?? "#818cf8";
  const isBull  = signal.direction === "BULLISH";
  const isKo    = language === "ko";
  const typeLabel = TYPE_LABEL_MAP[signal.type][language];
  const desc    = isKo ? signal.descKo : signal.descEn;
  const detail  = buildDetail(signal, language);

  // ESC key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Fetch candles
  useEffect(() => {
    setLoadingChart(true);
    fetchCandles(signal.symbol, signal.timeframe).then((data) => {
      setCandles(data);
      setLoadingChart(false);
    });
  }, [signal.symbol, signal.timeframe]);

  // Draw chart
  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;
    const container = chartRef.current;

    const chart: IChartApi = createChart(container, {
      width: container.clientWidth,
      height: 400,
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
      timeScale: { borderColor: "rgba(51, 65, 85, 0.5)", timeVisible: true, secondsVisible: false },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#4ade80", downColor: "#f87171",
      borderVisible: false, wickUpColor: "#4ade80", wickDownColor: "#f87171",
    });

    const chartData: CandlestickData[] = candles.map((c) => ({
      time: toTs(c.time), open: c.open, high: c.high, low: c.low, close: c.close,
    }));
    candleSeries.setData(chartData);

    // EMA overlays
    if (signal.type === "EMA_CROSS" && signal.extra) {
      const ema20 = Number(signal.extra.ema20);
      const ema50 = Number(signal.extra.ema50);
      const ema200 = Number(signal.extra.ema200);

      if (Number.isFinite(ema20)) {
        // draw horizontal line for current EMA20
        candleSeries.createPriceLine({ price: ema20, color: "#38bdf8", lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "EMA20" });
      }
      if (Number.isFinite(ema50)) {
        candleSeries.createPriceLine({ price: ema50, color: "#818cf8", lineWidth: 1, lineStyle: LineStyle.Solid, axisLabelVisible: true, title: "EMA50" });
      }
      if (Number.isFinite(ema200)) {
        candleSeries.createPriceLine({ price: ema200, color: "#fbbf24", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "EMA200" });
      }
    }

    // BB Squeeze — show price lines for current BB
    if (signal.type === "BB_SQUEEZE" && signal.extra) {
      const widthNow = Number(signal.extra.widthNow);
      const price = signal.currentPrice;
      if (Number.isFinite(widthNow) && price > 0) {
        const upper = price * (1 + widthNow / 2 / 100);
        const lower = price * (1 - widthNow / 2 / 100);
        candleSeries.createPriceLine({ price: upper, color: "rgba(56, 189, 248, 0.6)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "BB Upper" });
        candleSeries.createPriceLine({ price: lower, color: "rgba(56, 189, 248, 0.6)", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: "BB Lower" });
      }
    }

    // Volume spike — mark the current price
    if (signal.type === "VOL_SPIKE") {
      candleSeries.createPriceLine({
        price: signal.currentPrice,
        color: isBull ? "#4ade80" : "#f87171",
        lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true,
        title: isKo ? "급등" : "Spike",
      });
    }

    // Stoch RSI — show current price level
    if (signal.type === "STOCH_RSI") {
      candleSeries.createPriceLine({
        price: signal.currentPrice,
        color: isBull ? "#4ade80" : "#f87171",
        lineWidth: 1, lineStyle: LineStyle.Dotted, axisLabelVisible: true,
        title: isBull ? (isKo ? "과매도 반등" : "Oversold") : (isKo ? "과매수 조정" : "Overbought"),
      });
    }

    chart.timeScale().fitContent();

    const onResize = () => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);
    return () => { window.removeEventListener("resize", onResize); chart.remove(); };
  }, [candles, signal, isBull, isKo]);

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
                {signal.direction !== "NEUTRAL" && (
                  <span className={`${styles.dirBadge} ${isBull ? styles.bull : styles.bear}`}>
                    {isBull ? "▲" : "▼"} {isBull ? (isKo ? "상승" : "Bull") : (isKo ? "하락" : "Bear")}
                  </span>
                )}
              </div>
              <p className={styles.subtitle}>
                <span className={styles.typeTag}>{typeLabel}</span>
                {signal.strength === "STRONG" && <span className={styles.strongTag}>★ STRONG</span>}
                <span className={styles.techBadge}>TECH</span>
              </p>
            </div>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </header>

        {/* Split body */}
        <div className={styles.splitBody}>
          {/* ── LEFT: Info ── */}
          <aside className={styles.infoPanel}>
            <p className={styles.infoLabel}>{signal.label}</p>
            <p className={styles.infoDesc}>{desc}</p>

            {/* Extra chips */}
            {signal.extra && Object.keys(signal.extra).length > 0 && (
              <div className={styles.extraGrid}>
                {Object.entries(signal.extra).map(([k, v]) => (
                  <div key={k} className={styles.extraCell}>
                    <span className={styles.extraKey}>{k}</span>
                    <strong className={styles.extraVal}>{v}</strong>
                  </div>
                ))}
              </div>
            )}

            {/* Key metrics */}
            <div className={styles.metricsGrid}>
              {detail.metrics.map((m) => (
                <div key={m.label} className={styles.metricCell}>
                  <span className={styles.metricLabel}>{m.label}</span>
                  <strong className={styles.metricValue}>{m.value}</strong>
                </div>
              ))}
            </div>

            {/* Checks */}
            <div className={styles.section}>
              <span className={styles.sectionLabel}>{isKo ? "판단 포인트" : "Decision Points"}</span>
              <ul className={styles.checkList}>
                {detail.checks.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>

            {/* Trigger / Invalidation */}
            <div className={styles.playbook}>
              <div className={styles.playbookRow}>
                <span className={styles.playbookLabel}>{isKo ? "트리거" : "Trigger"}</span>
                <p className={styles.playbookText}>{detail.trigger}</p>
              </div>
              <div className={styles.playbookRow}>
                <span className={styles.playbookLabel}>{isKo ? "무효화" : "Invalidation"}</span>
                <p className={styles.playbookText}>{detail.invalidation}</p>
              </div>
            </div>
          </aside>

          {/* ── RIGHT: Chart ── */}
          <div className={styles.chartArea}>
            {loadingChart ? (
              <div className={styles.chartLoading}>
                <span className={styles.spinner} />
                <p>{isKo ? "차트 불러오는 중…" : "Loading chart…"}</p>
              </div>
            ) : candles.length === 0 ? (
              <div className={styles.chartLoading}>
                <p>{isKo ? "차트 데이터를 불러올 수 없습니다" : "Chart data unavailable"}</p>
              </div>
            ) : (
              <div ref={chartRef} className={styles.priceChart} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Detail builder ────────────────────────────────────────────────────────
function buildDetail(signal: TechSignal, language: "ko" | "en") {
  const isKo = language === "ko";
  const isBull = signal.direction === "BULLISH";
  const extra = signal.extra ?? {};
  const read = (key: string, fallback = "-") => extra[key] === undefined ? fallback : String(extra[key]);

  const bias = signal.direction === "NEUTRAL"
    ? (isKo ? "중립 관찰" : "Neutral Watch")
    : isBull ? (isKo ? "상방 우위" : "Bullish Bias") : (isKo ? "하방 우위" : "Bearish Bias");

  const baseMetrics = [
    { label: isKo ? "심볼"     : "Symbol",    value: `${signal.base}/USDT` },
    { label: isKo ? "타임프레임": "Timeframe", value: signal.timeframe },
    { label: isKo ? "방향"     : "Direction", value: bias },
    { label: isKo ? "강도"     : "Strength",  value: signal.strength },
    { label: isKo ? "현재가"   : "Price",     value: `$${formatPrice(signal.currentPrice)}` },
    { label: isKo ? "탐지"     : "Detected",  value: formatRelativeTimeTech(signal.detectedAt, language) },
  ];

  if (signal.type === "EMA_CROSS") {
    const emaKeys = Object.keys(extra).filter((k) => k.startsWith("ema"));
    return {
      metrics: [...baseMetrics, ...emaKeys.map((k) => ({ label: k.toUpperCase(), value: `$${formatPrice(Number(extra[k]))}` }))],
      checks: [
        isKo ? "크로스 이후 종가가 느린 EMA 위/아래에서 유지되는지 확인" : "Check closes hold beyond the slow EMA after the cross",
        isKo ? "후속 캔들 거래량이 증가하면 신뢰도 상승" : "Rising follow-through volume improves conviction",
        isKo ? "상위 타임프레임 추세와 같은 방향이면 우선순위 높음" : "Higher-timeframe alignment increases priority",
      ],
      trigger: isBull ? (isKo ? "가격이 느린 EMA 위에서 재테스트를 지키면 추세 전환 후보" : "Held retest above slow EMA favors a trend-shift setup") : (isKo ? "가격이 느린 EMA 아래에서 반등 실패하면 조정 지속 후보" : "Failed retest below slow EMA favors downside continuation"),
      invalidation: isBull ? (isKo ? "종가가 다시 느린 EMA 아래로 내려가면 신호 약화" : "Close back below slow EMA weakens the signal") : (isKo ? "종가가 다시 느린 EMA 위로 회복하면 신호 약화" : "Close back above slow EMA weakens the signal"),
    };
  }

  if (signal.type === "BB_SQUEEZE") {
    const widthNow = Number(extra.widthNow), widthMin = Number(extra.widthMin);
    const expansion = Number.isFinite(widthNow) && Number.isFinite(widthMin) && widthMin > 0
      ? `${((widthNow / widthMin - 1) * 100).toFixed(1)}%` : "-";
    return {
      metrics: [...baseMetrics, { label: isKo ? "현재 밴드폭" : "Width Now", value: read("widthNow") }, { label: isKo ? "저점 밴드폭" : "Width Low", value: read("widthMin") }, { label: isKo ? "확장률" : "Expansion", value: expansion }],
      checks: [
        isKo ? "밴드폭이 최저 구간에서 벗어나는 첫 구간인지 확인" : "Verify this is an early expansion out of compressed bandwidth",
        isKo ? "중심선 위/아래 종가 유지가 방향 판단의 핵심" : "Closes holding above or below the midline define the bias",
        isKo ? "돌파 캔들에 거래량이 붙으면 추적 가치 상승" : "Breakout volume makes the setup more actionable",
      ],
      trigger: isBull ? (isKo ? "상단 밴드 돌파 후 중심선 위 종가 유지" : "Upper-band breakout with closes above the midline") : signal.direction === "BEARISH" ? (isKo ? "하단 밴드 이탈 후 중심선 아래 종가 유지" : "Lower-band break with closes below the midline") : (isKo ? "방향 확정 전까지 상하단 밴드 돌파를 대기" : "Wait for a clean upper or lower band break"),
      invalidation: isKo ? "밴드폭이 다시 수축하고 가격이 중심선으로 회귀하면 관찰 모드" : "If bandwidth contracts again and price returns to midline, downgrade to watch mode",
    };
  }

  if (signal.type === "VOL_SPIKE") {
    return {
      metrics: [...baseMetrics, { label: isKo ? "평균 대비 거래량" : "Volume Ratio", value: `${read("ratio")}x` }, { label: isKo ? "압력" : "Pressure", value: isBull ? (isKo ? "매수 우세" : "Buying") : (isKo ? "매도 우세" : "Selling") }],
      checks: [
        isKo ? "급등 캔들의 고가/저가가 다음 캔들에서 지켜지는지 확인" : "Check whether the spike candle high or low is respected next",
        isKo ? "꼬리가 길면 흡수 가능성이 있어 종가 위치가 중요" : "Long wicks can imply absorption, so close location matters",
        isKo ? "급등 이후 같은 방향 후속 캔들이 나오면 강도 상승" : "Same-direction follow-through after the spike raises conviction",
      ],
      trigger: isBull ? (isKo ? "급등 캔들 고가 돌파 또는 눌림 후 재돌파" : "Break above spike candle high, or reclaim it after a pullback") : (isKo ? "급등 캔들 저가 이탈 또는 반등 실패" : "Break below spike candle low, or fail a reclaim attempt"),
      invalidation: isBull ? (isKo ? "급등 캔들 저가를 종가로 이탈하면 매수 압력 훼손" : "Close below spike candle low invalidates buying pressure") : (isKo ? "급등 캔들 고가를 종가로 회복하면 매도 압력 훼손" : "Close above spike candle high invalidates selling pressure"),
    };
  }

  // Stoch RSI
  return {
    metrics: [...baseMetrics, { label: "Stoch K", value: read("k") }, { label: "Stoch D", value: read("d") }, { label: isKo ? "구간" : "Zone", value: isBull ? (isKo ? "과매도 반등" : "Oversold Bounce") : (isKo ? "과매수 조정" : "Overbought Pullback") }],
    checks: [
      isKo ? "K/D 교차 뒤 20/80 구간 밖으로 빠져나오는지 확인" : "Confirm K/D moves out of the 20/80 extreme after the cross",
      isKo ? "가격이 직전 스윙 고점/저점을 회복 또는 이탈해야 신뢰도 상승" : "Price needs to reclaim or lose the prior swing for confirmation",
      isKo ? "횡보장에서는 짧은 반응, 추세장에서는 되돌림 신호" : "In ranges it is a short reaction; in trends it is a pullback signal",
    ],
    trigger: isBull ? (isKo ? "K가 D 위에서 유지되고 가격이 직전 고점을 회복" : "K holds above D while price reclaims the prior swing high") : (isKo ? "K가 D 아래에서 유지되고 가격이 직전 저점을 이탈" : "K holds below D while price loses the prior swing low"),
    invalidation: isBull ? (isKo ? "K가 다시 D 아래로 내려가면 반등 신호 약화" : "K crossing back below D weakens the bounce setup") : (isKo ? "K가 다시 D 위로 올라오면 조정 신호 약화" : "K crossing back above D weakens the pullback setup"),
  };
}
