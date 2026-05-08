"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/components/discover/DiscoverPage.module.css";
import cStyles from "./calendar.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import {
  getLocalizedEventCountry,
  getLocalizedEventTitle,
  getLocalizedImpact
} from "@/lib/marketLocalization";

type EventItem = {
  time: string;
  country: string;
  countryKo?: string;
  countryEn?: string;
  title: string;
  titleKo?: string;
  titleEn?: string;
  impact: string;
  impactKo?: string;
  impactEn?: string;
};

const COPY = {
  ko: {
    eyebrow: "거시 캘린더",
    title: "경제 일정 캘린더",
    description: "이번 주 시장에 영향을 줄 이벤트를 국가별로 빠르게 훑어보고, 높은 중요도 일정부터 확인할 수 있습니다.",
    totalEvents: "전체 일정",
    highImpact: "높은 중요도",
    countryFilter: "국가 필터",
    currentEvents: "현재 로드된 이벤트 수",
    priorityHint: "우선 체크할 이벤트",
    scopeHint: "시장 관찰 범위",
    all: "전체",
    byCountry: "국가별 보기",
    filterCaption: "캘린더 필터",
    weeklyEvents: "이번 주 핵심 일정",
    checkPoints: "체크 포인트",
    guide: "가이드",
    empty: "표시할 일정이 없습니다.",
    items: "개",
    countdown: "다음 고중요도 이벤트",
    countdownUntil: "까지",
    countdownNow: "발표 중 / 방금 발표",
    countdownHint: "고중요도 이벤트 기준",
    timeUntilLabel: "남은 시간",
    tips: [
      "높은 중요도 일정은 발표 전후로 차트와 뉴스 흐름을 함께 보는 편이 좋습니다.",
      "미국 이벤트가 몰리면 미국주식과 한국주식 변동성이 함께 커질 수 있습니다.",
      "한국, 일본, 유럽 일정은 아시아 세션과 선물 흐름을 읽는 데 유용합니다.",
      "캘린더 화면은 장 시작 전 브리핑 용도로 특히 잘 맞습니다."
    ]
  },
  en: {
    eyebrow: "MACRO CALENDAR",
    title: "Economic calendar",
    description: "Scan the events most likely to move markets this week and prioritize the highest-impact releases.",
    totalEvents: "Total events",
    highImpact: "High impact",
    countryFilter: "Country filter",
    currentEvents: "Currently loaded events",
    priorityHint: "Events worth prioritizing",
    scopeHint: "Observation scope",
    all: "All",
    byCountry: "By country",
    filterCaption: "Calendar filter",
    weeklyEvents: "Key events this week",
    checkPoints: "Check points",
    guide: "Guide",
    empty: "No events to display.",
    items: "items",
    countdown: "Next High-Impact Event",
    countdownUntil: "until",
    countdownNow: "Live / Just released",
    countdownHint: "High-impact events only",
    timeUntilLabel: "Time left",
    tips: [
      "For high-impact releases, keep the chart tab open before and after the event.",
      "When US events are stacked, volatility in US and Korean equities often rises together.",
      "Korea, Japan, and Europe events help frame the Asia session and futures tone.",
      "This calendar is especially useful as a pre-market briefing screen."
    ]
  }
} as const;

/** ISO 날짜 문자열을 읽기 쉬운 형식으로 변환 */
function formatEventTime(iso: string, language: "ko" | "en"): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const locale = language === "ko" ? "ko-KR" : "en-US";
    return d.toLocaleString(locale, {
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function formatCountdown(ms: number, language: "ko" | "en"): string {
  if (ms <= 0) return language === "ko" ? "발표 중 / 방금 발표" : "Live / Just released";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  if (h > 0) return language === "ko" ? `${h}시간 ${m}분 후` : `${h}h ${m}m left`;
  if (m > 0) return language === "ko" ? `${m}분 ${s}초 후` : `${m}m ${s}s left`;
  return language === "ko" ? `${s}초 후` : `${s}s left`;
}

function getImpactClass(impact: string) {
  const upper = impact.toUpperCase();
  if (upper.includes("HIGH") || impact.includes("높")) return styles.impactHigh;
  if (upper.includes("MEDIUM") || impact.includes("중")) return styles.impactMedium;
  return styles.impactLow;
}

export default function CalendarPage() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const [events, setEvents] = useState<EventItem[]>([]);
  const [country, setCountry] = useState("all");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await fetch("/api/market/events", { cache: "no-store" });
        const json = await res.json();
        if (mounted) setEvents(Array.isArray(json?.items) ? json.items : []);
      } catch {
        if (mounted) setEvents([]);
      }
    };

    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  // 1초마다 카운트다운 업데이트
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const countries = useMemo(
    () => ["all", ...new Set(events.map((item) => getLocalizedEventCountry(item, language)))],
    [events, language]
  );

  // 다음 고중요도 이벤트 (미래 + 높음)
  const nextHighEvent = useMemo(() => {
    return events
      .filter(e => {
        const isHigh = e.impact?.toUpperCase().includes("HIGH") || e.impactKo?.includes("높");
        const t = new Date(e.time).getTime();
        return isHigh && isFinite(t) && t > now - 30 * 60_000; // 30분 이내 지난 것도 포함
      })
      .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())[0] ?? null;
  }, [events, now]);

  const nextHighMs = nextHighEvent ? new Date(nextHighEvent.time).getTime() - now : null;

  const visibleEvents = useMemo(() => {
    if (country === "all") return events;
    return events.filter((item) => getLocalizedEventCountry(item, language) === country);
  }, [country, events, language]);

  const highImpactCount = visibleEvents.filter((item) => {
    const localizedImpact = getLocalizedImpact(item, language);
    const upper = localizedImpact.toUpperCase();
    return upper.includes("HIGH") || localizedImpact.includes("높");
  }).length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 className={styles.title}>{copy.title}</h1>
            <p className={styles.description}>{copy.description}</p>
          </div>

          <div className={styles.heroStats}>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.totalEvents}</p>
              <p className={styles.statValue}>{events.length}</p>
              <p className={styles.statHint}>{copy.currentEvents}</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.highImpact}</p>
              <p className={styles.statValue}>{highImpactCount}</p>
              <p className={styles.statHint}>{copy.priorityHint}</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.countryFilter}</p>
              <p className={styles.statValue}>{country === "all" ? copy.all : country}</p>
              <p className={styles.statHint}>{copy.scopeHint}</p>
            </article>
          </div>
        </section>

        {/* 다음 고중요도 이벤트 카운트다운 */}
        {nextHighEvent && (
          <section className={cStyles.countdown}>
            <div className={cStyles.countdownLeft}>
              <span className={cStyles.countdownTag}>{copy.countdown}</span>
              <p className={cStyles.countdownTitle}>
                {language === "ko" ? (nextHighEvent.titleKo || nextHighEvent.title) : (nextHighEvent.titleEn || nextHighEvent.title)}
              </p>
              <p className={cStyles.countdownCountry}>
                {language === "ko" ? (nextHighEvent.countryKo || nextHighEvent.country) : (nextHighEvent.countryEn || nextHighEvent.country)}
                {" · "}
                {formatEventTime(nextHighEvent.time, language)}
              </p>
            </div>
            <div className={cStyles.countdownRight}>
              <p className={cStyles.countdownTime} style={{ color: nextHighMs !== null && nextHighMs <= 1800000 ? "#f87171" : "#38bdf8" }}>
                {nextHighMs !== null ? formatCountdown(nextHighMs, language) : "—"}
              </p>
              <p className={cStyles.countdownHint}>{copy.countdownHint}</p>
            </div>
          </section>
        )}

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>{copy.byCountry}</h2>
            <span className={styles.panelCaption}>{copy.filterCaption}</span>
          </div>
          <div className={styles.chipRow}>
            {countries.map((item) => (
              <button
                key={item}
                className={country === item ? styles.chipActive : styles.chip}
                onClick={() => setCountry(item)}
              >
                {item === "all" ? copy.all : item}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.grid2}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{copy.weeklyEvents}</h2>
              <span className={styles.pill}>{`${visibleEvents.length} ${copy.items}`}</span>
            </div>
            <div className={styles.stack}>
              {visibleEvents.map((item, index) => {
                const evMs = new Date(item.time).getTime() - now;
                const isSoon = isFinite(evMs) && evMs > 0 && evMs < 2 * 60 * 60_000; // 2시간 이내
                const isPast = isFinite(evMs) && evMs < -5 * 60_000; // 5분 이상 지남
                const isHigh = item.impact?.toUpperCase().includes("HIGH") || item.impactKo?.includes("높");
                return (
                  <div key={`${item.time}-${item.title}-${index}`}
                    className={`${styles.listCard} ${isSoon && isHigh ? cStyles.cardSoon : ""}`}>
                    <div className={styles.itemRow}>
                      <div>
                        <p className={styles.itemTitle}>{getLocalizedEventTitle(item, language)}</p>
                        <p className={styles.itemSub}>{getLocalizedEventCountry(item, language)}</p>
                        <p className={styles.itemMeta}>{formatEventTime(item.time, language)}</p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem" }}>
                        <span className={getImpactClass(getLocalizedImpact(item, language))}>
                          {getLocalizedImpact(item, language)}
                        </span>
                        {isFinite(evMs) && !isPast && (
                          <span className={`${cStyles.timeLeft} ${isSoon ? cStyles.timeLeftSoon : ""}`}>
                            {formatCountdown(Math.max(0, evMs), language)}
                          </span>
                        )}
                        {isPast && <span className={cStyles.timePast}>{language === "ko" ? "완료" : "Done"}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
              {!visibleEvents.length ? <p className={styles.emptyState}>{copy.empty}</p> : null}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{copy.checkPoints}</h2>
              <span className={styles.panelCaption}>{copy.guide}</span>
            </div>
            <div className={styles.stack}>
              {copy.tips.map((text) => (
                <div key={text} className={styles.listCard}>
                  <p className={styles.itemTitle}>{text}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
