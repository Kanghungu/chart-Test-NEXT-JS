"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import {
  scanFunding,
  formatFR,
  formatOI,
  formatPrice,
  type FundingRow,
} from "@/lib/fundingSignals";
import styles from "./FundingPanel.module.css";

// ── Copy ──────────────────────────────────────────────────────────────────
const COPY = {
  ko: {
    kicker:    "03 · FUTURES",
    title:     "선물 지표 대시보드",
    hint:      "펀딩비 · 미결제약정 — Binance Futures 실시간 (60초 갱신)",
    scanning:  "스캔 중…",
    updated:   "업데이트",
    refresh:   "새로고침",
    loading:   "Binance Futures API에서 선물 지표를 불러오는 중…",
    noData:    "선물 데이터를 불러올 수 없습니다",
    col: {
      symbol:  "코인",
      price:   "현재가",
      fr:      "펀딩비",
      frNext:  "다음 정산",
      oi:      "미결제약정 (USD)",
      oiChg:   "OI 1h 변화",
      signal:  "해석",
    },
    frDesc: {
      EXTREME_BULL: "롱 포지션 청산 압박 — 역추세 매수 기회",
      HIGH_BULL:    "숏 과밀 — 반등 압력 높음",
      NEUTRAL:      "중립",
      HIGH_BEAR:    "롱 과밀 — 조정 압력 높음",
      EXTREME_BEAR: "숏 포지션 청산 압박 — 역추세 매도 기회",
    } as Record<FundingRow["frLevel"], string>,
    oiTrendLabel: {
      RISING_FAST:  "급증 ▲▲",
      RISING:       "증가 ▲",
      FLAT:         "보합",
      FALLING:      "감소 ▼",
      FALLING_FAST: "급감 ▼▼",
    } as Record<FundingRow["oiTrend"], string>,
    info: "펀딩비 해석: 양수(+) = 롱이 숏에게 지급 → 과열 매수 → 역추세 매도 신호 / 음수(-) = 숏이 롱에게 지급 → 과열 매도 → 역추세 매수 신호",
  },
  en: {
    kicker:    "03 · FUTURES",
    title:     "Futures Dashboard",
    hint:      "Funding Rate · Open Interest — Binance Futures live (60s refresh)",
    scanning:  "Scanning…",
    updated:   "Updated",
    refresh:   "Refresh",
    loading:   "Loading futures data from Binance…",
    noData:    "No futures data available",
    col: {
      symbol:  "Coin",
      price:   "Price",
      fr:      "Funding Rate",
      frNext:  "Next Funding",
      oi:      "Open Interest (USD)",
      oiChg:   "OI 1h Change",
      signal:  "Signal",
    },
    frDesc: {
      EXTREME_BULL: "Extreme short squeeze — contrarian long opportunity",
      HIGH_BULL:    "High short crowding — bounce pressure elevated",
      NEUTRAL:      "Neutral",
      HIGH_BEAR:    "High long crowding — correction pressure elevated",
      EXTREME_BEAR: "Extreme long squeeze — contrarian short opportunity",
    } as Record<FundingRow["frLevel"], string>,
    oiTrendLabel: {
      RISING_FAST:  "Surging ▲▲",
      RISING:       "Rising ▲",
      FLAT:         "Flat",
      FALLING:      "Falling ▼",
      FALLING_FAST: "Dropping ▼▼",
    } as Record<FundingRow["oiTrend"], string>,
    info: "Funding Rate: Positive (+) = longs pay shorts → overbought → contrarian sell / Negative (−) = shorts pay longs → oversold → contrarian buy",
  },
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────

function nextFundingLabel(ts: number): string {
  const diffMs = ts - Date.now();
  if (diffMs <= 0) return "--";
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function frLevelClass(level: FundingRow["frLevel"]): string {
  switch (level) {
    case "EXTREME_BULL": return styles.frExtremeBull;
    case "HIGH_BULL":    return styles.frHighBull;
    case "HIGH_BEAR":    return styles.frHighBear;
    case "EXTREME_BEAR": return styles.frExtremeBear;
    default:             return styles.frNeutral;
  }
}

function oiTrendClass(trend: FundingRow["oiTrend"]): string {
  switch (trend) {
    case "RISING_FAST":  return styles.oiRisingFast;
    case "RISING":       return styles.oiRising;
    case "FALLING":      return styles.oiFalling;
    case "FALLING_FAST": return styles.oiFallingFast;
    default:             return styles.oiFlat;
  }
}

const COIN_TINT: Record<string, string> = {
  BTC: "#f7931a", ETH: "#627eea", SOL: "#14f195", XRP: "#00a3e0",
  BNB: "#f3ba2f", ADA: "#0033ad", DOGE: "#c2a633", LTC: "#bfbbbb",
  TAO: "#7c3aed", WLD: "#06b6d4", ENA: "#ec4899", MAGIC: "#f59e0b",
  VIRTUAL: "#a78bfa", TURBO: "#fb923c",
};

// ── Component ─────────────────────────────────────────────────────────────

export default function FundingPanel() {
  const { language } = useLanguage();
  const C = COPY[language];

  const [rows, setRows]         = useState<FundingRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [lastScan, setLastScan] = useState(0);
  const [error, setError]       = useState<string | null>(null);

  async function scan() {
    try {
      setError(null);
      const data = await scanFunding();
      setRows(data);
      setLastScan(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    scan();
    const t = setInterval(scan, 60_000);
    return () => clearInterval(t);
  }, []);

  const lastLabel = lastScan
    ? new Date(lastScan).toLocaleTimeString(language === "ko" ? "ko-KR" : "en-US", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      })
    : C.scanning;

  return (
    <section className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>{C.kicker}</p>
          <h2 className={styles.title}>{C.title}</h2>
          <p className={styles.hint}>{C.hint}</p>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.scanLabel}>
            <span className={`${styles.scanDot} ${loading ? styles.scanDotActive : ""}`} />
            {loading ? C.scanning : `${C.updated} ${lastLabel}`}
          </span>
          <button className={styles.refreshBtn} onClick={scan} disabled={loading}>
            {C.refresh}
          </button>
        </div>
      </div>

      {/* Info bar */}
      <div className={styles.infoBar}>{C.info}</div>

      {/* Loading / Error */}
      {loading && rows.length === 0 && (
        <div className={styles.stateBox}>
          <span className={styles.spinner} />
          <p>{C.loading}</p>
        </div>
      )}
      {error && (
        <div className={styles.stateBox}>
          <p className={styles.errorText}>⚠ {error}</p>
        </div>
      )}

      {/* Table */}
      {rows.length > 0 && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{C.col.symbol}</th>
                <th>{C.col.price}</th>
                <th>{C.col.fr}</th>
                <th>{C.col.frNext}</th>
                <th className={styles.hideSmall}>{C.col.oi}</th>
                <th>{C.col.oiChg}</th>
                <th className={styles.hideSmall}>{C.col.signal}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const tint = COIN_TINT[row.base] ?? "#64748b";
                const frPct = row.fundingRate * 100;
                return (
                  <tr key={row.symbol} className={styles.row}>
                    {/* Coin */}
                    <td>
                      <div className={styles.coinCell}>
                        <span
                          className={styles.coinDot}
                          style={{ background: tint }}
                        />
                        <span className={styles.coinBase}>{row.base}</span>
                      </div>
                    </td>
                    {/* Price */}
                    <td className={styles.priceCell}>
                      ${formatPrice(row.markPrice)}
                    </td>
                    {/* Funding Rate */}
                    <td>
                      <span className={`${styles.frBadge} ${frLevelClass(row.frLevel)}`}>
                        {frPct >= 0 ? "+" : ""}{formatFR(row.fundingRate)}
                      </span>
                    </td>
                    {/* Next funding */}
                    <td className={styles.nextCell}>
                      {nextFundingLabel(row.nextFundingTime)}
                    </td>
                    {/* OI */}
                    <td className={`${styles.oiCell} ${styles.hideSmall}`}>
                      ${formatOI(row.oiUSD)}
                    </td>
                    {/* OI Change */}
                    <td>
                      <span className={`${styles.oiBadge} ${oiTrendClass(row.oiTrend)}`}>
                        {isNaN(row.oiChange1hPct)
                          ? "—"
                          : `${row.oiChange1hPct >= 0 ? "+" : ""}${row.oiChange1hPct.toFixed(2)}%`}
                      </span>
                    </td>
                    {/* Signal */}
                    <td className={`${styles.signalCell} ${styles.hideSmall}`}>
                      <span className={`${styles.signalText} ${frLevelClass(row.frLevel)}`}>
                        {C.frDesc[row.frLevel]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Extreme signals summary */}
      {rows.length > 0 && (() => {
        const extremes = rows.filter(
          (r) => r.frLevel === "EXTREME_BEAR" || r.frLevel === "EXTREME_BULL",
        );
        if (extremes.length === 0) return null;
        return (
          <div className={styles.extremeBox}>
            <p className={styles.extremeTitle}>
              ⚡ {language === "ko" ? "극단 펀딩비 감지" : "Extreme Funding Detected"}
            </p>
            <div className={styles.extremeList}>
              {extremes.map((r) => (
                <div key={r.symbol} className={`${styles.extremeCard} ${r.frLevel === "EXTREME_BEAR" ? styles.extremeCardBear : styles.extremeCardBull}`}>
                  <span className={styles.extremeBase}>{r.base}</span>
                  <span className={styles.extremeFR}>
                    {r.fundingRate >= 0 ? "+" : ""}{formatFR(r.fundingRate)}
                  </span>
                  <span className={styles.extremeDesc}>{C.frDesc[r.frLevel]}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </section>
  );
}
