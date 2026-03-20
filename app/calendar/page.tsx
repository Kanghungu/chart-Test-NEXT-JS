"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/components/discover/DiscoverPage.module.css";

type EventItem = {
  time: string;
  country: string;
  title: string;
  impact: string;
};

function getImpactClass(impact: string) {
  if (impact.includes("높")) return styles.impactHigh;
  if (impact.includes("중")) return styles.impactMedium;
  return styles.impactLow;
}

export default function CalendarPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [country, setCountry] = useState("all");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await fetch("/api/market/events", { cache: "no-store" });
        const json = await res.json();
        if (mounted) {
          setEvents(Array.isArray(json?.items) ? json.items : []);
        }
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

  const highImpactCount = visibleEvents.filter((item) => item.impact.includes("높")).length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>MACRO CALENDAR</p>
            <h1 className={styles.title}>경제 일정 캘린더</h1>
            <p className={styles.description}>
              이번 주 시장에 영향을 줄 이벤트를 국가별로 빠르게 훑어보고, 높은 중요도 일정부터 우선 확인할 수 있는 화면입니다.
            </p>
          </div>

          <div className={styles.heroStats}>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>전체 일정</p>
              <p className={styles.statValue}>{events.length}</p>
              <p className={styles.statHint}>현재 로드된 이벤트 수</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>높은 중요도</p>
              <p className={styles.statValue}>{highImpactCount}</p>
              <p className={styles.statHint}>우선 체크가 필요한 일정</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>국가 필터</p>
              <p className={styles.statValue}>{country === "all" ? "전체" : country}</p>
              <p className={styles.statHint}>시장 관찰 범위</p>
            </article>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>국가별 보기</h2>
            <span className={styles.panelCaption}>캘린더 필터</span>
          </div>
          <div className={styles.chipRow}>
            {countries.map((item) => (
              <button
                key={item}
                className={country === item ? styles.chipActive : styles.chip}
                onClick={() => setCountry(item)}
              >
                {item === "all" ? "전체" : item}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.grid2}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>이번 주 핵심 일정</h2>
              <span className={styles.pill}>{visibleEvents.length} items</span>
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
              {!visibleEvents.length ? <p className={styles.emptyState}>표시할 일정이 없습니다.</p> : null}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>체크 포인트</h2>
              <span className={styles.panelCaption}>활용 가이드</span>
            </div>
            <div className={styles.stack}>
              {[
                "높은 중요도 일정은 발표 시간 전후로 차트 탭과 함께 확인하면 좋습니다.",
                "미국 일정이 몰려 있으면 기술주와 코인 변동성이 같이 커질 가능성이 있습니다.",
                "한국, 일본, 유럽 일정은 아시아장과 선물 흐름 해석에 유용합니다.",
                "캘린더 화면은 장 시작 전 브리핑 용도로 가장 잘 맞습니다."
              ].map((text) => (
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
