"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import {
  buildLiqHeatmap,
  type HeatmapResult,
  type WindowKey,
  TIME_BUCKETS,
  PRICE_BUCKETS,
} from "@/lib/liqHeatmap";
import styles from "./LiquidationMap.module.css";

// ── Constants ─────────────────────────────────────────────────────────────
const COINS = ["BTC", "ETH", "SOL", "XRP", "BNB"] as const;
type Coin = (typeof COINS)[number];

const WINDOWS: { label: string; key: WindowKey }[] = [
  { label: "1h",  key: "1h"  },
  { label: "4h",  key: "4h"  },
  { label: "12h", key: "12h" },
  { label: "24h", key: "24h" },
];

// ── Viridis colormap ───────────────────────────────────────────────────────
const COLOR_STOPS: [number, [number, number, number]][] = [
  [0.00, [15,   1,  35]],
  [0.10, [59,  28,  90]],
  [0.28, [33,  99, 133]],
  [0.50, [42, 170, 158]],
  [0.74, [122, 209,  81]],
  [1.00, [253, 231,  37]],
];

function heatColor(t: number): string {
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [t0, c0] = COLOR_STOPS[i];
    const [t1, c1] = COLOR_STOPS[i + 1];
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0);
      return `rgb(${Math.round(c0[0] + f * (c1[0] - c0[0]))},${Math.round(c0[1] + f * (c1[1] - c0[1]))},${Math.round(c0[2] + f * (c1[2] - c0[2]))})`;
    }
  }
  return "rgb(253,231,37)";
}

// ── Canvas renderer ────────────────────────────────────────────────────────
function renderHeatmap(canvas: HTMLCanvasElement, data: HeatmapResult) {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW <= 0 || cssH <= 0) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width  = cssW * dpr;
  canvas.height = cssH * dpr;

  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const PAD_L = 4;
  const PAD_R = 70;
  const PAD_T = 8;
  const PAD_B = 28;
  const CW = cssW - PAD_L - PAD_R;
  const CH = cssH - PAD_T - PAD_B;

  const { grid, pMin, pMax, timeStart, timeEnd, candles, currentPrice } = data;
  const pRange   = pMax - pMin;
  const timeRange = timeEnd - timeStart;

  const toX = (ts: number)    => PAD_L + ((ts - timeStart) / timeRange) * CW;
  const toY = (price: number) => PAD_T + (1 - (price - pMin) / pRange) * CH;

  // Background — very dark like Coinglass
  ctx.fillStyle = "#08040f";
  ctx.fillRect(0, 0, cssW, cssH);

  // ── Heatmap cells ─────────────────────────────────────────────────────
  let maxVal = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] > maxVal) maxVal = grid[i];
  }
  if (maxVal === 0) maxVal = 1;

  const cellW = CW / TIME_BUCKETS;
  const cellH = CH / PRICE_BUCKETS;
  // High contrast: dark background (like Coinglass), bright only at peaks
  const THRESHOLD = maxVal * 0.04; // cut bottom 4% → dark gaps between bands

  for (let tx = 0; tx < TIME_BUCKETS; tx++) {
    for (let py = 0; py < PRICE_BUCKETS; py++) {
      const v = grid[tx * PRICE_BUCKETS + py];
      if (v < THRESHOLD) continue;
      const norm = (v - THRESHOLD) / (maxVal - THRESHOLD); // re-normalize above threshold
      const t = Math.pow(norm, 1.6); // steep curve → dark→bright jump
      ctx.fillStyle = heatColor(t);
      ctx.fillRect(
        PAD_L + Math.floor(tx * cellW),
        PAD_T + Math.floor(py * cellH),
        Math.ceil(cellW) + 1,
        Math.ceil(cellH) + 1,
      );
    }
  }

  // ── Subtle grid ───────────────────────────────────────────────────────
  ctx.strokeStyle = "rgba(51,65,85,0.18)";
  ctx.lineWidth = 0.5;
  for (let i = 1; i < 6; i++) {
    const y = PAD_T + (CH / 6) * i;
    ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(PAD_L + CW, y); ctx.stroke();
  }
  for (let i = 1; i < 8; i++) {
    const x = PAD_L + (CW / 8) * i;
    ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, PAD_T + CH); ctx.stroke();
  }

  // ── Candlesticks ──────────────────────────────────────────────────────
  if (candles.length > 0) {
    const spacing = CW / candles.length;
    const bodyW   = Math.max(2, spacing * 0.55);

    for (const c of candles) {
      const x    = toX(c.ts) + spacing / 2;
      const isUp = c.close >= c.open;

      ctx.strokeStyle = isUp ? "rgba(74,222,128,0.9)" : "rgba(248,113,113,0.9)";
      ctx.fillStyle   = isUp ? "#22c55e" : "#ef4444";
      ctx.lineWidth   = 1;

      ctx.beginPath();
      ctx.moveTo(x, toY(c.high));
      ctx.lineTo(x, toY(c.low));
      ctx.stroke();

      const y1 = toY(Math.max(c.open, c.close));
      const y2 = toY(Math.min(c.open, c.close));
      ctx.fillRect(x - bodyW / 2, y1, bodyW, Math.max(1, y2 - y1));
    }
  }

  // ── Leverage liquidation level markers (현재가 기준) ─────────────────
  if (isFinite(currentPrice)) {
    const levMarkers = [
      { lev: 100, color: "rgba(253,231,37,0.5)"  },
      { lev: 50,  color: "rgba(122,209,81,0.4)"  },
      { lev: 20,  color: "rgba(42,170,158,0.3)"  },
      { lev: 10,  color: "rgba(33,99,133,0.25)"  },
    ];
    ctx.font         = "9px ui-monospace, monospace";
    ctx.textBaseline = "middle";

    for (const { lev, color } of levMarkers) {
      const longPrice  = currentPrice * (1 - 1 / lev);
      const shortPrice = currentPrice * (1 + 1 / lev);

      for (const [price, side] of [[longPrice, "L"], [shortPrice, "S"]] as const) {
        if (price < pMin || price > pMax) continue;
        const y = toY(price);
        ctx.strokeStyle = color;
        ctx.lineWidth   = 0.8;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(PAD_L, y);
        ctx.lineTo(PAD_L + CW, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle  = color;
        ctx.textAlign  = "right";
        ctx.fillText(`${lev}x${side}`, PAD_L + CW - 2, y);
      }
    }
  }

  // ── Current price line ────────────────────────────────────────────────
  if (isFinite(currentPrice) && currentPrice >= pMin && currentPrice <= pMax) {
    const py = toY(currentPrice);

    ctx.strokeStyle = "rgba(56,189,248,0.9)";
    ctx.lineWidth   = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD_L, py);
    ctx.lineTo(PAD_L + CW, py);
    ctx.stroke();
    ctx.setLineDash([]);

    const tagW = PAD_R - 4;
    const tagH = 18;
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.roundRect(PAD_L + CW + 2, py - tagH / 2, tagW, tagH, 3);
    ctx.fill();

    ctx.fillStyle    = "#0f172a";
    ctx.font         = "bold 10px ui-monospace, monospace";
    ctx.textAlign    = "center";
    ctx.textBaseline = "middle";
    const label = currentPrice >= 1000
      ? Math.round(currentPrice).toLocaleString("en-US")
      : currentPrice.toFixed(3);
    ctx.fillText(`$${label}`, PAD_L + CW + 2 + tagW / 2, py);
  }

  // ── Price axis ────────────────────────────────────────────────────────
  ctx.fillStyle    = "rgba(100,116,139,0.8)";
  ctx.font         = "10px ui-monospace, monospace";
  ctx.textAlign    = "left";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 6; i++) {
    const price = pMax - (pRange / 6) * i;
    const y     = PAD_T + (CH / 6) * i;
    const label = price >= 10000
      ? Math.round(price).toLocaleString("en-US")
      : price >= 100 ? price.toFixed(0)
      : price.toFixed(2);
    ctx.fillText(label, PAD_L + CW + 4, y);
  }

  // ── Time axis ─────────────────────────────────────────────────────────
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i <= 6; i++) {
    const ts = timeStart + (timeRange / 6) * i;
    const x  = PAD_L + (CW / 6) * i;
    const d  = new Date(ts);
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    ctx.fillText(`${hh}:${mm}`, x, PAD_T + CH + 6);
  }
}

// ── Color legend ───────────────────────────────────────────────────────────
function ColorLegend() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { width: W, height: H } = canvas;
    const grad = ctx.createLinearGradient(0, H, 0, 0);
    COLOR_STOPS.forEach(([t, [r, g, b]]) => grad.addColorStop(t, `rgb(${r},${g},${b})`));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }, []);
  return (
    <canvas ref={ref} width={10} height={110}
      style={{ width: 10, height: 110, borderRadius: 3, flexShrink: 0 }} />
  );
}

// ── Copy ───────────────────────────────────────────────────────────────────
const COPY = {
  ko: {
    kicker:  "04 / LIQUIDATIONS",
    title:   "청산 히트맵",
    hint:    "레버리지 포지션 추정 × 가격 × 시간 — Binance 공개 OI·롱숏 데이터 기반",
    coin:    "코인",
    win:     "시간창",
    price:   "현재가",
    liq:     "총 추정 청산",
    loading: "데이터 로딩 중...",
    error:   "데이터 로드 실패. 재시도 중...",
    high:    "높음",
    low:     "낮음",
    info:    "OI × 롱숏비율 × 레버리지 분포(5x·10x·20x·50x·100x)로 추정한 청산 가격대. Coinglass와 유사한 자체 계산 방식.",
  },
  en: {
    kicker:  "04 / LIQUIDATIONS",
    title:   "Liquidation Heatmap",
    hint:    "Estimated leverage positions × price × time — based on Binance public OI & long/short data",
    coin:    "Coin",
    win:     "Window",
    price:   "Mark Price",
    liq:     "Est. Liquidations",
    loading: "Loading data...",
    error:   "Failed to load. Retrying...",
    high:    "High",
    low:     "Low",
    info:    "Estimated liquidation price levels using OI × long/short ratio × leverage distribution (5x·10x·20x·50x·100x). Similar methodology to Coinglass.",
  },
} as const;

// ── Component ──────────────────────────────────────────────────────────────
export default function LiquidationMap() {
  const { language } = useLanguage();
  const C = COPY[language];

  const [coin,    setCoin]    = useState<Coin>("BTC");
  const [winIdx,  setWinIdx]  = useState<number>(1);
  const [data,    setData]    = useState<HeatmapResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef    = useRef<number>(0);

  const win = WINDOWS[winIdx];

  // ── Fetch & compute ────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const result = await buildLiqHeatmap(coin, win.key);
      if (result) {
        setData(result);
        setError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [coin, win.key]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60_000); // refresh every 5 min
    return () => clearInterval(t);
  }, [load]);

  // ── Draw canvas ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => renderHeatmap(canvas, data));
  }, [data]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement || !data) return;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => renderHeatmap(canvas, data));
    });
    ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, [data]);

  // ── Stats ──────────────────────────────────────────────────────────────
  function fmtPrice(p: number) {
    if (!isFinite(p)) return "—";
    return p >= 1000
      ? `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`
      : `$${p.toFixed(3)}`;
  }

  return (
    <section className={styles.panel}>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>{C.kicker}</p>
          <h2 className={styles.title}>{C.title}</h2>
          <p className={styles.hint}>{C.hint}</p>
        </div>
        <div className={`${styles.wsBadge} ${loading ? styles.ws_connecting : error ? styles.ws_error : styles.ws_live}`}>
          <span className={styles.wsDot} />
          {loading ? "로딩" : error ? "오류" : "LIVE"}
        </div>
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>{C.coin}</span>
          <div className={styles.btnGroup}>
            {COINS.map(c => (
              <button
                key={c}
                className={`${styles.ctrlBtn} ${coin === c ? styles.ctrlBtnActive : ""}`}
                onClick={() => setCoin(c)}
              >{c}</button>
            ))}
          </div>
        </div>
        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>{C.win}</span>
          <div className={styles.btnGroup}>
            {WINDOWS.map((w, i) => (
              <button
                key={w.key}
                className={`${styles.ctrlBtn} ${winIdx === i ? styles.ctrlBtnActive : ""}`}
                onClick={() => setWinIdx(i)}
              >{w.label}</button>
            ))}
          </div>
        </div>
        <button
          className={styles.ctrlBtn}
          onClick={load}
          disabled={loading}
          style={{ marginLeft: "auto" }}
        >
          {loading ? "⟳" : "새로고침"}
        </button>
      </div>

      {/* Stats */}
      {data && (
        <div className={styles.statsRow}>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>{C.price}</span>
            <span className={styles.statValue}>{fmtPrice(data.currentPrice)}</span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>가격 범위</span>
            <span className={styles.statValue} style={{ fontSize: "0.8rem" }}>
              {fmtPrice(data.pMin)} ~ {fmtPrice(data.pMax)}
            </span>
          </div>
          <div className={styles.statBox}>
            <span className={styles.statLabel}>캔들 수</span>
            <span className={styles.statValue}>{data.candles.length}</span>
          </div>
        </div>
      )}

      {/* Loading / Error */}
      {loading && (
        <div className={styles.loadingBox}>
          <span className={styles.spinner} />
          <span>{C.loading}</span>
        </div>
      )}
      {!loading && error && (
        <div className={styles.loadingBox}>
          <span style={{ color: "#f87171" }}>{C.error}</span>
        </div>
      )}

      {/* Heatmap */}
      <div className={styles.chartWrap} style={{ opacity: loading ? 0.4 : 1 }}>
        <div className={styles.legendBar}>
          <span className={styles.legendHigh}>{C.high}</span>
          <ColorLegend />
          <span className={styles.legendLow}>{C.low}</span>
        </div>
        <canvas ref={canvasRef} className={styles.canvas} />
      </div>

      <p className={styles.infoNote}>{C.info}</p>
    </section>
  );
}
