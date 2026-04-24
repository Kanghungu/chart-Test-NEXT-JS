"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import {
  scanAllCryptoSignals,
  formatRelativeTime,
  type CryptoSignal,
  type TF,
} from "@/lib/cryptoSignals";
import SignalChartModal from "./SignalChartModal";
import styles from "./SignalsPanel.module.css";

type TypeFilter = "ALL" | "HARMONIC" | "DIVERGENCE" | "ZONE_BREAK" | "HARMONIC_PRZ" | "ZONE_APPROACH" | "PREDICTIVE";
type DirFilter  = "ALL" | "BULLISH" | "BEARISH";
/** 카드 정렬 기준 (계획: 정렬·그룹핑) */
type SortKey = "recent" | "strength" | "symbol" | "timeframe";

/** localStorage 키 — 보기 토글 상태 유지 */
const LS_VIEW_DESC = "signalsPanel_view_description";
const LS_VIEW_PRZ  = "signalsPanel_view_prz";
const LS_VIEW_COMPACT = "signalsPanel_view_compact";
const LS_SORT = "signalsPanel_sort";
const LS_GROUP = "signalsPanel_group_by_symbol";

const COIN_TINT: Record<string, string> = {
  BTC:  "#f7931a",
  ETH:  "#627eea",
  SOL:  "#14f195",
  XRP:  "#00a3e0",
  BNB:  "#f3ba2f",
  ADA:  "#0033ad",
  DOGE: "#c2a633",
};

export default function SignalsPanel() {
  const { language } = useLanguage();
  const [signals, setSignals] = useState<CryptoSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<number>(0);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [dirFilter, setDirFilter]   = useState<DirFilter>("ALL");
  const [selected,   setSelected]   = useState<CryptoSignal | null>(null);
  const [expandedSignalId, setExpandedSignalId] = useState<string | null>(null);
  const [viewShowDescription, setViewShowDescription] = useState(true);
  const [viewShowPrz, setViewShowPrz] = useState(true);
  const [viewCompact, setViewCompact] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [groupBySymbol, setGroupBySymbol] = useState(false);

  const C = COPY[language];

  // 브라우저에서 저장된 보기·정렬·그룹 옵션 복원 (SSR 이후)
  useEffect(() => {
    try {
      const d = localStorage.getItem(LS_VIEW_DESC);
      const p = localStorage.getItem(LS_VIEW_PRZ);
      const c = localStorage.getItem(LS_VIEW_COMPACT);
      if (d !== null) setViewShowDescription(d === "1");
      if (p !== null) setViewShowPrz(p === "1");
      if (c !== null) setViewCompact(c === "1");
      const sk = localStorage.getItem(LS_SORT) as SortKey | null;
      if (sk === "recent" || sk === "strength" || sk === "symbol" || sk === "timeframe") setSortKey(sk);
      const g = localStorage.getItem(LS_GROUP);
      if (g !== null) setGroupBySymbol(g === "1");
    } catch {
      /* 저장소 비가용 시 기본값 유지 */
    }
  }, []);

  async function scan() {
    try {
      setError(null);
      const result = await scanAllCryptoSignals();
      setSignals(result);
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

  const filtered = useMemo(() => {
    return signals.filter((s) => {
      // ⏳ 예측: 하모닉 PRZ 접근 + 다이버전스 형성 중만 (매물대 돌파 임박 ZONE_APPROACH는 제외)
      if (typeFilter === "PREDICTIVE") {
        if (s.type !== "HARMONIC_PRZ" && !s.isPrediction) return false;
      } else if (typeFilter !== "ALL" && s.type !== typeFilter) return false;
      if (dirFilter !== "ALL" && s.direction !== dirFilter) return false;
      return true;
    });
  }, [signals, typeFilter, dirFilter]);

  /** 필터 후 사용자 정렬 */
  const sortedFiltered = useMemo(
    () => sortSignals(filtered, sortKey),
    [filtered, sortKey],
  );

  /** 심볼별 그룹 (베이스 알파벳 순) */
  const groupedByBase = useMemo(() => {
    if (!groupBySymbol) return null;
    const map = new Map<string, CryptoSignal[]>();
    for (const s of sortedFiltered) {
      const list = map.get(s.base);
      if (list) list.push(s);
      else map.set(s.base, [s]);
    }
    return [...map.keys()]
      .sort((a, b) => a.localeCompare(b))
      .map((base) => [base, map.get(base)!] as const);
  }, [sortedFiltered, groupBySymbol]);

  const stats = useMemo(() => {
    const bullish = signals.filter((s) => s.direction === "BULLISH").length;
    const bearish = signals.filter((s) => s.direction === "BEARISH").length;
    const strong  = signals.filter((s) => s.strength === "STRONG").length;
    return { total: signals.length, bullish, bearish, strong };
  }, [signals]);

  const lastScanLabel = lastScan
    ? formatRelativeTime(lastScan, language)
    : C.scanning;

  return (
    <section className={styles.panel}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>02 · SIGNALS</p>
          <h2 className={styles.title}>{C.title}</h2>
          <p className={styles.hint}>{C.hint}</p>
        </div>
        <div className={styles.headerRight}>
          <span className={styles.scanLabel}>
            <span className={`${styles.scanDot} ${loading ? styles.scanDotActive : ""}`} />
            {loading ? C.scanning : `${C.updated} ${lastScanLabel}`}
          </span>
          <button className={styles.refreshBtn} onClick={scan} disabled={loading}>
            {C.refresh}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className={styles.summaryGrid}>
        <SummaryCard label={C.sTotal}   value={stats.total}   tone="neutral" />
        <SummaryCard label={C.sBullish} value={stats.bullish} tone="bullish" />
        <SummaryCard label={C.sBearish} value={stats.bearish} tone="bearish" />
        <SummaryCard label={C.sStrong}  value={stats.strong}  tone="strong"  />
      </div>

      {/* Filters */}
      <div className={styles.filterRow}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{C.fType}</span>
          {(["ALL","PREDICTIVE","HARMONIC","DIVERGENCE","ZONE_BREAK"] as const).map((v) => (
            <button
              key={v}
              className={`${styles.pill} ${typeFilter === v ? styles.pillActive : ""} ${v === "PREDICTIVE" ? styles.pillPredict : ""}`}
              onClick={() => setTypeFilter(v)}
            >
              {C.typeLabels[v]}
            </button>
          ))}
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{C.fDir}</span>
          {(["ALL","BULLISH","BEARISH"] as const).map((v) => (
            <button
              key={v}
              className={`${styles.pill} ${styles[`pill_${v}`] ?? ""} ${dirFilter === v ? styles.pillActive : ""}`}
              onClick={() => setDirFilter(v)}
            >
              {C.dirLabels[v]}
            </button>
          ))}
        </div>
      </div>

      {/* 보기: 설명 / PRZ / 밀집 레이아웃 — 온오프 필터 (localStorage 유지) */}
      <div className={styles.viewRow}>
        <span className={styles.filterLabel}>{C.fView}</span>
        <div className={styles.viewToggles}>
          <button
            type="button"
            role="switch"
            aria-checked={viewShowDescription}
            className={`${styles.togglePill} ${viewShowDescription ? styles.togglePillOn : ""}`}
            onClick={() => {
              setViewShowDescription((v) => {
                const next = !v;
                try {
                  localStorage.setItem(LS_VIEW_DESC, next ? "1" : "0");
                } catch { /* ignore */ }
                return next;
              });
            }}
          >
            {C.viewDesc}
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={viewShowPrz}
            className={`${styles.togglePill} ${viewShowPrz ? styles.togglePillOn : ""}`}
            onClick={() => {
              setViewShowPrz((v) => {
                const next = !v;
                try {
                  localStorage.setItem(LS_VIEW_PRZ, next ? "1" : "0");
                } catch { /* ignore */ }
                return next;
              });
            }}
          >
            {C.viewPrz}
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={viewCompact}
            className={`${styles.togglePill} ${viewCompact ? styles.togglePillOn : ""}`}
            onClick={() => {
              setViewCompact((v) => {
                const next = !v;
                try {
                  localStorage.setItem(LS_VIEW_COMPACT, next ? "1" : "0");
                } catch { /* ignore */ }
                return next;
              });
            }}
          >
            {C.viewCompact}
          </button>
        </div>
      </div>

      {/* 정렬·심볼 그룹 (localStorage 유지) */}
      <div className={styles.sortRow}>
        <span className={styles.filterLabel}>{C.fSort}</span>
        <div className={styles.sortPills}>
          {(["recent", "strength", "symbol", "timeframe"] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={`${styles.pill} ${sortKey === k ? styles.pillActive : ""}`}
              onClick={() => {
                setSortKey(k);
                try {
                  localStorage.setItem(LS_SORT, k);
                } catch { /* ignore */ }
              }}
            >
              {C.sortLabels[k]}
            </button>
          ))}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={groupBySymbol}
          className={`${styles.togglePill} ${groupBySymbol ? styles.togglePillOn : ""} ${styles.groupToggle}`}
          onClick={() => {
            setGroupBySymbol((v) => {
              const next = !v;
              try {
                localStorage.setItem(LS_GROUP, next ? "1" : "0");
              } catch { /* ignore */ }
              return next;
            });
          }}
        >
          {C.groupBySymbol}
        </button>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {loading && signals.length === 0 && (
          <div className={styles.stateBox}>
            <span className={styles.spinner} />
            <p>{C.loading}</p>
          </div>
        )}
        {error && (
          <div className={styles.stateBox}>
            <p className={styles.errorText}>⚠ {error}</p>
            <p className={styles.hintSm}>{C.errorHint}</p>
          </div>
        )}
        {!loading && !error && sortedFiltered.length === 0 && (
          <div className={styles.stateBox}>
            <p>{C.empty}</p>
            <p className={styles.hintSm}>{C.emptyHint}</p>
          </div>
        )}
        {sortedFiltered.length > 0 && !groupBySymbol && (
          <div className={`${styles.cardGrid} ${viewCompact ? styles.cardGridCompact : ""}`}>
            {sortedFiltered.map((s) => (
              <SignalCard
                key={s.id}
                signal={s}
                language={language}
                compact={viewCompact}
                showDescription={viewShowDescription}
                showPrz={viewShowPrz}
                expanded={expandedSignalId === s.id}
                onToggle={() => setExpandedSignalId((current) => current === s.id ? null : s.id)}
                onOpenChart={() => setSelected(s)}
              />
            ))}
          </div>
        )}
        {sortedFiltered.length > 0 && groupBySymbol && groupedByBase && (
          <div className={styles.groupedWrap}>
            {groupedByBase.map(([base, list]) => {
              const tint = COIN_TINT[base] ?? "#64748b";
              return (
                <section key={base} className={styles.signalGroup}>
                  <div
                    className={styles.groupHeader}
                    style={{ "--tint": tint } as React.CSSProperties}
                  >
                    <span className={styles.groupTitle}>{base}</span>
                    <span className={styles.groupCount}>{list.length}</span>
                  </div>
                  <div className={`${styles.cardGrid} ${viewCompact ? styles.cardGridCompact : ""}`}>
                    {list.map((s) => (
                      <SignalCard
                        key={s.id}
                        signal={s}
                        language={language}
                        compact={viewCompact}
                        showDescription={viewShowDescription}
                        showPrz={viewShowPrz}
                        expanded={expandedSignalId === s.id}
                        onToggle={() => setExpandedSignalId((current) => current === s.id ? null : s.id)}
                        onOpenChart={() => setSelected(s)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <SignalChartModal signal={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────
function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "neutral" | "bullish" | "bearish" | "strong";
}) {
  return (
    <div className={`${styles.summaryCard} ${styles[`tone_${tone}`]}`}>
      <span className={styles.summaryLabel}>{label}</span>
      <span className={styles.summaryValue}>{value}</span>
    </div>
  );
}

// ── Signal card ───────────────────────────────────────────────────────────
function SignalCard({
  signal,
  language,
  compact,
  showDescription,
  showPrz,
  expanded,
  onToggle,
  onOpenChart,
}: {
  signal: CryptoSignal;
  language: "ko" | "en";
  compact: boolean;
  showDescription: boolean;
  showPrz: boolean;
  expanded: boolean;
  onToggle: () => void;
  onOpenChart: () => void;
}) {
  const tint = COIN_TINT[signal.base] ?? "#64748b";
  const isBull = signal.direction === "BULLISH";
  const isStrong = signal.strength === "STRONG";
  const isPredict =
    signal.type === "HARMONIC_PRZ" ||
    signal.type === "ZONE_APPROACH" ||
    Boolean(signal.isPrediction);
  const typeLabel = TYPE_LABEL[language][signal.type];
  const dirLabel  = isBull ? (language === "ko" ? "상승" : "BULL") : (language === "ko" ? "하락" : "BEAR");
  const description = language === "ko" ? signal.descriptionKo : signal.descriptionEn;
  const priceFmt = formatPrice(signal.currentPrice);
  const relTime = formatRelativeTime(signal.detectedAt, language);
  const detail = SIGNAL_DETAIL_COPY[language];
  const metricRows = buildSignalMetrics(signal, language);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      aria-expanded={expanded}
      className={`${styles.card} ${compact ? styles.cardCompact : ""} ${expanded ? styles.cardExpanded : ""} ${isBull ? styles.cardBull : styles.cardBear} ${isStrong ? styles.cardStrong : ""} ${isPredict ? styles.cardPredict : ""}`}
      style={{ "--tint": tint } as React.CSSProperties}
    >
      <span className={styles.cardTintBar} aria-hidden="true" />
      <header className={styles.cardHeader}>
        <div className={styles.cardBaseWrap}>
          <span className={styles.cardBase}>{signal.base}</span>
          <span className={styles.cardTf}>{tfLabel(signal.timeframe)}</span>
        </div>
        {isStrong && <span className={styles.strongFlag}>STRONG</span>}
        <span className={`${styles.dirBadge} ${isBull ? styles.dirBull : styles.dirBear}`}>
          {isBull ? "▲" : "▼"} {dirLabel}
        </span>
      </header>

      <div className={styles.cardBadges}>
        <span className={`${styles.typeBadge} ${styles[`type_${signal.type}`]}`}>
          {typeLabel}
        </span>
        {signal.patternName && (
          <span className={styles.patternBadge}>{signal.patternName}</span>
        )}
        {isStrong && (
          <span className={styles.strongBadge}>★ STRONG</span>
        )}
        {signal.isPrediction && (
          <span className={styles.predictionBadge}>⏳ {language === "ko" ? "예측" : "FCST"}</span>
        )}
      </div>

      {showDescription && (
        <p className={styles.cardDesc}>{description}</p>
      )}

      <dl className={styles.cardMeta}>
        <div className={styles.metaRow}>
          <dt>{language === "ko" ? "현재가" : "Price"}</dt>
          <dd className={styles.priceValue}>${priceFmt}</dd>
        </div>
        {showPrz && signal.przMin !== undefined && signal.przMax !== undefined && (
          <div className={styles.metaRow}>
            <dt>PRZ</dt>
            <dd className={styles.przValue}>
              ${formatPrice(signal.przMin)} – ${formatPrice(signal.przMax)}
            </dd>
          </div>
        )}
        <div className={styles.metaRow}>
          <dt>{language === "ko" ? "탐지" : "Detected"}</dt>
          <dd>{relTime}</dd>
        </div>
      </dl>

      {expanded && (
        <div className={styles.detailPanel}>
          <div className={styles.detailHeader}>
            <div>
              <p className={styles.detailKicker}>{detail.kicker}</p>
              <h3 className={styles.detailTitle}>
                {signal.base}/USDT · {typeLabel}
              </h3>
            </div>
            <button
              type="button"
              className={styles.chartBtn}
              onClick={(event) => {
                event.stopPropagation();
                onOpenChart();
              }}
            >
              {detail.chart}
            </button>
          </div>
          <p className={styles.detailDesc}>{description}</p>
          <div className={styles.detailMetrics}>
            {metricRows.map((row) => (
              <div key={row.label} className={styles.detailMetric}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
          <div className={styles.detailNote}>
            <span>{detail.noteLabel}</span>
            <p>{detailNotes(signal, language)}</p>
          </div>
        </div>
      )}
    </article>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────
const TF_ORDER: Record<TF, number> = { "15m": 0, "1h": 1, "4h": 2 };

/** 필터된 시그널 배열을 사용자 선택 기준으로 정렬 (원본 배열 변경 없음) */
function sortSignals(list: CryptoSignal[], key: SortKey): CryptoSignal[] {
  const arr = [...list];
  switch (key) {
    case "recent":
      arr.sort((a, b) => {
        if (b.detectedAt !== a.detectedAt) return b.detectedAt - a.detectedAt;
        if (a.strength !== b.strength) return a.strength === "STRONG" ? -1 : 1;
        return a.base.localeCompare(b.base) || a.id.localeCompare(b.id);
      });
      break;
    case "strength":
      arr.sort((a, b) => {
        if (a.strength !== b.strength) return a.strength === "STRONG" ? -1 : 1;
        if (b.detectedAt !== a.detectedAt) return b.detectedAt - a.detectedAt;
        return a.base.localeCompare(b.base);
      });
      break;
    case "symbol":
      arr.sort((a, b) => {
        const cmp = a.base.localeCompare(b.base);
        if (cmp !== 0) return cmp;
        if (TF_ORDER[a.timeframe] !== TF_ORDER[b.timeframe]) {
          return TF_ORDER[a.timeframe] - TF_ORDER[b.timeframe];
        }
        return b.detectedAt - a.detectedAt;
      });
      break;
    case "timeframe":
      arr.sort((a, b) => {
        if (TF_ORDER[a.timeframe] !== TF_ORDER[b.timeframe]) {
          return TF_ORDER[a.timeframe] - TF_ORDER[b.timeframe];
        }
        return b.detectedAt - a.detectedAt;
      });
      break;
    default:
      break;
  }
  return arr;
}

function tfLabel(tf: TF): string {
  return tf;
}

function formatPrice(p: number): string {
  if (p >= 1000)  return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1)     return p.toFixed(3);
  if (p >= 0.01)  return p.toFixed(4);
  return p.toFixed(6);
}

function directionLabel(direction: CryptoSignal["direction"], language: "ko" | "en"): string {
  if (language === "ko") return direction === "BULLISH" ? "상승" : "하락";
  return direction === "BULLISH" ? "Bullish" : "Bearish";
}

function buildSignalMetrics(signal: CryptoSignal, language: "ko" | "en") {
  const copy = SIGNAL_DETAIL_COPY[language].metrics;
  const rows: Array<{ label: string; value: string }> = [
    { label: copy.symbol, value: `${signal.base}/USDT` },
    { label: copy.timeframe, value: signal.timeframe },
    { label: copy.direction, value: directionLabel(signal.direction, language) },
    { label: copy.strength, value: signal.strength },
    { label: copy.price, value: `$${formatPrice(signal.currentPrice)}` },
    { label: copy.detected, value: formatRelativeTime(signal.detectedAt, language) },
  ];

  if (signal.patternName) rows.splice(3, 0, { label: copy.pattern, value: signal.patternName });
  if (signal.przMin !== undefined && signal.przMax !== undefined) {
    rows.push({
      label: "PRZ",
      value: `$${formatPrice(signal.przMin)} - $${formatPrice(signal.przMax)}`,
    });
  }

  if (signal.viz.kind === "ZONE_BREAK") {
    rows.push({
      label: copy.zone,
      value: `$${formatPrice(signal.viz.zoneLow)} - $${formatPrice(signal.viz.zoneHigh)}`,
    });
  }

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

const SIGNAL_DETAIL_COPY = {
  ko: {
    kicker: "DETAIL",
    chart: "차트 보기",
    noteLabel: "체크포인트",
    metrics: {
      symbol: "심볼",
      timeframe: "타임프레임",
      direction: "방향",
      strength: "강도",
      price: "현재가",
      detected: "탐지",
      pattern: "패턴",
      zone: "구간",
    },
  },
  en: {
    kicker: "DETAIL",
    chart: "Open Chart",
    noteLabel: "Checkpoint",
    metrics: {
      symbol: "Symbol",
      timeframe: "Timeframe",
      direction: "Direction",
      strength: "Strength",
      price: "Price",
      detected: "Detected",
      pattern: "Pattern",
      zone: "Zone",
    },
  },
} as const;

const COPY = {
  ko: {
    title:    "기술적 시그널 스캐너",
    hint:     "하모닉 패턴 · RSI 다이버전스 · 매물대 돌파 — 브라우저에서 실시간 감지 (60초 주기)",
    scanning: "스캔 중…",
    updated:  "·",
    refresh:  "새로고침",
    loading:  "모든 코인의 1h / 4h 타임프레임을 분석 중입니다…",
    empty:    "조건에 맞는 시그널이 없습니다",
    emptyHint:"필터를 변경하거나 잠시 후 다시 시도해보세요",
    errorHint:"거래소 API 요청이 차단되었을 수 있습니다. 잠시 후 다시 시도해주세요.",
    sTotal:   "총 시그널",
    sBullish: "상승",
    sBearish: "하락",
    sStrong:  "강력",
    fType:    "유형",
    fDir:     "방향",
    fView:    "보기",
    viewDesc: "설명",
    viewPrz:  "PRZ",
    viewCompact: "밀집",
    fSort: "정렬",
    sortLabels: {
      recent:    "최신",
      strength:  "강도",
      symbol:    "심볼",
      timeframe: "타임프레임",
    },
    groupBySymbol: "심볼별 그룹",
    typeLabels: {
      ALL:           "전체",
      PREDICTIVE:    "⏳ 예측",
      HARMONIC:      "하모닉",
      DIVERGENCE:    "다이버전스",
      ZONE_BREAK:    "매물대",
      HARMONIC_PRZ:  "PRZ 접근",
      ZONE_APPROACH: "돌파 임박",
    },
    dirLabels: {
      ALL:     "전체",
      BULLISH: "▲ 상승",
      BEARISH: "▼ 하락",
    },
  },
  en: {
    title:    "Technical Signal Scanner",
    hint:     "Harmonic patterns · RSI divergence · Zone breakouts — Live browser detection (60s cadence)",
    scanning: "Scanning…",
    updated:  "·",
    refresh:  "Refresh",
    loading:  "Analyzing 1h / 4h timeframes across all coins…",
    empty:    "No signals match the current filters",
    emptyHint:"Try changing filters or refresh shortly",
    errorHint:"Exchange API request may have been blocked. Please try again shortly.",
    sTotal:   "Total",
    sBullish: "Bullish",
    sBearish: "Bearish",
    sStrong:  "Strong",
    fType:    "Type",
    fDir:     "Direction",
    fView:    "View",
    viewDesc: "Desc",
    viewPrz:  "PRZ",
    viewCompact: "Dense",
    fSort: "Sort",
    sortLabels: {
      recent:    "Recent",
      strength:  "Strength",
      symbol:    "Symbol",
      timeframe: "Timeframe",
    },
    groupBySymbol: "Group by coin",
    typeLabels: {
      ALL:           "All",
      PREDICTIVE:    "⏳ Predict",
      HARMONIC:      "Harmonic",
      DIVERGENCE:    "Divergence",
      ZONE_BREAK:    "Zone",
      HARMONIC_PRZ:  "PRZ Watch",
      ZONE_APPROACH: "Breakout Soon",
    },
    dirLabels: {
      ALL:     "All",
      BULLISH: "▲ Bull",
      BEARISH: "▼ Bear",
    },
  },
} as const;
