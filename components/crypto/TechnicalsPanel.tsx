"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import {
  scanTechnicalSignals,
  formatRelativeTimeTech,
  formatPrice,
  type TechSignal,
  type TechSignalType,
} from "@/lib/technicalSignals";
import styles from "./TechnicalsPanel.module.css";

type DirFilter  = "ALL" | "BULLISH" | "BEARISH";
type TypeFilter = "ALL" | TechSignalType;

const COPY = {
  ko: {
    kicker:    "03 · TECHNICALS",
    title:     "테크니컬 시그널 스캐너",
    hint:      "EMA 크로스 · BB 스퀴즈 · 거래량 급등 · Stoch RSI — 개인용 (1h/4h)",
    scanning:  "스캔 중…",
    updated:   "·",
    refresh:   "새로고침",
    loading:   "모든 코인의 1h/4h 타임프레임을 분석 중…",
    empty:     "감지된 시그널이 없습니다",
    emptyHint: "필터를 변경하거나 잠시 후 다시 시도해보세요",
    sTotal:    "총",
    sBullish:  "상승",
    sBearish:  "하락",
    sStrong:   "강력",
    fType:     "유형",
    fDir:      "방향",
    typeLabels: {
      ALL:       "전체",
      EMA_CROSS: "EMA 크로스",
      BB_SQUEEZE:"BB 스퀴즈",
      VOL_SPIKE: "거래량 급등",
      STOCH_RSI: "Stoch RSI",
    },
    dirLabels: {
      ALL:     "전체",
      BULLISH: "▲ 상승",
      BEARISH: "▼ 하락",
    },
  },
  en: {
    kicker:    "03 · TECHNICALS",
    title:     "Technical Signal Scanner",
    hint:      "EMA Cross · BB Squeeze · Volume Spike · Stoch RSI — Personal (1h/4h)",
    scanning:  "Scanning…",
    updated:   "·",
    refresh:   "Refresh",
    loading:   "Analyzing 1h/4h timeframes across all coins…",
    empty:     "No signals detected",
    emptyHint: "Try changing filters or refresh shortly",
    sTotal:    "Total",
    sBullish:  "Bullish",
    sBearish:  "Bearish",
    sStrong:   "Strong",
    fType:     "Type",
    fDir:      "Direction",
    typeLabels: {
      ALL:       "All",
      EMA_CROSS: "EMA Cross",
      BB_SQUEEZE:"BB Squeeze",
      VOL_SPIKE: "Vol Spike",
      STOCH_RSI: "Stoch RSI",
    },
    dirLabels: {
      ALL:     "All",
      BULLISH: "▲ Bull",
      BEARISH: "▼ Bear",
    },
  },
} as const;

const COIN_TINT: Record<string, string> = {
  BTC: "#f7931a", ETH: "#627eea", SOL: "#14f195", XRP: "#00a3e0",
  BNB: "#f3ba2f", ADA: "#0033ad", DOGE: "#c2a633", LTC: "#bfbbbb",
  TAO: "#7c3aed", WLD: "#06b6d4", ENA: "#ec4899", MAGIC: "#f59e0b",
  VIRTUAL: "#a78bfa", TURBO: "#fb923c",
};

const TYPE_COLOR: Record<TechSignalType, string> = {
  EMA_CROSS: styles.typeEma ?? "",
  BB_SQUEEZE: styles.typeBb ?? "",
  VOL_SPIKE: styles.typeVol ?? "",
  STOCH_RSI: styles.typeStoch ?? "",
};

export default function TechnicalsPanel() {
  const { language } = useLanguage();
  const C = COPY[language];

  const [signals, setSignals]   = useState<TechSignal[]>([]);
  const [loading, setLoading]   = useState(true);
  const [lastScan, setLastScan] = useState(0);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [dirFilter,  setDirFilter]  = useState<DirFilter>("ALL");

  async function scan() {
    const result = await scanTechnicalSignals();
    setSignals(result);
    setLastScan(Date.now());
    setLoading(false);
  }

  useEffect(() => {
    scan();
    const t = setInterval(scan, 60_000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => signals.filter((s) => {
    if (typeFilter !== "ALL" && s.type !== typeFilter) return false;
    if (dirFilter  !== "ALL" && s.direction !== dirFilter) return false;
    return true;
  }), [signals, typeFilter, dirFilter]);

  const stats = useMemo(() => ({
    total:   signals.length,
    bullish: signals.filter((s) => s.direction === "BULLISH").length,
    bearish: signals.filter((s) => s.direction === "BEARISH").length,
    strong:  signals.filter((s) => s.strength === "STRONG").length,
  }), [signals]);

  const lastLabel = lastScan ? formatRelativeTimeTech(lastScan, language) : C.scanning;

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

      {/* Summary */}
      <div className={styles.summaryGrid}>
        {[
          { label: C.sTotal,   value: stats.total,   cls: styles.toneNeutral },
          { label: C.sBullish, value: stats.bullish, cls: styles.toneBull },
          { label: C.sBearish, value: stats.bearish, cls: styles.toneBear },
          { label: C.sStrong,  value: stats.strong,  cls: styles.toneStrong },
        ].map(({ label, value, cls }) => (
          <div key={label} className={`${styles.summaryCard} ${cls}`}>
            <span className={styles.summaryLabel}>{label}</span>
            <span className={styles.summaryValue}>{value}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={styles.filterRow}>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{C.fType}</span>
          {(["ALL", "EMA_CROSS", "BB_SQUEEZE", "VOL_SPIKE", "STOCH_RSI"] as const).map((v) => (
            <button
              key={v}
              className={`${styles.pill} ${typeFilter === v ? styles.pillActive : ""}`}
              onClick={() => setTypeFilter(v)}
            >
              {C.typeLabels[v]}
            </button>
          ))}
        </div>
        <div className={styles.filterGroup}>
          <span className={styles.filterLabel}>{C.fDir}</span>
          {(["ALL", "BULLISH", "BEARISH"] as const).map((v) => (
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
        {!loading && filtered.length === 0 && (
          <div className={styles.stateBox}>
            <p>{C.empty}</p>
            <p className={styles.hintSm}>{C.emptyHint}</p>
          </div>
        )}
        {filtered.length > 0 && (
          <div className={styles.cardGrid}>
            {filtered.map((s) => (
              <TechCard key={s.id} signal={s} language={language} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Tech Signal Card ──────────────────────────────────────────────────────
function TechCard({ signal, language }: { signal: TechSignal; language: "ko" | "en" }) {
  const tint    = COIN_TINT[signal.base] ?? "#64748b";
  const isBull  = signal.direction === "BULLISH";
  const isStrong = signal.strength === "STRONG";
  const desc    = language === "ko" ? signal.descKo : signal.descEn;
  const relTime = formatRelativeTimeTech(signal.detectedAt, language);

  const TYPE_LABEL: Record<TechSignalType, string> = {
    EMA_CROSS:  language === "ko" ? "EMA 크로스" : "EMA Cross",
    BB_SQUEEZE: language === "ko" ? "BB 스퀴즈"  : "BB Squeeze",
    VOL_SPIKE:  language === "ko" ? "거래량 급등" : "Vol Spike",
    STOCH_RSI:  "Stoch RSI",
  };

  return (
    <article
      className={`${styles.card} ${isBull ? styles.cardBull : signal.direction === "BEARISH" ? styles.cardBear : ""} ${isStrong ? styles.cardStrong : ""}`}
      style={{ "--tint": tint } as React.CSSProperties}
    >
      <span className={styles.cardTintBar} aria-hidden="true" />

      <header className={styles.cardHeader}>
        <div className={styles.cardBaseWrap}>
          <span className={styles.cardBase}>{signal.base}</span>
          <span className={styles.cardTf}>{signal.timeframe}</span>
        </div>
        {isStrong && <span className={styles.strongFlag}>STRONG</span>}
        {signal.direction !== "NEUTRAL" && (
          <span className={`${styles.dirBadge} ${isBull ? styles.dirBull : styles.dirBear}`}>
            {isBull ? "▲" : "▼"} {isBull ? (language === "ko" ? "상승" : "BULL") : (language === "ko" ? "하락" : "BEAR")}
          </span>
        )}
      </header>

      <div className={styles.cardBadges}>
        <span className={`${styles.typeBadge} ${styles[`type_${signal.type}`]}`}>
          {TYPE_LABEL[signal.type]}
        </span>
        {isStrong && <span className={styles.strongBadge}>★ STRONG</span>}
      </div>

      <p className={styles.cardLabel}>{signal.label}</p>
      <p className={styles.cardDesc}>{desc}</p>

      {signal.extra && (
        <div className={styles.extraRow}>
          {Object.entries(signal.extra).map(([k, v]) => (
            <span key={k} className={styles.extraChip}>
              <span className={styles.extraKey}>{k}</span>
              <span className={styles.extraVal}>{v}</span>
            </span>
          ))}
        </div>
      )}

      <dl className={styles.cardMeta}>
        <div className={styles.metaRow}>
          <dt>{language === "ko" ? "현재가" : "Price"}</dt>
          <dd className={styles.priceValue}>${formatPrice(signal.currentPrice)}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>{language === "ko" ? "탐지" : "Detected"}</dt>
          <dd>{relTime}</dd>
        </div>
      </dl>
    </article>
  );
}
