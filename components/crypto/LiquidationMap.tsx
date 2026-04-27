"use client";

import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import styles from "./LiquidationMap.module.css";

// ── Types ─────────────────────────────────────────────────────────────────
type LiqSide = "LONG" | "SHORT";

type LiqEvent = {
  symbol: string; // base only, e.g. "BTC"
  price: number;
  usd: number;
  side: LiqSide;
  ts: number;
};

type PriceBucket = {
  price: number;
  longUSD: number;
  shortUSD: number;
};

// ── Constants ─────────────────────────────────────────────────────────────
const COINS = ["BTC", "ETH", "SOL", "XRP", "BNB"] as const;
type Coin = (typeof COINS)[number];

const WINDOW_OPTIONS = [
  { value: 5,  label: "5m"  },
  { value: 15, label: "15m" },
  { value: 30, label: "30m" },
  { value: 60, label: "1h"  },
] as const;

const BUCKET_COUNT = 44;
const RANGE_PCT     = 0.08; // ±8% around current price
const MAX_AGE_MS    = 2 * 60 * 60 * 1000; // retain up to 2h of events

// ── Helpers ───────────────────────────────────────────────────────────────
function buildBuckets(
  events: LiqEvent[],
  symbol: string,
  currentPrice: number,
  windowMs: number,
): PriceBucket[] {
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return [];

  const cutoff    = Date.now() - windowMs;
  const filtered  = events.filter((e) => e.symbol === symbol && e.ts >= cutoff);

  const minPrice  = currentPrice * (1 - RANGE_PCT);
  const maxPrice  = currentPrice * (1 + RANGE_PCT);
  const bucketSize = (maxPrice - minPrice) / BUCKET_COUNT;

  const buckets: PriceBucket[] = Array.from({ length: BUCKET_COUNT }, (_, i) => ({
    price: minPrice + (i + 0.5) * bucketSize,
    longUSD: 0,
    shortUSD: 0,
  }));

  for (const ev of filtered) {
    const idx = Math.floor((ev.price - minPrice) / bucketSize);
    if (idx >= 0 && idx < BUCKET_COUNT) {
      if (ev.side === "LONG") buckets[idx].longUSD += ev.usd;
      else                    buckets[idx].shortUSD += ev.usd;
    }
  }

  return buckets.reverse(); // highest price first
}

function formatUSD(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

function formatPrice(p: number): string {
  if (!Number.isFinite(p)) return "—";
  if (p >= 10000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 1000)  return p.toLocaleString("en-US", { maximumFractionDigits: 1 });
  if (p >= 1)     return p.toFixed(3);
  return p.toFixed(5);
}

// ── Copy ──────────────────────────────────────────────────────────────────
const COPY = {
  ko: {
    kicker:      "04 / LIQUIDATIONS",
    title:       "청산 맵",
    hint:        "Binance 선물 실시간 청산 · 가격대별 롱/숏 집계 · WebSocket 직접 연결",
    coinLabel:   "코인",
    winLabel:    "시간창",
    currentPrice:"현재가",
    totalLong:   "롱 청산",
    totalShort:  "숏 청산",
    count:       "건수",
    longLabel:   "롱 청산 (가격 하락)",
    shortLabel:  "숏 청산 (가격 상승)",
    live:        "LIVE",
    connecting:  "연결 중",
    error:       "연결 실패 — 재시도 중",
    noData:      "현재가 로딩 중입니다. 잠시 기다려주세요.",
    waiting:     "청산 이벤트 대기 중 — 시장이 움직이면 자동으로 채워집니다",
    info:        "SELL 주문이 체결되면 롱 포지션이 청산된 것(가격 하락 방향). BUY 주문 체결은 숏 포지션 청산.",
  },
  en: {
    kicker:      "04 / LIQUIDATIONS",
    title:       "Liquidation Map",
    hint:        "Binance Futures real-time force orders · Aggregated by price level · Live WebSocket",
    coinLabel:   "Coin",
    winLabel:    "Window",
    currentPrice:"Mark Price",
    totalLong:   "Long Liq",
    totalShort:  "Short Liq",
    count:       "Events",
    longLabel:   "Long liquidations (price fell)",
    shortLabel:  "Short liquidations (price rose)",
    live:        "LIVE",
    connecting:  "Connecting",
    error:       "Reconnecting",
    noData:      "Loading current price...",
    waiting:     "Waiting for liquidation events — chart fills automatically as the market moves",
    info:        "SELL forced orders = long positions liquidated. BUY forced orders = short positions liquidated.",
  },
} as const;

// ── Component ─────────────────────────────────────────────────────────────
export default function LiquidationMap() {
  const { language } = useLanguage();
  const C = COPY[language];

  const [coin,         setCoin]         = useState<Coin>("BTC");
  const [windowMin,    setWindowMin]    = useState<number>(15);
  const [events,       setEvents]       = useState<LiqEvent[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(NaN);
  const [wsStatus,     setWsStatus]     = useState<"connecting" | "live" | "error">("connecting");

  const wsRef      = useRef<WebSocket | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Current price ──────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchPrice() {
      try {
        const res  = await fetch(
          `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${coin}USDT`,
          { cache: "no-store" },
        );
        const data = await res.json();
        if (!cancelled) setCurrentPrice(parseFloat(data.markPrice));
      } catch { /* silent */ }
    }

    fetchPrice();
    const t = setInterval(fetchPrice, 10_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [coin]);

  // ── WebSocket (global forceOrder stream) ───────────────────────────────
  useEffect(() => {
    let active = true;

    function connect() {
      if (!active) return;
      if (wsRef.current) wsRef.current.close();

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
          const msg   = JSON.parse(evt.data as string);
          const order = msg.o;
          if (!order || order.X !== "FILLED") return;

          const price = parseFloat(order.p);
          const qty   = parseFloat(order.q);
          if (!isFinite(price) || !isFinite(qty)) return;

          const usd    = price * qty;
          // Binance: SELL side = long liquidated; BUY side = short liquidated
          const side: LiqSide = order.S === "SELL" ? "LONG" : "SHORT";
          const base   = (order.s as string)
            .replace("USDT", "")
            .replace("BUSD", "")
            .replace("PERP", "");

          setEvents((prev) => {
            const cutoff = Date.now() - MAX_AGE_MS;
            return [...prev.filter((e) => e.ts >= cutoff), { symbol: base, price, usd, side, ts: Date.now() }];
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

  // ── Derived data ───────────────────────────────────────────────────────
  const windowMs      = windowMin * 60_000;
  const buckets       = buildBuckets(events, coin, currentPrice, windowMs);
  const maxUSD        = Math.max(...buckets.map((b) => Math.max(b.longUSD, b.shortUSD)), 1);

  const cutoff        = Date.now() - windowMs;
  const recentEvents  = events.filter((e) => e.symbol === coin && e.ts >= cutoff);
  const totalLongUSD  = recentEvents.filter((e) => e.side === "LONG").reduce((s, e) => s + e.usd, 0);
  const totalShortUSD = recentEvents.filter((e) => e.side === "SHORT").reduce((s, e) => s + e.usd, 0);
  const eventCount    = recentEvents.length;

  // ── Render ─────────────────────────────────────────────────────────────
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
          <span className={styles.controlLabel}>{C.coinLabel}</span>
          <div className={styles.btnGroup}>
            {COINS.map((c) => (
              <button
                key={c}
                className={`${styles.ctrlBtn} ${coin === c ? styles.ctrlBtnActive : ""}`}
                onClick={() => setCoin(c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.controlGroup}>
          <span className={styles.controlLabel}>{C.winLabel}</span>
          <div className={styles.btnGroup}>
            {WINDOW_OPTIONS.map((w) => (
              <button
                key={w.value}
                className={`${styles.ctrlBtn} ${windowMin === w.value ? styles.ctrlBtnActive : ""}`}
                onClick={() => setWindowMin(w.value)}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className={styles.statsRow}>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>{C.currentPrice}</span>
          <span className={styles.statValue}>${formatPrice(currentPrice)}</span>
        </div>
        <div className={`${styles.statBox} ${styles.statLong}`}>
          <span className={styles.statLabel}>{C.totalLong}</span>
          <span className={styles.statValue}>{formatUSD(totalLongUSD)}</span>
        </div>
        <div className={`${styles.statBox} ${styles.statShort}`}>
          <span className={styles.statLabel}>{C.totalShort}</span>
          <span className={styles.statValue}>{formatUSD(totalShortUSD)}</span>
        </div>
        <div className={styles.statBox}>
          <span className={styles.statLabel}>{C.count}</span>
          <span className={styles.statValue}>{eventCount.toLocaleString()}</span>
        </div>
      </div>

      {/* Map */}
      {!Number.isFinite(currentPrice) ? (
        <div className={styles.empty}>{C.noData}</div>
      ) : (
        <div className={styles.mapWrap}>
          {/* Legend */}
          <div className={styles.legend}>
            <span className={styles.legendLong}>← {C.longLabel}</span>
            <span className={styles.legendShort}>{C.shortLabel} →</span>
          </div>

          {/* Chart: [long bar] [price] [short bar] */}
          {eventCount === 0 && (
            <div className={styles.waitingOverlay}>{C.waiting}</div>
          )}
          <div className={styles.chart}>
            {buckets.map((bucket, i) => {
              const longPct  = (bucket.longUSD  / maxUSD) * 100;
              const shortPct = (bucket.shortUSD / maxUSD) * 100;
              const isCurrent = Number.isFinite(currentPrice) &&
                Math.abs(bucket.price - currentPrice) / currentPrice < (RANGE_PCT * 2 / BUCKET_COUNT);
              const hasData = bucket.longUSD > 0 || bucket.shortUSD > 0;

              return (
                <div
                  key={i}
                  className={`${styles.row} ${isCurrent ? styles.rowCurrent : ""}`}
                >
                  {/* Long side (left, red) */}
                  <div className={styles.longSide}>
                    {bucket.longUSD > 0 && (
                      <div
                        className={styles.longBar}
                        style={{ width: `${longPct}%` }}
                        title={`Long liq: ${formatUSD(bucket.longUSD)}`}
                      />
                    )}
                  </div>

                  {/* Price label (center) */}
                  <div className={styles.priceCell}>
                    {isCurrent && <span className={styles.currentMark}>▶</span>}
                    <span className={`${styles.priceLabel} ${isCurrent ? styles.priceLabelCurrent : ""} ${hasData ? styles.priceLabelActive : ""}`}>
                      {formatPrice(bucket.price)}
                    </span>
                  </div>

                  {/* Short side (right, green) */}
                  <div className={styles.shortSide}>
                    {bucket.shortUSD > 0 && (
                      <div
                        className={styles.shortBar}
                        style={{ width: `${shortPct}%` }}
                        title={`Short liq: ${formatUSD(bucket.shortUSD)}`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className={styles.infoNote}>{C.info}</p>
        </div>
      )}

    </section>
  );
}
