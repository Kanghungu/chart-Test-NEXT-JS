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
  const [expandedTechId, setExpandedTechId] = useState<string | null>(null);

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
              <TechCard
                key={s.id}
                signal={s}
                language={language}
                expanded={expandedTechId === s.id}
                onToggle={() => setExpandedTechId((current) => current === s.id ? null : s.id)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Tech Signal Card ──────────────────────────────────────────────────────
function TechCard({
  signal,
  language,
  expanded,
  onToggle,
}: {
  signal: TechSignal;
  language: "ko" | "en";
  expanded: boolean;
  onToggle: () => void;
}) {
  const tint    = COIN_TINT[signal.base] ?? "#64748b";
  const isBull  = signal.direction === "BULLISH";
  const isStrong = signal.strength === "STRONG";
  const desc    = language === "ko" ? signal.descKo : signal.descEn;
  const relTime = formatRelativeTimeTech(signal.detectedAt, language);
  const detail = buildTechDetail(signal, language);

  const TYPE_LABEL: Record<TechSignalType, string> = {
    EMA_CROSS:  language === "ko" ? "EMA 크로스" : "EMA Cross",
    BB_SQUEEZE: language === "ko" ? "BB 스퀴즈"  : "BB Squeeze",
    VOL_SPIKE:  language === "ko" ? "거래량 급등" : "Vol Spike",
    STOCH_RSI:  "Stoch RSI",
  };

  return (
    <article
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      className={`${styles.card} ${expanded ? styles.cardExpanded : ""} ${isBull ? styles.cardBull : signal.direction === "BEARISH" ? styles.cardBear : ""} ${isStrong ? styles.cardStrong : ""}`}
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

      {expanded && (
        <div className={styles.detailPanel}>
          <div className={styles.detailTop}>
            <div>
              <p className={styles.detailKicker}>{language === "ko" ? "상세 조회" : "Signal Lookup"}</p>
              <h3 className={styles.detailTitle}>{signal.base}/USDT · {TYPE_LABEL[signal.type]}</h3>
            </div>
            <span className={`${styles.detailBias} ${isBull ? styles.biasBull : signal.direction === "BEARISH" ? styles.biasBear : styles.biasNeutral}`}>
              {detail.bias}
            </span>
          </div>

          <div className={styles.detailSnapshot}>
            <div>
              <span>{language === "ko" ? "현재가" : "Last Price"}</span>
              <strong>${formatPrice(signal.currentPrice)}</strong>
            </div>
            <div>
              <span>{language === "ko" ? "신뢰도" : "Conviction"}</span>
              <strong>{signal.strength}</strong>
            </div>
            <div>
              <span>{language === "ko" ? "타임프레임" : "Timeframe"}</span>
              <strong>{signal.timeframe}</strong>
            </div>
          </div>

          <div className={styles.detailSections}>
            <section className={styles.detailSection}>
              <span className={styles.sectionLabel}>{language === "ko" ? "핵심 지표" : "Key Metrics"}</span>
              <div className={styles.metricList}>
                {detail.metrics.map((item) => (
                  <div key={item.label} className={styles.metricItem}>
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.detailSection}>
              <span className={styles.sectionLabel}>{language === "ko" ? "판단 포인트" : "Decision Points"}</span>
              <ul className={styles.checkList}>
                {detail.checks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </div>

          <div className={styles.playbook}>
            <div>
              <span>{language === "ko" ? "트리거" : "Trigger"}</span>
              <p>{detail.trigger}</p>
            </div>
            <div>
              <span>{language === "ko" ? "무효화" : "Invalidation"}</span>
              <p>{detail.invalidation}</p>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function buildTechDetail(signal: TechSignal, language: "ko" | "en") {
  const isKo = language === "ko";
  const isBull = signal.direction === "BULLISH";
  const extra = signal.extra ?? {};
  const read = (key: string, fallback = "-") => extra[key] === undefined ? fallback : String(extra[key]);
  const bias = signal.direction === "NEUTRAL"
    ? (isKo ? "중립 관찰" : "Neutral Watch")
    : isBull
      ? (isKo ? "상방 우위" : "Bullish Bias")
      : (isKo ? "하방 우위" : "Bearish Bias");

  const baseMetrics = [
    { label: isKo ? "감지 시각" : "Detected", value: formatRelativeTimeTech(signal.detectedAt, language) },
    { label: isKo ? "방향" : "Direction", value: bias },
  ];

  if (signal.type === "EMA_CROSS") {
    const emaKeys = Object.keys(extra).filter((key) => key.startsWith("ema"));
    return {
      bias,
      metrics: [
        ...baseMetrics,
        ...emaKeys.map((key) => ({ label: key.toUpperCase(), value: `$${formatPrice(Number(extra[key]))}` })),
      ],
      checks: [
        isKo ? "크로스 이후 종가가 느린 EMA 위/아래에서 유지되는지 확인" : "Check whether closes hold beyond the slow EMA after the cross",
        isKo ? "다음 캔들 거래량이 평균보다 증가하면 신뢰도 상승" : "Rising follow-through volume improves conviction",
        isKo ? "상위 타임프레임 추세와 같은 방향이면 우선순위 높음" : "Higher-timeframe alignment increases priority",
      ],
      trigger: isBull
        ? (isKo ? "가격이 느린 EMA 위에서 재테스트를 지키면 추세 전환 후보" : "A held retest above the slow EMA favors a trend-shift setup")
        : (isKo ? "가격이 느린 EMA 아래에서 반등 실패하면 조정 지속 후보" : "A failed retest below the slow EMA favors downside continuation"),
      invalidation: isBull
        ? (isKo ? "종가가 다시 느린 EMA 아래로 내려가면 신호 약화" : "A close back below the slow EMA weakens the signal")
        : (isKo ? "종가가 다시 느린 EMA 위로 회복하면 신호 약화" : "A close back above the slow EMA weakens the signal"),
    };
  }

  if (signal.type === "BB_SQUEEZE") {
    const widthNow = Number(extra.widthNow);
    const widthMin = Number(extra.widthMin);
    const expansion = Number.isFinite(widthNow) && Number.isFinite(widthMin) && widthMin > 0
      ? `${((widthNow / widthMin - 1) * 100).toFixed(1)}%`
      : "-";
    return {
      bias,
      metrics: [
        ...baseMetrics,
        { label: isKo ? "현재 밴드폭" : "Width Now", value: read("widthNow") },
        { label: isKo ? "저점 밴드폭" : "Width Low", value: read("widthMin") },
        { label: isKo ? "확장률" : "Expansion", value: expansion },
      ],
      checks: [
        isKo ? "밴드폭이 최저 구간에서 벗어나는 첫 구간인지 확인" : "Verify this is an early expansion out of compressed bandwidth",
        isKo ? "중심선 위/아래 종가 유지가 방향 판단의 핵심" : "Closes holding above or below the midline define the bias",
        isKo ? "돌파 캔들에 거래량이 붙으면 추적 가치 상승" : "Breakout volume makes the setup more actionable",
      ],
      trigger: isBull
        ? (isKo ? "상단 밴드 돌파 후 중심선 위 종가 유지" : "Upper-band breakout with closes holding above the midline")
        : signal.direction === "BEARISH"
          ? (isKo ? "하단 밴드 이탈 후 중심선 아래 종가 유지" : "Lower-band break with closes holding below the midline")
          : (isKo ? "방향 확정 전까지 상하단 밴드 돌파를 대기" : "Wait for a clean upper or lower band break"),
      invalidation: isKo ? "밴드폭이 다시 수축하고 가격이 중심선으로 회귀하면 관찰 모드" : "If bandwidth contracts again and price returns to the midline, downgrade to watch mode",
    };
  }

  if (signal.type === "VOL_SPIKE") {
    return {
      bias,
      metrics: [
        ...baseMetrics,
        { label: isKo ? "평균 대비 거래량" : "Volume Ratio", value: `${read("ratio")}x` },
        { label: isKo ? "압력" : "Pressure", value: isBull ? (isKo ? "매수 우세" : "Buying") : (isKo ? "매도 우세" : "Selling") },
      ],
      checks: [
        isKo ? "거래량 급등 캔들의 고가/저가가 다음 캔들에서 지켜지는지 확인" : "Check whether the spike candle high or low is respected next",
        isKo ? "꼬리가 길면 흡수 가능성이 있어 종가 위치가 중요" : "Long wicks can imply absorption, so close location matters",
        isKo ? "급등 거래량 이후 같은 방향 후속 캔들이 나오면 강도 상승" : "Same-direction follow-through after the spike raises conviction",
      ],
      trigger: isBull
        ? (isKo ? "급등 캔들 고가 돌파 또는 눌림 후 고가 재돌파" : "Break above the spike candle high, or reclaim it after a pullback")
        : (isKo ? "급등 캔들 저가 이탈 또는 반등 실패" : "Break below the spike candle low, or fail a reclaim attempt"),
      invalidation: isBull
        ? (isKo ? "급등 캔들 저가를 종가로 이탈하면 매수 압력 훼손" : "A close below the spike candle low invalidates buying pressure")
        : (isKo ? "급등 캔들 고가를 종가로 회복하면 매도 압력 훼손" : "A close above the spike candle high invalidates selling pressure"),
    };
  }

  return {
    bias,
    metrics: [
      ...baseMetrics,
      { label: "Stoch K", value: read("k") },
      { label: "Stoch D", value: read("d") },
      { label: isKo ? "구간" : "Zone", value: isBull ? (isKo ? "과매도 반등" : "Oversold Bounce") : (isKo ? "과매수 조정" : "Overbought Pullback") },
    ],
    checks: [
      isKo ? "K/D 교차 뒤 20/80 구간 밖으로 빠져나오는지 확인" : "Confirm K/D moves out of the 20/80 extreme after the cross",
      isKo ? "가격이 직전 스윙 고점/저점을 회복 또는 이탈해야 신뢰도 상승" : "Price needs to reclaim or lose the prior swing for confirmation",
      isKo ? "횡보장에서는 짧은 반응, 추세장에서는 되돌림 신호로 해석" : "In ranges it is a short reaction; in trends it is a pullback signal",
    ],
    trigger: isBull
      ? (isKo ? "K가 D 위에서 유지되고 가격이 직전 고점을 회복" : "K holds above D while price reclaims the prior swing high")
      : (isKo ? "K가 D 아래에서 유지되고 가격이 직전 저점을 이탈" : "K holds below D while price loses the prior swing low"),
    invalidation: isBull
      ? (isKo ? "K가 다시 D 아래로 내려가면 반등 신호 약화" : "K crossing back below D weakens the bounce setup")
      : (isKo ? "K가 다시 D 위로 올라오면 조정 신호 약화" : "K crossing back above D weakens the pullback setup"),
  };
}
