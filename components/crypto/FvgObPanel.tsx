"use client";

/**
 * FVG / OB 매물대 분석 패널
 *
 * FVG (Fair Value Gap / 공정가치 구간):
 *   3캔들 패턴 — 캔들[i-2].high < 캔들[i].low → 상승 FVG
 *                캔들[i-2].low  > 캔들[i].high → 하락 FVG
 *   midpoint까지 복귀 시 '체결' 처리
 *
 * OB (Order Block / 주문 블록):
 *   상승 OB: 마지막 하락 캔들 후 3봉 이상 연속 상승 + 일정 폭 이상
 *   하락 OB: 마지막 상승 캔들 후 3봉 이상 연속 하락 + 일정 폭 이상
 *   bottom까지 복귀(상승OB) 또는 top까지 복귀(하락OB) 시 '체결' 처리
 */

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import styles from "./FvgObPanel.module.css";

// ── Types ──────────────────────────────────────────────────────────────────
type Candle = { time: number; open: number; high: number; low: number; close: number };

type Zone = {
  type:       "FVG" | "OB";
  direction:  "BULLISH" | "BEARISH";
  top:        number;
  bottom:     number;
  midpoint:   number;
  formedAt:   number;     // 형성 캔들 시간 (ms)
  barsAgo:    number;     // 현재로부터 몇 봉 전
  filled:     boolean;
  partial:    boolean;    // midpoint 미만 복귀 여부
};

type TF = "1h" | "4h" | "1D";
type Coin = "BTC" | "ETH" | "SOL" | "XRP" | "BNB";

// ── Config ─────────────────────────────────────────────────────────────────
const COINS: Coin[] = ["BTC", "ETH", "SOL", "XRP", "BNB"];
const TFS: { key: TF; label: string; interval: string; limit: number }[] = [
  { key: "1h",  label: "1H",  interval: "1h",  limit: 200 },
  { key: "4h",  label: "4H",  interval: "4h",  limit: 200 },
  { key: "1D",  label: "1D",  interval: "1d",  limit: 200 },
];
const OB_MOVE_THRESHOLD = 0.003; // OB 인정 최소 이동폭 0.3%
const MAX_ZONES = 6;              // 위/아래 각 최대 표시 개수

const COIN_COLOR: Record<Coin, string> = {
  BTC: "#f7931a", ETH: "#627eea", SOL: "#14f195",
  XRP: "#00a3e0", BNB: "#f3ba2f",
};

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
    const c0 = candles[i - 2];
    const c1 = candles[i - 1]; // 중간 캔들 (FVG 형성 순간)
    const c2 = candles[i];

    // 상승 FVG: c0.high < c2.low → 둘 사이에 갭 존재
    if (c2.low > c0.high) {
      const top    = c2.low;
      const bottom = c0.high;
      const mid    = (top + bottom) / 2;

      // 이후 캔들에서 체결 여부 확인
      let filled = false, partial = false;
      for (let j = i + 1; j < n; j++) {
        if (candles[j].low <= mid)    { filled  = true; break; }
        if (candles[j].low <= top)    { partial = true; }
      }

      zones.push({
        type: "FVG", direction: "BULLISH",
        top, bottom, midpoint: mid,
        formedAt: c1.time, barsAgo: n - 1 - i,
        filled, partial,
      });
    }

    // 하락 FVG: c0.low > c2.high → 둘 사이에 갭 존재
    if (c2.high < c0.low) {
      const top    = c0.low;
      const bottom = c2.high;
      const mid    = (top + bottom) / 2;

      let filled = false, partial = false;
      for (let j = i + 1; j < n; j++) {
        if (candles[j].high >= mid)    { filled  = true; break; }
        if (candles[j].high >= bottom) { partial = true; }
      }

      zones.push({
        type: "FVG", direction: "BEARISH",
        top, bottom, midpoint: mid,
        formedAt: c1.time, barsAgo: n - 1 - i,
        filled, partial,
      });
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
    const isBear = c.close < c.open;
    const isBull = c.close > c.open;

    // 상승 OB: 하락 캔들 후 3봉 연속 상승 + 최소 이동폭
    if (isBear) {
      const next = candles.slice(i + 1, i + 4);
      const allUp = next.every(nc => nc.close > nc.open);
      const move  = (next[next.length - 1].close - c.low) / c.low;
      if (allUp && move >= OB_MOVE_THRESHOLD) {
        const top    = c.open;   // 하락 캔들 몸통 상단
        const bottom = c.low;    // 캔들 저가
        const mid    = (top + bottom) / 2;

        let filled = false, partial = false;
        for (let j = i + 4; j < n; j++) {
          if (candles[j].low <= bottom)     { filled  = true; break; }
          if (candles[j].low <= mid)        { partial = true; }
        }

        zones.push({
          type: "OB", direction: "BULLISH",
          top, bottom, midpoint: mid,
          formedAt: c.time, barsAgo: n - 1 - i,
          filled, partial,
        });
      }
    }

    // 하락 OB: 상승 캔들 후 3봉 연속 하락 + 최소 이동폭
    if (isBull) {
      const next = candles.slice(i + 1, i + 4);
      const allDn = next.every(nc => nc.close < nc.open);
      const move  = (c.high - next[next.length - 1].close) / c.high;
      if (allDn && move >= OB_MOVE_THRESHOLD) {
        const top    = c.high;   // 캔들 고가
        const bottom = c.open;   // 상승 캔들 몸통 하단

        const mid = (top + bottom) / 2;
        let filled = false, partial = false;
        for (let j = i + 4; j < n; j++) {
          if (candles[j].high >= top)    { filled  = true; break; }
          if (candles[j].high >= mid)    { partial = true; }
        }

        zones.push({
          type: "OB", direction: "BEARISH",
          top, bottom, midpoint: mid,
          formedAt: c.time, barsAgo: n - 1 - i,
          filled, partial,
        });
      }
    }
  }

  return zones;
}

// ── 유효 구간 필터 & 정렬 ──────────────────────────────────────────────────
function processZones(
  candles: Candle[],
  currentPrice: number,
): { resistance: Zone[]; support: Zone[] } {
  const fvgs = detectFVGs(candles);
  const obs  = detectOBs(candles);
  const all  = [...fvgs, ...obs].filter(z => !z.filled);

  // 저항 (현재가 위) — 가까운 순
  const resistance = all
    .filter(z => z.bottom > currentPrice)
    .sort((a, b) => a.bottom - b.bottom)
    .slice(0, MAX_ZONES);

  // 지지 (현재가 아래) — 가까운 순
  const support = all
    .filter(z => z.top < currentPrice)
    .sort((a, b) => b.top - a.top)
    .slice(0, MAX_ZONES);

  return { resistance, support };
}

// ── Format helpers ─────────────────────────────────────────────────────────
function fmtPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (p >= 1)    return p.toFixed(3);
  return p.toFixed(6);
}
function fmtPct(from: number, to: number): string {
  const pct = ((to - from) / from) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}
function fmtTimeAgo(barsAgo: number, tf: TF): string {
  if (barsAgo === 0) return "방금";
  const unit = tf === "1h" ? "시간" : tf === "4h" ? "4시간" : "일";
  return `${barsAgo}${unit} 전`;
}

// ── Copy ──────────────────────────────────────────────────────────────────
const COPY = {
  ko: {
    kicker:  "SUPPLY & DEMAND · 매물대",
    title:   "FVG / OB 매물대 분석",
    hint:    "Fair Value Gap · Order Block — 미체결 구간만 표시, 현재가 기준 정렬",
    tf:      "타임프레임", coin: "코인",
    resistance: "저항 (위)", support: "지지 (아래)",
    loading: "매물대 계산 중...", error: "데이터 로드 실패",
    noZone:  "구간 없음",
    partial: "부분체결", unfilled: "미체결",
    currentPrice: "현재가",
    topZone: "구간 상단", botZone: "구간 하단",
    distance: "거리",
    formed: "형성",
    fvgDesc: "FVG: 가격 공백 구간 (Price Imbalance)",
    obDesc:  "OB: 강한 이동 직전 주문 블록 (Order Block)",
    refresh: "새로고침",
  },
  en: {
    kicker:  "SUPPLY & DEMAND · ZONES",
    title:   "FVG / OB Zone Analysis",
    hint:    "Fair Value Gap · Order Block — unfilled zones only, sorted by proximity",
    tf:      "Timeframe", coin: "Coin",
    resistance: "Resistance (above)", support: "Support (below)",
    loading: "Calculating zones...", error: "Failed to load",
    noZone:  "No zones",
    partial: "Partial", unfilled: "Unfilled",
    currentPrice: "Current Price",
    topZone: "Zone Top", botZone: "Zone Bottom",
    distance: "Distance",
    formed: "Formed",
    fvgDesc: "FVG: Price imbalance (Fair Value Gap)",
    obDesc:  "OB: Last candle before strong move (Order Block)",
    refresh: "Refresh",
  },
} as const;

// ── Zone row component ─────────────────────────────────────────────────────
function ZoneRow({
  zone, currentPrice, tf, isKo,
}: { zone: Zone; currentPrice: number; tf: TF; isKo: boolean }) {
  const isFvg = zone.type === "FVG";
  const isBull = zone.direction === "BULLISH";

  return (
    <div className={`${styles.zoneRow} ${isBull ? styles.zoneRowBull : styles.zoneRowBear}`}>
      {/* 타입 배지 */}
      <div className={styles.zoneBadges}>
        <span className={`${styles.typeBadge} ${isFvg ? styles.typeFvg : styles.typeOb}`}>
          {zone.type}
        </span>
        <span className={`${styles.dirArrow} ${isBull ? styles.dirUp : styles.dirDown}`}>
          {isBull ? "↑" : "↓"}
        </span>
      </div>

      {/* 가격 범위 */}
      <div className={styles.zoneRange}>
        <span className={styles.zoneTop}>{fmtPrice(zone.top)}</span>
        <span className={styles.zoneSep}>—</span>
        <span className={styles.zoneBot}>{fmtPrice(zone.bottom)}</span>
      </div>

      {/* 거리 */}
      <div className={`${styles.zoneDist} ${isBull ? styles.zoneDistUp : styles.zoneDistDn}`}>
        {fmtPct(currentPrice, isBull ? zone.bottom : zone.top)}
      </div>

      {/* 형성 시간 */}
      <div className={styles.zoneFormed}>
        {fmtTimeAgo(zone.barsAgo, tf)}
      </div>

      {/* 상태 */}
      <div className={`${styles.zoneStatus} ${zone.partial ? styles.statusPartial : styles.statusOpen}`}>
        {zone.partial ? (isKo ? "부분" : "Partial") : (isKo ? "미체결" : "Open")}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function FvgObPanel() {
  const { language } = useLanguage();
  const C = COPY[language];
  const isKo = language === "ko";

  const [coin, setCoin]     = useState<Coin>("BTC");
  const [tf, setTf]         = useState<TF>("1h");
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState(false);
  const [price, setPrice]   = useState(0);
  const [resistance, setRes] = useState<Zone[]>([]);
  const [support, setSup]   = useState<Zone[]>([]);

  const load = useCallback(async () => {
    setLoad(true); setError(false);
    const tfCfg = TFS.find(t => t.key === tf)!;

    // 현재가 + 캔들 병렬 fetch
    const [priceRes, candles] = await Promise.all([
      fetch(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${coin}USDT`, { cache: "no-store" })
        .then(r => r.json()).then(d => parseFloat(d.markPrice)).catch(() => 0),
      fetchCandles(coin, tfCfg.interval, tfCfg.limit),
    ]);

    if (!candles.length) { setError(true); setLoad(false); return; }

    const curPrice = priceRes || candles.at(-1)!.close;
    setPrice(curPrice);

    const { resistance: res, support: sup } = processZones(candles, curPrice);
    setRes(res);
    setSup(sup);
    setLoad(false);
  }, [coin, tf]);

  useEffect(() => { load(); }, [load]);

  const tint = COIN_COLOR[coin];

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
        <div className={styles.ctrlGroup}>
          <span className={styles.ctrlLabel}>{C.coin}</span>
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
          <span className={styles.ctrlLabel}>{C.tf}</span>
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

      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.typeBadge} ${styles.typeFvg}`} style={{ fontSize: "0.6rem" }}>FVG</span>
          {C.fvgDesc}
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.typeBadge} ${styles.typeOb}`} style={{ fontSize: "0.6rem" }}>OB</span>
          {C.obDesc}
        </span>
      </div>

      {loading && (
        <div className={styles.loadingBox}><span className={styles.spinner} />{C.loading}</div>
      )}
      {!loading && error && (
        <div className={styles.loadingBox} style={{ color: "#f87171" }}>{C.error}</div>
      )}

      {!loading && !error && (
        <div className={styles.zoneContainer}>
          {/* ── 저항 구간 (위) ── */}
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle} style={{ color: "#f87171" }}>
              ▲ {C.resistance}
            </span>
            <span className={styles.sectionCount}>{resistance.length}개</span>
          </div>

          {resistance.length === 0 ? (
            <p className={styles.noZone}>{C.noZone}</p>
          ) : (
            <div className={styles.zoneList}>
              {resistance.map((z, i) => (
                <ZoneRow key={i} zone={z} currentPrice={price} tf={tf} isKo={isKo} />
              ))}
            </div>
          )}

          {/* ── 현재가 ── */}
          <div className={styles.currentPriceLine}>
            <div className={styles.currentPriceDot} style={{ background: tint }} />
            <span className={styles.currentPriceLabel} style={{ color: tint }}>
              {C.currentPrice}
            </span>
            <span className={styles.currentPriceValue} style={{ color: tint }}>
              ${price > 0 ? fmtPrice(price) : "—"}
            </span>
            <div className={styles.currentPriceDot} style={{ background: tint }} />
          </div>

          {/* ── 지지 구간 (아래) ── */}
          <div className={styles.sectionHeader}>
            <span className={styles.sectionTitle} style={{ color: "#4ade80" }}>
              ▼ {C.support}
            </span>
            <span className={styles.sectionCount}>{support.length}개</span>
          </div>

          {support.length === 0 ? (
            <p className={styles.noZone}>{C.noZone}</p>
          ) : (
            <div className={styles.zoneList}>
              {support.map((z, i) => (
                <ZoneRow key={i} zone={z} currentPrice={price} tf={tf} isKo={isKo} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 칼럼 헤더 */}
      {!loading && !error && (
        <div className={styles.colHeader}>
          <span>타입</span>
          <span>구간</span>
          <span>거리</span>
          <span>형성</span>
          <span>상태</span>
        </div>
      )}
    </section>
  );
}
