"use client";

import { useMemo, useState } from "react";
import styles from "./EarningsCalendar.module.css";
import { EARNINGS_DATA, type EarningsEntry } from "@/lib/earningsData";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type Filter = "all" | "week" | "month";

function parseDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00");
}

function formatDisplayDate(dateStr: string, lang: "ko" | "en") {
  const d = parseDate(dateStr);
  if (lang === "ko") {
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getDaysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = parseDate(dateStr);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function groupByDate(entries: EarningsEntry[]): Map<string, EarningsEntry[]> {
  const map = new Map<string, EarningsEntry[]>();
  for (const entry of entries) {
    const existing = map.get(entry.date) || [];
    map.set(entry.date, [...existing, entry]);
  }
  return map;
}

export default function EarningsCalendar() {
  const { language } = useLanguage();
  const [filter, setFilter] = useState<Filter>("month");
  const [market, setMarket] = useState<"all" | "US" | "KR">("all");

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const filtered = useMemo(() => {
    const entries = EARNINGS_DATA.filter((e) => {
      const d = parseDate(e.date);
      if (d < today) return false;
      if (market !== "all" && e.market !== market) return false;
      const days = getDaysUntil(e.date);
      if (filter === "week" && days > 7) return false;
      if (filter === "month" && days > 31) return false;
      return true;
    });
    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }, [filter, market, today]);

  const grouped = useMemo(() => groupByDate(filtered), [filtered]);
  const sortedDates = useMemo(() => [...grouped.keys()].sort(), [grouped]);

  const COPY = {
    ko: {
      eyebrow: "EARNINGS",
      title: "실적 발표 캘린더",
      subtitle: "주요 기업 어닝 일정",
      all: "전체",
      week: "이번 주",
      month: "이번 달",
      allMarket: "전체",
      us: "미국",
      kr: "한국",
      bmo: "장 전",
      amc: "장 후",
      tbd: "미정",
      eps: "예상 EPS",
      rev: "예상 매출",
      empty: "해당 기간 실적 발표가 없습니다",
      daysUntil: (n: number) => n === 0 ? "오늘" : n === 1 ? "내일" : `${n}일 후`,
    },
    en: {
      eyebrow: "EARNINGS",
      title: "Earnings Calendar",
      subtitle: "Upcoming company results",
      all: "All",
      week: "This week",
      month: "This month",
      allMarket: "All",
      us: "US",
      kr: "Korea",
      bmo: "BMO",
      amc: "AMC",
      tbd: "TBD",
      eps: "Est. EPS",
      rev: "Est. Rev.",
      empty: "No earnings scheduled for this period",
      daysUntil: (n: number) => n === 0 ? "Today" : n === 1 ? "Tomorrow" : `in ${n}d`,
    },
  };

  const copy = COPY[language];

  return (
    <section className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 className={styles.title}>{copy.title}</h2>
          <p className={styles.subtitle}>{copy.subtitle}</p>
        </div>
        <div className={styles.controls}>
          <div className={styles.tabs}>
            {(["all", "week", "month"] as Filter[]).map((f) => (
              <button
                key={f}
                className={`${styles.tab} ${filter === f ? styles.tabActive : ""}`}
                onClick={() => setFilter(f)}
              >
                {copy[f]}
              </button>
            ))}
          </div>
          <div className={styles.tabs}>
            {(["all", "US", "KR"] as const).map((m) => (
              <button
                key={m}
                className={`${styles.tab} ${market === m ? styles.tabActive : ""}`}
                onClick={() => setMarket(m)}
              >
                {m === "all" ? copy.allMarket : m === "US" ? copy.us : copy.kr}
              </button>
            ))}
          </div>
        </div>
      </div>

      {sortedDates.length === 0 ? (
        <p className={styles.empty}>{copy.empty}</p>
      ) : (
        <div className={styles.list}>
          {sortedDates.map((date) => {
            const entries = grouped.get(date)!;
            const daysUntil = getDaysUntil(date);
            const isToday = daysUntil === 0;
            const isTomorrow = daysUntil === 1;

            return (
              <div key={date} className={styles.dateGroup}>
                <div className={styles.dateRow}>
                  <span className={`${styles.dateLabel} ${isToday ? styles.dateLabelToday : ""}`}>
                    {formatDisplayDate(date, language)}
                  </span>
                  <span className={`${styles.daysTag} ${isToday ? styles.daysTagToday : isTomorrow ? styles.daysTagSoon : ""}`}>
                    {copy.daysUntil(daysUntil)}
                  </span>
                </div>
                <div className={styles.entries}>
                  {entries.map((entry) => {
                    const name = language === "ko" ? entry.nameKo : entry.nameEn;
                    const timeLabel = copy[entry.time.toLowerCase() as "bmo" | "amc" | "tbd"];
                    return (
                      <div key={entry.symbol} className={`${styles.entryCard} ${entry.market === "US" ? styles.usCard : styles.krCard}`}>
                        <div className={styles.entryTop}>
                          <div className={styles.entryMeta}>
                            <span className={styles.entrySymbol}>{entry.symbol}</span>
                            <span className={styles.entryName}>{name}</span>
                          </div>
                          <div className={styles.entryRight}>
                            <span className={`${styles.timeBadge} ${entry.time === "BMO" ? styles.bmoBadge : entry.time === "AMC" ? styles.amcBadge : styles.tbdBadge}`}>
                              {timeLabel}
                            </span>
                            <span className={`${styles.marketBadge} ${entry.market === "US" ? styles.usBadge : styles.krBadge}`}>
                              {entry.market}
                            </span>
                          </div>
                        </div>
                        {(entry.epsEstKo || entry.revenueEstKo) && (
                          <div className={styles.entryStats}>
                            {entry.epsEstKo && (
                              <span className={styles.entryStat}>
                                <span className={styles.entryStatLabel}>{copy.eps}</span>
                                <span className={styles.entryStatValue}>{language === "ko" ? entry.epsEstKo : entry.epsEstEn}</span>
                              </span>
                            )}
                            {entry.revenueEstKo && (
                              <span className={styles.entryStat}>
                                <span className={styles.entryStatLabel}>{copy.rev}</span>
                                <span className={styles.entryStatValue}>{language === "ko" ? entry.revenueEstKo : entry.revenueEstEn}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
