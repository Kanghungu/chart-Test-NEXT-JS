"use client";

import { Fragment, useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import {
  EXCHANGE_LABELS,
  scanFunding,
  formatFR,
  formatOI,
  formatPrice,
  type ExchangeFundingRow,
  type ExchangeId,
  type FundingLevel,
  type FundingRow,
  type OITrend,
} from "@/lib/fundingSignals";
import styles from "./FundingPanel.module.css";

const EXCHANGE_ORDER: ExchangeId[] = ["binance", "bybit", "okx"];

const COPY = {
  ko: {
    kicker: "03 / FUTURES",
    title: "선물 지표 대시보드",
    hint: "펀딩비 · 미결제약정 — Binance, Bybit, OKX 통합 조회 (60초 갱신)",
    scanning: "스캔 중",
    updated: "업데이트",
    refresh: "새로고침",
    loading: "거래소별 선물 지표를 불러오는 중...",
    noData: "선물 데이터를 불러올 수 없습니다",
    detailOpen: "상세보기",
    detailClose: "닫기",
    unavailable: "미지원/조회 실패",
    aggregate: "통합",
    exchanges: "거래소",
    col: {
      symbol: "코인",
      price: "현재가",
      fr: "평균 펀딩비",
      frNext: "다음 정산",
      oi: "통합 OI (USD)",
      oiChg: "OI 1h 변화",
      signal: "해석",
    },
    detailCol: {
      exchange: "거래소",
      price: "마크가격",
      fr: "펀딩비",
      frNext: "다음 정산",
      oi: "OI (USD)",
      oiChg: "OI 1h",
      signal: "해석",
    },
    frDesc: {
      EXTREME_BULL: "숏 과열: 반등 압력 강함",
      HIGH_BULL: "숏 우위: 반등 압력 증가",
      NEUTRAL: "중립",
      HIGH_BEAR: "롱 우위: 조정 압력 증가",
      EXTREME_BEAR: "롱 과열: 조정 압력 강함",
    } as Record<FundingLevel, string>,
    oiTrendLabel: {
      RISING_FAST: "급증",
      RISING: "증가",
      FLAT: "보합",
      FALLING: "감소",
      FALLING_FAST: "급감",
    } as Record<OITrend, string>,
    info: "요약 행은 조회 가능한 거래소의 평균 펀딩비와 통합 OI를 보여줍니다. 상세보기에서 Binance, Bybit, OKX 값을 거래소별로 비교할 수 있습니다.",
    extremeTitle: "극단 펀딩비 감지",
  },
  en: {
    kicker: "03 / FUTURES",
    title: "Futures Dashboard",
    hint: "Funding Rate · Open Interest — Binance, Bybit, OKX aggregate (60s refresh)",
    scanning: "Scanning",
    updated: "Updated",
    refresh: "Refresh",
    loading: "Loading futures metrics by exchange...",
    noData: "No futures data available",
    detailOpen: "Details",
    detailClose: "Close",
    unavailable: "Unavailable",
    aggregate: "Aggregate",
    exchanges: "Exchanges",
    col: {
      symbol: "Coin",
      price: "Price",
      fr: "Avg Funding",
      frNext: "Next Funding",
      oi: "Total OI (USD)",
      oiChg: "OI 1h Change",
      signal: "Signal",
    },
    detailCol: {
      exchange: "Exchange",
      price: "Mark Price",
      fr: "Funding Rate",
      frNext: "Next Funding",
      oi: "OI (USD)",
      oiChg: "OI 1h",
      signal: "Signal",
    },
    frDesc: {
      EXTREME_BULL: "Extreme short crowding: bounce pressure high",
      HIGH_BULL: "Short crowding: bounce pressure elevated",
      NEUTRAL: "Neutral",
      HIGH_BEAR: "Long crowding: pullback pressure elevated",
      EXTREME_BEAR: "Extreme long crowding: pullback pressure high",
    } as Record<FundingLevel, string>,
    oiTrendLabel: {
      RISING_FAST: "Surging",
      RISING: "Rising",
      FLAT: "Flat",
      FALLING: "Falling",
      FALLING_FAST: "Dropping",
    } as Record<OITrend, string>,
    info: "Summary rows use average funding from available exchanges and combined open interest. Open Details to compare Binance, Bybit, and OKX side by side.",
    extremeTitle: "Extreme Funding Detected",
  },
} as const;

const COIN_TINT: Record<string, string> = {
  BTC: "#f7931a", ETH: "#627eea", SOL: "#14f195", XRP: "#00a3e0",
  BNB: "#f3ba2f", ADA: "#0033ad", DOGE: "#c2a633", LTC: "#bfbbbb",
  TAO: "#7c3aed", WLD: "#06b6d4", ENA: "#ec4899", MAGIC: "#f59e0b",
  VIRTUAL: "#a78bfa", TURBO: "#fb923c",
};

function nextFundingLabel(ts: number): string {
  if (!Number.isFinite(ts)) return "N/A";
  const diffMs = ts - Date.now();
  if (diffMs <= 0) return "--";
  const h = Math.floor(diffMs / 3_600_000);
  const m = Math.floor((diffMs % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function frLevelClass(level: FundingLevel): string {
  switch (level) {
    case "EXTREME_BULL": return styles.frExtremeBull;
    case "HIGH_BULL": return styles.frHighBull;
    case "HIGH_BEAR": return styles.frHighBear;
    case "EXTREME_BEAR": return styles.frExtremeBear;
    default: return styles.frNeutral;
  }
}

function oiTrendClass(trend: OITrend): string {
  switch (trend) {
    case "RISING_FAST": return styles.oiRisingFast;
    case "RISING": return styles.oiRising;
    case "FALLING": return styles.oiFalling;
    case "FALLING_FAST": return styles.oiFallingFast;
    default: return styles.oiFlat;
  }
}

function signedPercent(value: number): string {
  if (!Number.isFinite(value)) return "N/A";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function FundingBadge({ row }: { row: Pick<FundingRow, "fundingRate" | "frLevel"> }) {
  return (
    <span className={`${styles.frBadge} ${frLevelClass(row.frLevel)}`}>
      {row.fundingRate >= 0 ? "+" : ""}{formatFR(row.fundingRate)}
    </span>
  );
}

function ExchangeDetailRow({
  exchange,
  data,
  unavailableLabel,
  signalLabel,
}: {
  exchange: ExchangeId;
  data?: ExchangeFundingRow;
  unavailableLabel: string;
  signalLabel: (level: FundingLevel) => string;
}) {
  if (!data) {
    return (
      <tr className={styles.detailMutedRow}>
        <td>
          <span className={styles.exchangeName}>{EXCHANGE_LABELS[exchange]}</span>
        </td>
        <td colSpan={6}>{unavailableLabel}</td>
      </tr>
    );
  }

  return (
    <tr>
      <td>
        <span className={styles.exchangeName}>{data.exchangeLabel}</span>
      </td>
      <td className={styles.priceCell}>${formatPrice(data.markPrice)}</td>
      <td><FundingBadge row={data} /></td>
      <td className={styles.nextCell}>{nextFundingLabel(data.nextFundingTime)}</td>
      <td className={styles.oiCell}>${formatOI(data.oiUSD)}</td>
      <td>
        <span className={`${styles.oiBadge} ${oiTrendClass(data.oiTrend)}`}>
          {signedPercent(data.oiChange1hPct)}
        </span>
      </td>
      <td className={styles.signalCell}>
        <span className={`${styles.signalText} ${frLevelClass(data.frLevel)}`}>
          {signalLabel(data.frLevel)}
        </span>
      </td>
    </tr>
  );
}

export default function FundingPanel() {
  const { language } = useLanguage();
  const C = COPY[language];

  const [rows, setRows] = useState<FundingRow[]>([]);
  const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastScan, setLastScan] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function scan() {
    try {
      setError(null);
      setLoading(true);
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
    const timer = setInterval(scan, 60_000);
    return () => clearInterval(timer);
  }, []);

  const lastLabel = lastScan
    ? new Date(lastScan).toLocaleTimeString(language === "ko" ? "ko-KR" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : C.scanning;

  return (
    <section className={styles.panel}>
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

      <div className={styles.infoBar}>{C.info}</div>

      {loading && rows.length === 0 && (
        <div className={styles.stateBox}>
          <span className={styles.spinner} />
          <p>{C.loading}</p>
        </div>
      )}

      {error && (
        <div className={styles.stateBox}>
          <p className={styles.errorText}>{error}</p>
        </div>
      )}

      {!loading && rows.length === 0 && !error && (
        <div className={styles.stateBox}>
          <p>{C.noData}</p>
        </div>
      )}

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
                const isExpanded = expandedSymbol === row.symbol;

                return (
                  <Fragment key={row.symbol}>
                    <tr
                      className={`${styles.row} ${styles.clickableRow} ${isExpanded ? styles.rowExpanded : ""}`}
                      onClick={() => setExpandedSymbol((current) => (
                        current === row.symbol ? null : row.symbol
                      ))}
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setExpandedSymbol((current) => (
                            current === row.symbol ? null : row.symbol
                          ));
                        }
                      }}
                      aria-expanded={isExpanded}
                    >
                      <td>
                        <div className={styles.coinCell}>
                          <span className={styles.coinDot} style={{ background: tint }} />
                          <span className={styles.coinBase}>{row.base}</span>
                          <span className={styles.exchangeCount}>
                            {row.availableCount}/{EXCHANGE_ORDER.length}
                          </span>
                        </div>
                      </td>
                      <td className={styles.priceCell}>${formatPrice(row.markPrice)}</td>
                      <td><FundingBadge row={row} /></td>
                      <td className={styles.nextCell}>{nextFundingLabel(row.nextFundingTime)}</td>
                      <td className={`${styles.oiCell} ${styles.hideSmall}`}>${formatOI(row.oiUSD)}</td>
                      <td>
                        <span className={`${styles.oiBadge} ${oiTrendClass(row.oiTrend)}`}>
                          {signedPercent(row.oiChange1hPct)}
                        </span>
                      </td>
                      <td className={`${styles.signalCell} ${styles.hideSmall}`}>
                        <span className={`${styles.signalText} ${frLevelClass(row.frLevel)}`}>
                          {C.frDesc[row.frLevel]}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className={styles.detailRow}>
                        <td colSpan={7}>
                          <div className={styles.detailPanel}>
                            <div className={styles.detailHeader}>
                              <div>
                                <p className={styles.detailKicker}>{row.base}/USDT</p>
                                <h3 className={styles.detailTitle}>{C.exchanges} {C.detailOpen}</h3>
                              </div>
                              <span className={styles.aggregatePill}>
                                {C.aggregate} {row.availableCount}/{EXCHANGE_ORDER.length}
                              </span>
                            </div>
                            <div className={styles.detailTableWrap}>
                              <table className={styles.detailTable}>
                                <thead>
                                  <tr>
                                    <th>{C.detailCol.exchange}</th>
                                    <th>{C.detailCol.price}</th>
                                    <th>{C.detailCol.fr}</th>
                                    <th>{C.detailCol.frNext}</th>
                                    <th>{C.detailCol.oi}</th>
                                    <th>{C.detailCol.oiChg}</th>
                                    <th>{C.detailCol.signal}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {EXCHANGE_ORDER.map((exchange) => (
                                    <ExchangeDetailRow
                                      key={exchange}
                                      exchange={exchange}
                                      data={row.exchanges.find((item) => item.exchange === exchange)}
                                      unavailableLabel={C.unavailable}
                                      signalLabel={(level) => C.frDesc[level]}
                                    />
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (() => {
        const extremes = rows.filter(
          (row) => row.frLevel === "EXTREME_BEAR" || row.frLevel === "EXTREME_BULL",
        );
        if (extremes.length === 0) return null;

        return (
          <div className={styles.extremeBox}>
            <p className={styles.extremeTitle}>{C.extremeTitle}</p>
            <div className={styles.extremeList}>
              {extremes.map((row) => (
                <div
                  key={row.symbol}
                  className={`${styles.extremeCard} ${row.frLevel === "EXTREME_BEAR" ? styles.extremeCardBear : styles.extremeCardBull}`}
                >
                  <span className={styles.extremeBase}>{row.base}</span>
                  <span className={styles.extremeFR}>
                    {row.fundingRate >= 0 ? "+" : ""}{formatFR(row.fundingRate)}
                  </span>
                  <span className={styles.extremeDesc}>{C.frDesc[row.frLevel]}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </section>
  );
}
