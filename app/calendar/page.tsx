"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/components/discover/DiscoverPage.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type EventItem = {
  time: string;
  country: string;
  title: string;
  impact: string;
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
    priorityHint: "우선 체크가 필요한 일정",
    scopeHint: "시장 관찰 범위",
    all: "전체",
    byCountry: "국가별 보기",
    filterCaption: "캘린더 필터",
    weeklyEvents: "이번 주 핵심 일정",
    checkPoints: "체크 포인트",
    guide: "활용 가이드",
    empty: "표시할 일정이 없습니다.",
    items: "개",
    tips: [
      "높은 중요도 일정은 발표 시간 전후로 차트 탭과 함께 확인하면 좋습니다.",
      "미국 일정이 몰려 있으면 기술주와 코인 변동성이 같이 커질 수 있습니다.",
      "한국, 일본, 유럽 일정은 아시아장과 선물 흐름 해석에 유용합니다.",
      "캘린더 화면은 장 시작 전 브리핑 용도로 가장 잘 맞습니다."
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
    tips: [
      "For high-impact releases, keep the chart tab open before and after the event.",
      "When US events are stacked, volatility in tech and crypto often rises together.",
      "Korea, Japan, and Europe events help frame the Asia session and futures tone.",
      "This calendar is especially useful as a pre-market briefing screen."
    ]
  }
} as const;

function getImpactClass(impact: string) {
  const upper = impact.toUpperCase();
  if (impact.includes("높") || upper.includes("HIGH")) return styles.impactHigh;
  if (impact.includes("중") || upper.includes("MEDIUM")) return styles.impactMedium;
  return styles.impactLow;
}

export default function CalendarPage() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const [events, setEvents] = useState<EventItem[]>([]);
  const [country, setCountry] = useState("all");

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

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const countries = useMemo(() => ["all", ...new Set(events.map((item) => item.country))], [events]);
  const visibleEvents = useMemo(() => {
    if (country === "all") return events;
    return events.filter((item) => item.country === country);
  }, [country, events]);

  const highImpactCount = visibleEvents.filter((item) => {
    const upper = item.impact.toUpperCase();
    return item.impact.includes("높") || upper.includes("HIGH");
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
              {visibleEvents.map((item, index) => (
                <div key={`${item.time}-${item.title}-${index}`} className={styles.listCard}>
                  <div className={styles.itemRow}>
                    <div>
                      <p className={styles.itemTitle}>{item.title}</p>
                      <p className={styles.itemSub}>{item.country}</p>
                      <p className={styles.itemMeta}>{item.time}</p>
                    </div>
                    <span className={getImpactClass(item.impact)}>{item.impact}</span>
                  </div>
                </div>
              ))}
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
