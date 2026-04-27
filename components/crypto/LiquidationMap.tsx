"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import styles from "./LiquidationMap.module.css";

// ── Types ─────────────────────────────────────────────────────────────────
type LiqSide = "LONG" | "SHORT";
type LiqEvent = { symbol: string; price: number; usd: number; side: LiqSide; ts: number };
type Candle   = { openTime: number; open: number; high: number; low: number; close: number };
type LiquidationContextResponse = {
  candles?: Candle[];
  currentPrice?: number | null;
};

// ── Constants ─────────────────────────────────────────────────────────────
const COINS = ["BTC", "ETH", "SOL", "XRP", "BNB"] as const;
type Coin = (typeof COINS)[number];

const WINDOWS = [
  { label: "1h",  ms: 60 * 60_000,       interval: "1m",  limit: 90  },
  { label: "4h",  ms: 4  * 60 * 60_000,  interval: "1m",  limit: 240 },
  { label: "12h", ms: 12 * 60 * 60_000,  interval: "5m",  limit: 180 },
  { label: "24h", ms: 24 * 60 * 60_000,  interval: "5m",  limit: 300 },
] as const;

const PRICE_BUCKETS = 180;
const TIME_BUCKETS  = 260;
const MAX_AGE_MS    = 24 * 60 * 60_000;
const LEVERAGE_LEVELS = [100, 75, 50, 25, 10, 5] as const;

// ── Viridis-like color scale ───────────────────────────────────────────────
const COLOR_STOPS: [number, [number, number, number]][] = [
  [0.00, [15,   1,  35]],
  [0.12, [59,  28,  90]],
  [0.30, [33,  99, 133]],
  [0.52, [42, 170, 158]],
  [0.75, [122, 209,  81]],
  [1.00, [253, 231,  37]],
];

function heatColor(t: number): string {
  for (let i = 0; i < COLOR_STOPS.length - 1; i++) {
    const [t0, c0] = COLOR_STOPS[i];
    const [t1, c1] = COLOR_STOPS[i + 1];
    if (t <= t1) {
      const f = (t - t0) / (t1 - t0);
      const r = Math.round(c0[0] + f * (c1[0] - c0[0]));
      const g = Math.round(c0[1] + f * (c1[1] - c0[1]));
      const b = Math.round(c0[2] + f * (c1[2] - c0[2]));
      return `rgb(${r},${g},${b})`;
    }
  }
  return "rgb(253,231,37)";
}

// ── Canvas renderer ────────────────────────────────────────────────────────
function drawChart(
  canvas: HTMLCanvasElement,
  events: LiqEvent[],
  candles: Candle[],
  symbol: string,
  windowMs: number,
  currentPrice: number,
) {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW <= 0 || cssH <= 0) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width  = cssW * dpr;
  canvas.height = cssH * dpr;

  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const PAD_R = 68;
  const PAD_B = 28;
  const PAD_T = 8;
  const PAD_L = 4;
  const CW = cssW - PAD_L - PAD_R;
  const CH = cssH - PAD_T - PAD_B;

  const now       = Date.now();
  const timeStart = now - windowMs;

  // Price range: union of candle highs/lows + current price + liquidation prices
  const filteredEvents = events.filter(e => e.symbol === symbol && e.ts >= timeStart);
  const allPrices: number[] = [
    ...candles.flatMap(c => [c.high, c.low]),
    ...(isFinite(currentPrice) ? [currentPrice] : []),
    ...filteredEvents.map(e => e.price),
  ];

  // Background
  ctx.fillStyle = "#060d1f";
  ctx.fillRect(0, 0, cssW, cssH);

  if (allPrices.length === 0) return;

  const MARGIN = 0.012;
  const pMin   = Math.min(...allPrices) * (1 - MARGIN);
  const pMax   = Math.max(...allPrices) * (1 + MARGIN);
  const pRange = pMax - pMin;
  if (pRange === 0) return;

  const toX = (ts: number)  => PAD_L + ((ts - timeStart) / windowMs) * CW;
  const toY = (price: number) => PAD_T + (1 - (price - pMin) / pRange) * CH;

  // ── Build raw event grid ─────────────────────────────────────────────
  const rawGrid: number[][] = Array.from({ length: TIME_BUCKETS }, () =>
    new Array(PRICE_BUCKETS).fill(0),
  );

  for (const ev of filteredEvents) {
    const tx = Math.min(TIME_BUCKETS - 1, Math.floor(((ev.ts - timeStart) / windowMs) * TIME_BUCKETS));
    const py = Math.min(PRICE_BUCKETS - 1, Math.floor(((ev.price - pMin) / pRange) * PRICE_BUCKETS));
    if (tx >= 0 && py >= 0) rawGrid[tx][PRICE_BUCKETS - 1 - py] += ev.usd;
  }

  // ── Cumulative-forward grid (Coinglass-style: events persist rightward) ──
  // For each price row, run a decaying EMA so liquidation bands extend in time
  const DECAY = Math.exp(-2.5 / TIME_BUCKETS); // tune: lower = faster fade
  const grid: number[][] = Array.from({ length: TIME_BUCKETS }, () =>
    new Array(PRICE_BUCKETS).fill(0),
  );
  for (let py = 0; py < PRICE_BUCKETS; py++) {
    let ema = 0;
    for (let tx = 0; tx < TIME_BUCKETS; tx++) {
      ema = ema * DECAY + rawGrid[tx][py];
      grid[tx][py] = ema;
    }
  }

  const maxVal = Math.max(...grid.flatMap(col => col), 1);

  // ── Draw heatmap ─────────────────────────────────────────────────────
  const cellW = CW / TIME_BUCKETS;
  const cellH = CH / PRICE_BUCKETS;

  for (let tx = 0; tx < TIME_BUCKETS; tx++) {
    for (let py = 0; py < PRICE_BUCKETS; py++) {
      const v = grid[tx][py];
      if (v < maxVal * 0.005) continue; // skip near-zero cells
      const t = Math.pow(v / maxVal, 0.28);
      ctx.fillStyle = heatColor(t);
      ctx.fillRect(
        PAD_L + Math.floor(tx * cellW),
        PAD_T + Math.floor(py * cellH),
        Math.ceil(cellW) + 1,
        Math.ceil(cellH) + 1,
      );
    }
  }

  // ── Subtle grid lines ────────────────────────────────────────────────
  ctx.strokeStyle = "rgba(51,65,85,0.25)";
  ctx.lineWidth = 0.5;
  for (let i = 1; i < 5; i++) {
    const y = PAD_T + (CH / 5) * i;
    ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(PAD_L + CW, y); ctx.stroke();
  }
  for (let i = 1; i < 7; i++) {
    const x = PAD_L + (CW / 7) * i;
    ctx.beginPath(); ctx.moveTo(x, PAD_T); ctx.lineTo(x, PAD_T + CH); ctx.stroke();
  }

  // ── Candlesticks ──────────────────────────────────────────────────────
  if (candles.length > 0) {
    const relevantCandles = candles.filter(c => c.openTime >= timeStart - windowMs / 20);
    const spacing = CW / Math.max(relevantCandles.length, 1);
    const bodyW   = Math.max(2, spacing * 0.6);

    for (const c of relevantCandles) {
      const x     = toX(c.openTime) + spacing / 2;
      const isUp  = c.close >= c.open;
      const color = isUp ? "#4ade80" : "#f87171";

      ctx.strokeStyle = color;
      ctx.fillStyle   = isUp ? "#22c55e" : "#ef4444";
      ctx.lineWidth   = 1;

      // Wick
      ctx.beginPath();
      ctx.moveTo(x, toY(c.high));
      ctx.lineTo(x, toY(c.low));
      ctx.stroke();

      // Body
      const y1 = toY(Math.max(c.open, c.close));
      const y2 = toY(Math.min(c.open, c.close));
      ctx.fillRect(x - bodyW / 2, y1, bodyW, Math.max(1, y2 - y1));
    }
  }

  // ── Current price dashed line ─────────────────────────────────────────
  if (isFinite(currentPrice)) {
    const py = toY(currentPrice);
    if (py >= PAD_T && py <= PAD_T + CH) {
      ctx.strokeStyle = "rgba(56,189,248,0.9)";
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(PAD_L, py);
      ctx.lineTo(PAD_L + CW, py);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price tag background
      const tagW  = PAD_R - 4;
      const tagH  = 18;
      const tagX  = PAD_L + CW + 2;
      const tagY  = py - tagH / 2;
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath();
      ctx.roundRect(tagX, tagY, tagW, tagH, 3);
      ctx.fill();

      // Price tag text
      ctx.fillStyle  = "#0f172a";
      ctx.font       = "bold 10px 'SF Mono', ui-monospace, monospace";
      ctx.textAlign  = "center";
      ctx.textBaseline = "middle";
      const priceStr = currentPrice >= 1000
        ? Math.round(currentPrice).toLocaleString("en-US")
        : currentPrice.toFixed(3);
      ctx.fillText(`$${priceStr}`, tagX + tagW / 2, py);
    }
  }

  // ── Price axis (right) ────────────────────────────────────────────────
  ctx.fillStyle    = "rgba(100,116,139,0.85)";
  ctx.font         = "10px ui-monospace, monospace";
  ctx.textAlign    = "left";
  ctx.textBaseline = "middle";
  const pSteps = 6;
  for (let i = 0; i <= pSteps; i++) {
    const price = pMax - (pRange / pSteps) * i;
    const y     = PAD_T + (CH / pSteps) * i;
    const label = price >= 10000
      ? Math.round(price).toLocaleString("en-US")
      : price >= 100
        ? price.toFixed(0)
        : price.toFixed(2);
    ctx.fillText(label, PAD_L + CW + 4, y);
  }

  // ── Time axis (bottom) ────────────────────────────────────────────────
  ctx.fillStyle    = "rgba(100,116,139,0.85)";
  ctx.textAlign    = "center";
  ctx.textBaseline = "top";
  const tSteps = 6;
  for (let i = 0; i <= tSteps; i++) {
    const ts  = timeStart + (windowMs / tSteps) * i;
    const x   = PAD_L + (CW / tSteps) * i;
    const d   = new Date(ts);
    const hh  = d.getHours().toString().padStart(2, "0");
    const mm  = d.getMinutes().toString().padStart(2, "0");
    ctx.fillText(`${hh}:${mm}`, x, PAD_T + CH + 6);
  }
}

// ── Color legend bar ───────────────────────────────────────────────────────
function drawLeverageChart(
  canvas: HTMLCanvasElement,
  events: LiqEvent[],
  candles: Candle[],
  symbol: string,
  windowMs: number,
  currentPrice: number,
) {
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  if (cssW <= 0 || cssH <= 0) return;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;

  const ctx = canvas.getContext("2d")!;
  ctx.scale(dpr, dpr);

  const PAD_L = 10;
  const PAD_R = 74;
  const PAD_T = 34;
  const PAD_B = 58;
  const CW = cssW - PAD_L - PAD_R;
  const CH = cssH - PAD_T - PAD_B;
  const now = Date.now();
  const timeStart = now - windowMs;
  const visibleCandles = candles.filter((c) => c.openTime >= timeStart - windowMs / 20);
  const visibleEvents = events.filter((e) => e.symbol === symbol && e.ts >= timeStart);
  const anchor = Number.isFinite(currentPrice)
    ? currentPrice
    : visibleCandles[visibleCandles.length - 1]?.close;

  const allPrices = [
    ...visibleCandles.flatMap((c) => [c.high, c.low]),
    ...visibleEvents.map((e) => e.price),
    ...(Number.isFinite(anchor) ? [anchor] : []),
  ];

  ctx.fillStyle = "#020610";
  ctx.fillRect(0, 0, cssW, cssH);
  if (allPrices.length === 0) return;

  const low = Math.min(...allPrices);
  const high = Math.max(...allPrices);
  const center = Number.isFinite(anchor) ? anchor : (low + high) / 2;
  const pMin = Math.min(low, center * 0.955) * 0.985;
  const pMax = Math.max(high, center * 1.055) * 1.015;
  const pRange = pMax - pMin;
  if (pRange <= 0) return;

  const toX = (ts: number) => PAD_L + ((ts - timeStart) / windowMs) * CW;
  const toY = (price: number) => PAD_T + (1 - (price - pMin) / pRange) * CH;

  const bg = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + CH);
  bg.addColorStop(0, "#310640");
  bg.addColorStop(0.5, "#3c0651");
  bg.addColorStop(1, "#210331");
  ctx.fillStyle = bg;
  ctx.fillRect(PAD_L, PAD_T, CW, CH);

  const grid = Array.from({ length: TIME_BUCKETS }, () => new Array(PRICE_BUCKETS).fill(0));
  const maxRange = Math.max(
    ...visibleCandles.map((c) => Math.max(c.high - c.low, c.close * 0.0008)),
    1,
  );

  visibleCandles.forEach((c, index) => {
    const txStart = Math.max(0, Math.floor(((c.openTime - timeStart) / windowMs) * TIME_BUCKETS));
    if (txStart >= TIME_BUCKETS) return;

    const range = Math.max(c.high - c.low, c.close * 0.0008);
    const body = Math.abs(c.close - c.open);
    const impulse = 0.55 + Math.min(1.8, (range + body * 1.3) / maxRange);
    const ageBias = 0.48 + (index / Math.max(1, visibleCandles.length - 1)) * 0.7;

    for (const leverage of LEVERAGE_LEVELS) {
      const distance = 1 / leverage;
      const bandHalf = Math.max(1, Math.round(PRICE_BUCKETS * (0.0009 + distance * 0.016)));
      const reach = Math.max(
        18,
        Math.round(TIME_BUCKETS * (0.16 + (1 / Math.sqrt(leverage)) * 0.95) * ageBias),
      );
      const baseWeight = impulse * Math.pow(120 / leverage, 0.82);
      const levels = [
        { price: c.close * (1 + distance), weight: c.close < c.open ? 1.32 : 0.92 },
        { price: c.close * (1 - distance), weight: c.close >= c.open ? 1.32 : 0.92 },
      ];

      for (const level of levels) {
        if (level.price < pMin || level.price > pMax) continue;
        const pyCenter = Math.round((1 - (level.price - pMin) / pRange) * (PRICE_BUCKETS - 1));
        const txEnd = Math.min(TIME_BUCKETS, txStart + reach);

        for (let tx = txStart; tx < txEnd; tx++) {
          const fade = 0.34 + 0.66 * Math.pow(1 - (tx - txStart) / Math.max(1, reach), 0.26);
          const pulse = 0.87 + 0.13 * Math.sin((tx + index * 9 + leverage) * 0.17);
          for (let dy = -bandHalf; dy <= bandHalf; dy++) {
            const py = pyCenter + dy;
            if (py < 0 || py >= PRICE_BUCKETS) continue;
            const softness = 1 - Math.abs(dy) / (bandHalf + 1);
            grid[tx][py] += baseWeight * level.weight * fade * pulse * Math.pow(softness, 1.7);
          }
        }
      }
    }
  });

  for (const ev of visibleEvents) {
    const tx = Math.floor(((ev.ts - timeStart) / windowMs) * TIME_BUCKETS);
    const py = Math.floor((1 - (ev.price - pMin) / pRange) * PRICE_BUCKETS);
    if (tx < 0 || tx >= TIME_BUCKETS || py < 0 || py >= PRICE_BUCKETS) continue;
    for (let dx = -2; dx <= 8; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const gx = tx + dx;
        const gy = py + dy;
        if (gx >= 0 && gx < TIME_BUCKETS && gy >= 0 && gy < PRICE_BUCKETS) {
          grid[gx][gy] += Math.log10(ev.usd + 10) * 2.6;
        }
      }
    }
  }

  const maxVal = Math.max(...grid.flatMap((col) => col), 1);
  const cellW = CW / TIME_BUCKETS;
  const cellH = CH / PRICE_BUCKETS;

  for (let tx = 0; tx < TIME_BUCKETS; tx++) {
    for (let py = 0; py < PRICE_BUCKETS; py++) {
      const value = grid[tx][py];
      if (value <= 0.02) continue;
      ctx.fillStyle = heatColor(Math.pow(value / maxVal, 0.42));
      ctx.fillRect(
        PAD_L + Math.floor(tx * cellW),
        PAD_T + Math.floor(py * cellH),
        Math.ceil(cellW) + 1,
        Math.ceil(cellH) + 1,
      );
    }
  }

  ctx.strokeStyle = "rgba(7,13,30,0.36)";
  ctx.lineWidth = 0.5;
  for (let i = 1; i < 5; i++) {
    const y = PAD_T + (CH / 5) * i;
    ctx.beginPath();
    ctx.moveTo(PAD_L, y);
    ctx.lineTo(PAD_L + CW, y);
    ctx.stroke();
  }
  for (let i = 1; i < 8; i++) {
    const x = PAD_L + (CW / 8) * i;
    ctx.beginPath();
    ctx.moveTo(x, PAD_T);
    ctx.lineTo(x, PAD_T + CH);
    ctx.stroke();
  }

  const spacing = CW / Math.max(visibleCandles.length, 1);
  const bodyW = Math.max(1, Math.min(4, spacing * 0.6));
  for (const c of visibleCandles) {
    const x = toX(c.openTime) + spacing / 2;
    const isUp = c.close >= c.open;
    const color = isUp ? "#00e08a" : "#ff366d";
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, toY(c.high));
    ctx.lineTo(x, toY(c.low));
    ctx.stroke();
    const y1 = toY(Math.max(c.open, c.close));
    const y2 = toY(Math.min(c.open, c.close));
    ctx.fillRect(x - bodyW / 2, y1, bodyW, Math.max(1, y2 - y1));
  }

  if (Number.isFinite(currentPrice)) {
    const y = toY(currentPrice);
    ctx.strokeStyle = "rgba(56,189,248,0.9)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(PAD_L, y);
    ctx.lineTo(PAD_L + CW, y);
    ctx.stroke();
    ctx.setLineDash([]);

    const tagW = PAD_R - 5;
    const tagH = 18;
    const tagX = PAD_L + CW + 3;
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath();
    ctx.roundRect(tagX, y - tagH / 2, tagW, tagH, 3);
    ctx.fill();
    ctx.fillStyle = "#06111f";
    ctx.font = "bold 10px ui-monospace, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`$${Math.round(currentPrice).toLocaleString("en-US")}`, tagX + tagW / 2, y);
  }

  ctx.fillStyle = "rgba(210,219,239,0.78)";
  ctx.font = "11px ui-monospace, monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  for (let i = 0; i <= 6; i++) {
    const price = pMax - (pRange / 6) * i;
    const y = PAD_T + (CH / 6) * i;
    ctx.fillText(Math.round(price).toLocaleString("en-US"), PAD_L + CW + 6, y);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  for (let i = 0; i <= 7; i++) {
    const ts = timeStart + (windowMs / 7) * i;
    const x = PAD_L + (CW / 7) * i;
    const d = new Date(ts);
    const mm = d.getMinutes().toString().padStart(2, "0");
    ctx.fillText(`${d.getMonth() + 1}-${d.getDate()} ${d.getHours()}:${mm}`, x, PAD_T + CH + 8);
  }

  if (visibleCandles.length > 2) {
    const miniTop = PAD_T + CH + 34;
    const miniH = 18;
    ctx.fillStyle = "rgba(71,103,166,0.38)";
    ctx.beginPath();
    visibleCandles.forEach((c, i) => {
      const x = toX(c.openTime);
      const y = miniTop + miniH - ((c.close - pMin) / pRange) * miniH;
      if (i === 0) ctx.moveTo(x, miniTop + miniH);
      ctx.lineTo(x, y);
    });
    ctx.lineTo(PAD_L + CW, miniTop + miniH);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = "rgba(140,170,230,0.76)";
    ctx.beginPath();
    visibleCandles.forEach((c, i) => {
      const x = toX(c.openTime);
      const y = miniTop + miniH - ((c.close - pMin) / pRange) * miniH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  ctx.font = "bold 12px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#6c1f83";
  ctx.fillRect(PAD_L + CW * 0.43, 11, 10, 10);
  ctx.fillStyle = "#f2f5fb";
  ctx.fillText("청산 레버리지", PAD_L + CW * 0.43 + 15, 16);
  ctx.fillStyle = "#00e08a";
  ctx.fillRect(PAD_L + CW * 0.54, 11, 10, 10);
  ctx.fillStyle = "#f2f5fb";
  ctx.fillText("슈퍼차트", PAD_L + CW * 0.54 + 15, 16);
}

function ColorLegend() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const { width: W, height: H } = canvas;
    const grad = ctx.createLinearGradient(0, H, 0, 0);
    COLOR_STOPS.forEach(([t, [r, g, b]]) => {
      grad.addColorStop(t, `rgb(${r},${g},${b})`);
    });
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
  }, []);
  return <canvas ref={ref} width={10} height={100} style={{ width: 10, height: 100, borderRadius: 3 }} />;
}

// ── Copy ───────────────────────────────────────────────────────────────────
const COPY = {
  ko: {
    kicker:  "04 / LIQUIDATIONS",
    title:   "청산 히트맵",
    hint:    "Binance 실시간 청산 · 가격 × 시간 히트맵 · WebSocket 직접 연결",
    coin:    "코인",
    win:     "시간창",
    price:   "현재가",
    long:    "롱 청산",
    short:   "숏 청산",
    count:   "건수",
    live:    "LIVE",
    connecting: "연결 중",
    error:   "재연결 중",
    high:    "높음",
    low:     "낮음",
    info:    "히트맵: 시간대별 청산 규모 — 노란색(황색)일수록 청산 규모가 큼 · 초록/빨강 캔들 오버레이 · 파란 점선: 현재가",
  },
  en: {
    kicker:  "04 / LIQUIDATIONS",
    title:   "Liquidation Heatmap",
    hint:    "Binance real-time force orders · Price × Time heatmap · Live WebSocket",
    coin:    "Coin",
    win:     "Window",
    price:   "Mark Price",
    long:    "Long Liq",
    short:   "Short Liq",
    count:   "Events",
    live:    "LIVE",
    connecting: "Connecting",
    error:   "Reconnecting",
    high:    "High",
    low:     "Low",
    info:    "Heatmap: liquidation size by time — yellow = larger liquidations · Green/red candles overlay · Blue dashed: current price",
  },
} as const;

// ── Main Component ─────────────────────────────────────────────────────────
export default function LiquidationMap() {
  const { language } = useLanguage();
  const C = COPY[language];

  const [coin,         setCoin]         = useState<Coin>("BTC");
  const [winIdx,       setWinIdx]       = useState<number>(1); // default 4h
  const [events,       setEvents]       = useState<LiqEvent[]>([]);
  const [candles,      setCandles]      = useState<Candle[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(NaN);
  const [wsStatus,     setWsStatus]     = useState<"connecting" | "live" | "error">("connecting");

  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const wsRef      = useRef<WebSocket | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef     = useRef<number>(0);

  const win = WINDOWS[winIdx];

  // ── Candles ──────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const params = new URLSearchParams({
          symbol: `${coin}USDT`,
          interval: win.interval,
          limit: String(win.limit),
        });
        const url = `/api/liquidations/crypto?${params.toString()}`;
        const res = await fetch(url, { cache: "no-store" });
        const data = (await res.json()) as LiquidationContextResponse;
        if (!res.ok) throw new Error("Failed to load liquidation context");
        if (!cancelled) {
          setCandles(Array.isArray(data.candles) ? data.candles : []);
          if (typeof data.currentPrice === "number") setCurrentPrice(data.currentPrice);
        }
      } catch { /* silent */ }
    }
    setCandles([]);
    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [coin, win.interval, win.limit]);

  // ── WebSocket ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    function connect() {
      if (!active) return;
      wsRef.current?.close();
      const ws = new WebSocket("wss://fstream.binance.com/ws/!forceOrder@arr");
      wsRef.current = ws;
      setWsStatus("connecting");
      ws.onopen  = () => { if (active) setWsStatus("live"); };
      ws.onerror = () => { if (active) setWsStatus("error"); };
      ws.onclose = () => {
        if (!active) return;
        setWsStatus("error");
        retryTimer.current = setTimeout(connect, 5_000);
      };
      ws.onmessage = (evt) => {
        if (!active) return;
        try {
          const { o } = JSON.parse(evt.data as string);
          if (!o || o.X !== "FILLED") return;
          const price = parseFloat(o.p);
          const qty   = parseFloat(o.q);
          if (!isFinite(price) || !isFinite(qty)) return;
          const side: LiqSide = o.S === "SELL" ? "LONG" : "SHORT";
          const base = (o.s as string).replace("USDT", "").replace("BUSD", "").replace("PERP", "");
          setEvents(prev => {
            const cutoff = Date.now() - MAX_AGE_MS;
            return [
              ...prev.filter(e => e.ts >= cutoff),
              { symbol: base, price, usd: price * qty, side, ts: Date.now() },
            ];
          });
        } catch { /* malformed frame */ }
      };
    }
    connect();
    return () => {
      active = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      wsRef.current?.close();
    };
  }, []);

  // ── Draw canvas ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      drawLeverageChart(canvas, events, candles, coin, win.ms, currentPrice);
    });
  }, [events, candles, coin, win.ms, currentPrice]);

  // Responsive
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.parentElement) return;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        drawLeverageChart(canvas, events, candles, coin, win.ms, currentPrice);
      });
    });
    ro.observe(canvas.parentElement);
    return () => ro.disconnect();
  }, [events, candles, coin, win.ms, currentPrice]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const cutoff     = Date.now() - win.ms;
  const recent     = events.filter(e => e.symbol === coin && e.ts >= cutoff);
  const totalLong  = recent.filter(e => e.side === "LONG").reduce((s, e) => s + e.usd, 0);
  const totalShort = recent.filter(e => e.side === "SHORT").reduce((s, e) => s + e.usd, 0);

  function fmtUSD(v: number) {
    return v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(0)}K` : `$${v.toFixed(0)}`;
  }
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
        <div className={`${styles.wsBadge} ${styles[`ws_${wsStatus}`]}`}>
          <span className={styles.wsDot} />
          {C[wsStatus]}
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
                key={w.label}
                className={`${styles.ctrlBtn} ${winIdx === i ? styles.ctrlBtnActive : ""}`}
                onClick={() => setWinIdx(i)}
              >{w.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>{C.price}</span>
          <span className={styles.statValue}>{fmtPrice(currentPrice)}</span>
        </div>
        <div className={`${styles.statBox} ${styles.statLong}`}>
          <span className={styles.statLabel}>{C.long}</span>
          <span className={styles.statValue}>{fmtUSD(totalLong)}</span>
        </div>
        <div className={`${styles.statBox} ${styles.statShort}`}>
          <span className={styles.statLabel}>{C.short}</span>
          <span className={styles.statValue}>{fmtUSD(totalShort)}</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>{C.count}</span>
          <span className={styles.statValue}>{recent.length.toLocaleString()}</span>
        </div>
      </div>

      {/* Heatmap chart */}
      <div className={styles.chartWrap}>
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
