"use client";

/**
 * FVG / OB 매물대 분석 패널
 * - 리스트 뷰: 현재가 기준 위/아래 구간 정렬
 * - 차트 뷰: lightweight-charts 캔들 + FVG/OB 박스 오버레이
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createChart,
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
  type Time,
} from "lightweight-charts";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import styles from "./FvgObPanel.module.css";

// ── Types ──────────────────────────────────────────────────────────────────
type Candle = { time: number; open: number; high: number; low: number; close: number };
type Zone = {
  type: "FVG" | "OB"; direction: "BULLISH" | "BEARISH";
  top: number; bottom: number; midpoint: number;
  formedAt: number; barsAgo: number;
  filled: boolean; partial: boolean;
};
type TF   = "1h" | "4h" | "1D";
type Coin = "BTC" | "ETH" | "SOL" | "XRP" | "BNB";
type ViewMode = "list" | "chart";

// ── Config ─────────────────────────────────────────────────────────────────
const COINS: Coin[] = ["BTC", "ETH", "SOL", "XRP", "BNB"];
const TFS = [
  { key: "1h" as TF,  label: "1H",  interval: "1h",  limit: 200 },
  { key: "4h" as TF,  label: "4H",  interval: "4h",  limit: 200 },
  { key: "1D" as TF,  label: "1D",  interval: "1d",  limit: 200 },
];
const OB_MOVE_THRESHOLD = 0.003;
const MAX_ZONES = 6;
const COIN_COLOR: Record<Coin, string> = {
  BTC: "#f7931a", ETH: "#627eea", SOL: "#14f195",
  XRP: "#00a3e0", BNB: "#f3ba2f",
};

// ── Rectangle Primitive ────────────────────────────────────────────────────
class RectPrimitive implements ISeriesPrimitive<Time> {
  constructor(
    private _chart: IChartApi,
    private _series: ISeriesApi<"Candlestick">,
    private _t1: UTCTimestamp,
    private _t2: UTCTimestamp,
    private _priceLow: number,
    private _priceHigh: number,
    private _fill: string,
    private _border: string,
  ) {}
  paneViews(): readonly IPrimitivePaneView[] {
    return [new RectView(
      this._chart, this._series,
      this._t1, this._t2, this._priceLow, this._priceHigh,
      this._fill, this._border,
    )];
  }
}
class RectView implements IPrimitivePaneView {
  constructor(
    private _c: IChartApi,
    private _s: ISeriesApi<"Candlestick">,
    private _t1: UTCTimestamp,
    private _t2: UTCTimestamp,
    private _lo: number,
    private _hi: number,
    private _fill: string,
    private _border: string,
  ) {}
  zOrder() { return "normal" as const; }
  renderer(): IPrimitivePaneRenderer {
    const { _c: c, _s: s, _t1: t1, _t2: t2, _lo: lo, _hi: hi, _fill: fill, _border: border } = this;
    return {
      draw(scope) {
        scope.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
          const ts = c.timeScale();
          const x1 = ts.timeToCoordinate(t1);
          const x2 = ts.timeToCoordinate(t2);
          const y1 = s.priceToCoordinate(hi);
          const y2 = s.priceToCoordinate(lo);
          if (x1 == null || x2 == null || y1 == null || y2 == null) return;
          const rx = Math.min(x1, x2) * hpr;
          const rw = Math.abs(x2 - x1) * hpr;
          const ry = Math.min(y1, y2) * vpr;
          const rh = Math.abs(y2 - y1) * vpr;
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

// ── Candle fetch ───────────────────────────────────────────────────────────
async function fetchCandles(coin: Coin, interval: string, limit: number): Promise<Candle[]> {
  try {
    const res = await fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${coin}USDT&interval=${interval}&limit=${limit}`,
      { cache: "no-store" }
    );
    const raw = await res.json() as Array<(string|number)[]>;
    return raw.map(k => ({
      time:  Number(k[0]),
      open:  parseFloat(k[1] as string),
      high:  parseFloat(k[2] as string),
      low:   parseFloat(k[3] as string),
      close: parseFloat(k[4] as string),
    }));
  } catch { return []; }
}

// ── FVG 탐지 ──────────────────────────────────────────────────────────────
function detectFVGs(candles: Candle[]): Zone[] {
  const zones: Zone[] = [];
  const n = candles.length;
  for (let i = 2; i < n; i++) {
    const c0 = candles[i - 2], c1 = candles[i - 1], c2 = candles[i];
    if (c2.low > c0.high) {
      const top = c2.low, bottom = c0.high, mid = (top + bottom) / 2;
      let filled = false, partial = false;
      for (let j = i + 1; j < n; j++) {
        if (candles[j].low <= mid)  { filled = true; break; }
        if (candles[j].low <= top)  { partial = true; }
      }
      zones.push({ type: "FVG", direction: "BULLISH", top, bottom, midpoint: mid,
        formedAt: c1.time, barsAgo: n - 1 - i, filled, partial });
    }
    if (c2.high < c0.low) {
      const top = c0.low, bottom = c2.high, mid = (top + bottom) / 2;
      let filled = false, partial = false;
      for (let j = i + 1; j < n; j++) {
        if (candles[j].high >= mid)    { filled = true; break; }
        if (candles[j].high >= bottom) { partial = true; }
      }
      zones.push({ type: "FVG", direction: "BEARISH", top, bottom, midpoint: mid,
        formedAt: c1.time, barsAgo: n - 1 - i, filled, partial });
    }
  }
  return zones;
}

// ── OB 탐지 ───────────────────────────────────────────────────────────────
function detectOBs(candles: Candle[]): Zone[] {
  const zones: Zone[] = [];
  const n = candles.length;
  for (let i = 0; i < n - 4; i++) {
    const c = candles[i];
    const isBear = c.close < c.open, isBull = c.close > c.open;
    const next = candles.slice(i + 1, i + 4);
    if (isBear) {
      const allUp = next.every(nc => nc.close > nc.open);
      const move  = (next[2].close - c.low) / c.low;
      if (allUp && move >= OB_MOVE_THRESHOLD) {
        const top = c.open, bottom = c.low, mid = (top + bottom) / 2;
        let filled = false, partial = false;
        for (let j = i + 4; j < n; j++) {
          if (candles[j].low <= bottom) { filled = true; break; }
          if (candles[j].low <= mid)    { partial = true; }
        }
        zones.push({ type: "OB", direction: "BULLISH", top, bottom, midpoint: mid,
          formedAt: c.time, barsAgo: n - 1 - i, filled, partial });
      }
    }
    if (isBull) {
      const allDn = next.every(nc => nc.close < nc.open);
      const move  = (c.high - next[2].close) / c.high;
      if (allDn && move >= OB_MOVE_THRESHOLD) {
        const top = c.high, bottom = c.open, mid = (top + bottom) / 2;
        let filled = false, partial = false;
        for (let j = i + 4; j < n; j++) {
          if (candles[j].high >= top) { filled = true; break; }
          if (candles[j].high >= mid) { partial = true; }
        }
        zones.push({ type: "OB", direction: "BEARISH", top, bottom, midpoint: mid,
          formedAt: c.time, barsAgo: n - 1 - i, filled, partial });
      }
    }
  }
  return zones;
}

// ── 필터 & 정렬 ────────────────────────────────────────────────────────────
function processZones(candles: Candle[], currentPrice: number) {
  const all = [...detectFVGs(candles), ...detectOBs(candles)].filter(z => !z.filled);
  return {
    resistance: all.filter(z => z.bottom > currentPrice).sort((a,b) => a.bottom - b.bottom).slice(0, MAX_ZONES),
    support:    all.filter(z => z.top < currentPrice).sort((a,b) => b.top - a.top).slice(0, MAX_ZONES),
    all:        all,
  };
}

// ── Format ─────────────────────────────────────────────────────────────────
const toTs = (ms: number): UTCTimestamp => Math.floor(ms / 1000) as UTCTimestamp;
function fmtP(p: number) { return p >= 1000 ? p.toLocaleString("en-US", { maximumFractionDigits: 0 }) : p >= 1 ? p.toFixed(2) : p.toFixed(6); }
function fmtPct(from: number, to: number) { const p = ((to - from) / from) * 100; return `${p >= 0 ? "+" : ""}${p.toFixed(2)}%`; }
function fmtAgo(b: number, tf: TF) { if (b === 0) return "방금"; const u = tf === "1h" ? "H" : tf === "4h" ? "4H" : "D"; return `${b}${u}`; }

// ── Zone Row (List) ────────────────────────────────────────────────────────
function ZoneRow({ zone, price, tf }: { zone: Zone; price: number; tf: TF }) {
  const isBull = zone.direction === "BULLISH";
  return (
    <div className={`${styles.zoneRow} ${isBull ? styles.zoneRowBull : styles.zoneRowBear}`}>
      <div className={styles.zoneBadges}>
        <span className={`${styles.typeBadge} ${zone.type === "FVG" ? styles.typeFvg : styles.typeOb}`}>{zone.type}</span>
        <span className={`${styles.dirArrow} ${isBull ? styles.dirUp : styles.dirDown}`}>{isBull ? "↑" : "↓"}</span>
      </div>
      <div className={styles.zoneRange}>
        <span className={styles.zoneTop}>{fmtP(zone.top)}</span>
        <span className={styles.zoneSep}>—</span>
        <span className={styles.zoneBot}>{fmtP(zone.bottom)}</span>
      </div>
      <div className={`${styles.zoneDist} ${isBull ? styles.zoneDistUp : styles.zoneDistDn}`}>
        {fmtPct(price, isBull ? zone.bottom : zone.top)}
      </div>
      <div className={styles.zoneFormed}>{fmtAgo(zone.barsAgo, tf)}</div>
      <div className={`${styles.zoneStatus} ${zone.partial ? styles.statusPartial : styles.statusOpen}`}>
        {zone.partial ? "부분" : "미체결"}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function FvgObPanel() {
  const { language } = useLanguage();
  const isKo = language === "ko";

  const [coin, setCoin]       = useState<Coin>("BTC");
  const [tf, setTf]           = useState<TF>("1h");
  const [view, setView]       = useState<ViewMode>("chart");
  const [loading, setLoad]    = useState(true);
  const [error, setError]     = useState(false);
  const [price, setPrice]     = useState(0);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [resistance, setRes]  = useState<Zone[]>([]);
  const [support, setSup]     = useState<Zone[]>([]);
  const [allZones, setAll]    = useState<Zone[]>([]);

  const chartContRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const rafRef       = useRef<number>(0);

  // ── 데이터 로드 ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoad(true); setError(false);
    const tfCfg = TFS.find(t => t.key === tf)!;
    const [priceData, cs] = await Promise.all([
      fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${coin}USDT`, { cache: "no-store" })
        .then(r => r.json()).then(d => parseFloat(d.markPrice)).catch(() => 0),
      fetchCandles(coin, tfCfg.interval, tfCfg.limit),
    ]);
    if (!cs.length) { setError(true); setLoad(false); return; }
    const cur = priceData || cs.at(-1)!.close;
    setPrice(cur);
    setCandles(cs);
    const { resistance: res, support: sup, all } = processZones(cs, cur);
    setRes(res); setSup(sup); setAll(all);
    setLoad(false);
  }, [coin, tf]);

  useEffect(() => { load(); }, [load]);

  // ── 차트 생성 & 구간 박스 ──────────────────────────────────────────────
  useEffect(() => {
    if (view !== "chart" || !chartContRef.current || !candles.length) return;
    const container = chartContRef.current;
    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    const chart = createChart(container, {
      width:  container.clientWidth,
      height: 420,
      layout: {
        background:  { color: "transparent" },
        textColor:   "#8aa3c2",
        fontFamily:  "JetBrains Mono, ui-monospace, monospace",
      },
      grid: {
        vertLines: { color: "rgba(125,211,252,0.06)" },
        horzLines: { color: "rgba(125,211,252,0.06)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(125,211,252,0.2)" },
      timeScale: { borderColor: "rgba(125,211,252,0.2)", timeVisible: true, secondsVisible: false },
    });
    chartRef.current = chart;

    // 캔들
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#86efac", downColor: "#fda4af",
      borderVisible: false, wickUpColor: "#86efac", wickDownColor: "#fda4af",
    });
    candleSeries.setData(candles.map(c => ({
      time: toTs(c.time), open: c.open, high: c.high, low: c.low, close: c.close,
    })));

    // 현재가 라인
    const priceLine = chart.addSeries(LineSeries, {
      color: COIN_COLOR[coin], lineWidth: 1, lineStyle: LineStyle.Dashed,
      priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false,
      title: "현재가",
    });
    if (candles.length >= 2) {
      const last2 = candles.slice(-2).map(c => ({ time: toTs(c.time), value: price }));
      priceLine.setData(last2);
    }

    // 현재가 price line 표시
    candleSeries.createPriceLine({
      price,
      color: COIN_COLOR[coin],
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: "",
    });

    // ── 구간 박스 그리기 ────────────────────────────────────────────────
    const lastTs = toTs(candles.at(-1)!.time);
    // 미래 방향으로 약간 연장 (3봉 정도)
    const dT = candles.length > 1 ? candles[1].time - candles[0].time : 3_600_000;
    const futureTs = (Math.floor(candles.at(-1)!.time / 1000) + dT * 3 / 1000) as UTCTimestamp;

    allZones.forEach(zone => {
      if (zone.filled) return;
      const t1 = toTs(zone.formedAt);
      const t2 = futureTs;
      const isBull = zone.direction === "BULLISH";
      const isFvg  = zone.type === "FVG";

      // 색상: FVG = 더 투명, OB = 더 진함
      const alpha = isFvg ? 0.18 : 0.28;
      const alphaPartial = zone.partial ? alpha * 0.5 : alpha;
      const fillColor   = isBull
        ? `rgba(134,239,172,${alphaPartial})`
        : `rgba(253,164,175,${alphaPartial})`;
      const borderColor = isBull
        ? `rgba(134,239,172,${alpha * 2})`
        : `rgba(253,164,175,${alpha * 2})`;

      const rect = new RectPrimitive(chart, candleSeries, t1, t2, zone.bottom, zone.top, fillColor, borderColor);
      candleSeries.attachPrimitive(rect);

      // 중간선(midpoint) 표시
      const midLine = chart.addSeries(LineSeries, {
        color: isBull ? "rgba(134,239,172,0.5)" : "rgba(253,164,175,0.5)",
        lineWidth: 1, lineStyle: LineStyle.Dotted,
        priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false,
      });
      midLine.setData([
        { time: t1, value: zone.midpoint },
        { time: t2, value: zone.midpoint },
      ]);
    });

    chart.timeScale().fitContent();

    const onResize = () => {
      if (chartContRef.current) chart.applyOptions({ width: chartContRef.current.clientWidth });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
      chart.remove();
      chartRef.current = null;
    };
  }, [view, candles, allZones, coin, price, tf]);

  const tint = COIN_COLOR[coin];

  return (
    <section className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>SUPPLY & DEMAND · 매물대</p>
          <h2 className={styles.title}>FVG / OB 매물대 분석</h2>
          <p className={styles.hint}>Fair Value Gap · Order Block — 미체결 구간만 표시, 현재가 기준 정렬</p>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          {/* 뷰 토글 */}
          <div className={styles.viewToggle}>
            <button className={`${styles.viewBtn} ${view === "chart" ? styles.viewBtnActive : ""}`}
              onClick={() => setView("chart")}>📈 {isKo ? "차트" : "Chart"}</button>
            <button className={`${styles.viewBtn} ${view === "list"  ? styles.viewBtnActive : ""}`}
              onClick={() => setView("list")}>📋 {isKo ? "목록" : "List"}</button>
          </div>
          <button className={styles.refreshBtn} onClick={load} disabled={loading}>
            {loading ? "⟳" : isKo ? "새로고침" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.ctrlGroup}>
          <span className={styles.ctrlLabel}>{isKo ? "코인" : "Coin"}</span>
          <div className={styles.btnRow}>
            {COINS.map(c => (
              <button key={c}
                className={`${styles.ctrlBtn} ${coin === c ? styles.ctrlBtnActive : ""}`}
                style={coin === c ? { borderColor: `${COIN_COLOR[c]}60`, color: COIN_COLOR[c] } : undefined}
                onClick={() => setCoin(c)}>{c}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.ctrlGroup}>
          <span className={styles.ctrlLabel}>{isKo ? "타임프레임" : "TF"}</span>
          <div className={styles.btnRow}>
            {TFS.map(t => (
              <button key={t.key}
                className={`${styles.ctrlBtn} ${tf === t.key ? styles.ctrlBtnActive : ""}`}
                onClick={() => setTf(t.key)}>{t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendBox} style={{ background: "rgba(134,239,172,0.35)", border: "1px solid rgba(134,239,172,0.6)" }} />
          OB ↑ 상승 주문블록
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendBox} style={{ background: "rgba(253,164,175,0.35)", border: "1px solid rgba(253,164,175,0.6)" }} />
          OB ↓ 하락 주문블록
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendBox} style={{ background: "rgba(134,239,172,0.18)", border: "1px dashed rgba(134,239,172,0.5)" }} />
          FVG ↑ 상승 공백
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendBox} style={{ background: "rgba(253,164,175,0.18)", border: "1px dashed rgba(253,164,175,0.5)" }} />
          FVG ↓ 하락 공백
        </span>
      </div>

      {loading && <div className={styles.loadingBox}><span className={styles.spinner} />매물대 계산 중...</div>}
      {!loading && error && <div className={styles.loadingBox} style={{ color: "#fda4af" }}>데이터 로드 실패</div>}

      {!loading && !error && (
        <>
          {/* ── 차트 뷰 ── */}
          {view === "chart" && (
            <div className={styles.chartWrap}>
              <div ref={chartContRef} className={styles.chartInner} />
              {/* 차트 아래 간략 구간 요약 */}
              <div className={styles.chartSummary}>
                <div className={styles.summaryGroup}>
                  <span className={styles.summaryTitle} style={{ color: "#fda4af" }}>▲ 저항 {resistance.length}개</span>
                  {resistance.slice(0, 3).map((z, i) => (
                    <span key={i} className={styles.summaryItem}>
                      <span className={`${styles.typeBadge} ${z.type === "FVG" ? styles.typeFvg : styles.typeOb}`}
                        style={{ fontSize: "0.55rem" }}>{z.type}</span>
                      {fmtP(z.bottom)}~{fmtP(z.top)}
                      <span style={{ color: "#fda4af" }}> {fmtPct(price, z.bottom)}</span>
                    </span>
                  ))}
                </div>
                <div className={styles.summaryPrice} style={{ color: tint }}>
                  ● {fmtP(price)}
                </div>
                <div className={styles.summaryGroup} style={{ alignItems: "flex-end" }}>
                  <span className={styles.summaryTitle} style={{ color: "#86efac" }}>▼ 지지 {support.length}개</span>
                  {support.slice(0, 3).map((z, i) => (
                    <span key={i} className={styles.summaryItem}>
                      <span className={`${styles.typeBadge} ${z.type === "FVG" ? styles.typeFvg : styles.typeOb}`}
                        style={{ fontSize: "0.55rem" }}>{z.type}</span>
                      {fmtP(z.bottom)}~{fmtP(z.top)}
                      <span style={{ color: "#86efac" }}> {fmtPct(price, z.top)}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── 목록 뷰 ── */}
          {view === "list" && (
            <div className={styles.zoneContainer}>
              <div className={styles.colHeader}>
                <span>타입</span><span>구간</span><span>거리</span><span>형성</span><span>상태</span>
              </div>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle} style={{ color: "#fda4af" }}>▲ 저항 (위)</span>
                <span className={styles.sectionCount}>{resistance.length}개</span>
              </div>
              {resistance.length === 0
                ? <p className={styles.noZone}>구간 없음</p>
                : <div className={styles.zoneList}>
                    {resistance.map((z, i) => <ZoneRow key={i} zone={z} price={price} tf={tf} />)}
                  </div>}
              <div className={styles.currentPriceLine}>
                <div className={styles.currentPriceDot} style={{ background: tint }} />
                <span className={styles.currentPriceLabel} style={{ color: tint }}>현재가</span>
                <span className={styles.currentPriceValue} style={{ color: tint }}>${fmtP(price)}</span>
                <div className={styles.currentPriceDot} style={{ background: tint }} />
              </div>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionTitle} style={{ color: "#86efac" }}>▼ 지지 (아래)</span>
                <span className={styles.sectionCount}>{support.length}개</span>
              </div>
              {support.length === 0
                ? <p className={styles.noZone}>구간 없음</p>
                : <div className={styles.zoneList}>
                    {support.map((z, i) => <ZoneRow key={i} zone={z} price={price} tf={tf} />)}
                  </div>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
