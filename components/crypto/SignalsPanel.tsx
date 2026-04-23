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

  const C = COPY[language];

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
      if (typeFilter === "PREDICTIVE") {
        if (s.type !== "HARMONIC_PRZ" && s.type !== "ZONE_APPROACH") return false;
      } else if (typeFilter !== "ALL" && s.type !== typeFilter) return false;
      if (dirFilter !== "ALL" && s.direction !== dirFilter) return false;
      return true;
    });
  }, [signals, typeFilter, dirFilter]);

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
        {!loading && !error && filtered.length === 0 && (
          <div className={styles.stateBox}>
            <p>{C.empty}</p>
            <p className={styles.hintSm}>{C.emptyHint}</p>
          </div>
        )}
        {filtered.length > 0 && (
          <div className={styles.cardGrid}>
            {filtered.map((s) => (
              <SignalCard
                key={s.id}
                signal={s}
                language={language}
                onClick={() => setSelected(s)}
              />
            ))}
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
  onClick,
}: {
  signal: CryptoSignal;
  language: "ko" | "en";
  onClick: () => void;
}) {
  const tint = COIN_TINT[signal.base] ?? "#64748b";
  const isBull = signal.direction === "BULLISH";
  const isStrong = signal.strength === "STRONG";
  const isPredict = signal.type === "HARMONIC_PRZ" || signal.type === "ZONE_APPROACH";
  const typeLabel = TYPE_LABEL[language][signal.type];
  const dirLabel  = isBull ? (language === "ko" ? "상승" : "BULL") : (language === "ko" ? "하락" : "BEAR");
  const description = language === "ko" ? signal.descriptionKo : signal.descriptionEn;
  const priceFmt = formatPrice(signal.currentPrice);
  const relTime = formatRelativeTime(signal.detectedAt, language);

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      className={`${styles.card} ${isBull ? styles.cardBull : styles.cardBear} ${isStrong ? styles.cardStrong : ""} ${isPredict ? styles.cardPredict : ""}`}
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
      </div>

      <p className={styles.cardDesc}>{description}</p>

      <dl className={styles.cardMeta}>
        <div className={styles.metaRow}>
          <dt>{language === "ko" ? "현재가" : "Price"}</dt>
          <dd className={styles.priceValue}>${priceFmt}</dd>
        </div>
        {signal.przMin !== undefined && signal.przMax !== undefined && (
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
    </article>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────
function tfLabel(tf: TF): string {
  return tf;
}

function formatPrice(p: number): string {
  if (p >= 1000)  return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1)     return p.toFixed(3);
  if (p >= 0.01)  return p.toFixed(4);
  return p.toFixed(6);
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

const COPY = {
  ko: {
    title:    "기술적 시그널 스캐너",
    hint:     "하모닉 패턴 · RSI 다이버전스 · 매물대 돌파 — 브라우저에서 실시간 감지 (60초 주기)",
    scanning: "스캔 중…",
    updated:  "·",
    refresh:  "새로고침",
    loading:  "모든 코인의 15m / 1h / 4h 타임프레임을 분석 중입니다…",
    empty:    "조건에 맞는 시그널이 없습니다",
    emptyHint:"필터를 변경하거나 잠시 후 다시 시도해보세요",
    errorHint:"거래소 API 요청이 차단되었을 수 있습니다. 잠시 후 다시 시도해주세요.",
    sTotal:   "총 시그널",
    sBullish: "상승",
    sBearish: "하락",
    sStrong:  "강력",
    fType:    "유형",
    fDir:     "방향",
    typeLabels: {
      ALL:          "전체",
      PREDICTIVE:   "⏳ 예측",
      HARMONIC:     "하모닉",
      DIVERGENCE:   "다이버전스",
      ZONE_BREAK:   "매물대",
      HARMONIC_PRZ: "PRZ 접근",
      ZONE_APPROACH:"돌파 임박",
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
    loading:  "Analyzing 15m / 1h / 4h timeframes across all coins…",
    empty:    "No signals match the current filters",
    emptyHint:"Try changing filters or refresh shortly",
    errorHint:"Exchange API request may have been blocked. Please try again shortly.",
    sTotal:   "Total",
    sBullish: "Bullish",
    sBearish: "Bearish",
    sStrong:  "Strong",
    fType:    "Type",
    fDir:     "Direction",
    typeLabels: {
      ALL:          "All",
      PREDICTIVE:   "⏳ Predict",
      HARMONIC:     "Harmonic",
      DIVERGENCE:   "Divergence",
      ZONE_BREAK:   "Zone",
      HARMONIC_PRZ: "PRZ Watch",
      ZONE_APPROACH:"Breakout Soon",
    },
    dirLabels: {
      ALL:     "All",
      BULLISH: "▲ Bull",
      BEARISH: "▼ Bear",
    },
  },
} as const;
