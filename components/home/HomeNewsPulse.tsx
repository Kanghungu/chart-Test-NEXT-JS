"use client";

import { useEffect, useState } from "react";
import styles from "./HomeNewsPulse.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type KeywordRow = {
  id: string;
  labelKo: string;
  labelEn: string;
  count: number;
};

type AggregateResponse = {
  source: string;
  scanned: number;
  keywords: KeywordRow[];
  categoryCounts: Record<string, number>;
  error?: string;
};

const COPY = {
  ko: {
    eyebrow: "NEWS PULSE",
    title: "최근 뉴스 키워드 펄스",
    description: "DB에 적재된 최신 기사에서 자주 등장하는 테마를 빠르게 보여줍니다.",
    empty: "집계할 뉴스가 아직 없습니다. `npm run db:seed` 또는 뉴스 ingest를 실행해 보세요.",
    scanned: "분석한 기사 수",
    categories: "카테고리 분포"
  },
  en: {
    eyebrow: "NEWS PULSE",
    title: "Recent headline keyword pulse",
    description: "Themes that show up most often in the latest articles stored in the database.",
    empty: "No articles to analyze yet. Run `npm run db:seed` or wire a news ingest job.",
    scanned: "Articles scanned",
    categories: "Category mix"
  }
} as const;

export default function HomeNewsPulse() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const [data, setData] = useState<AggregateResponse | null>(null);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await fetch("/api/news/aggregate", { cache: "no-store" });
        const json = (await res.json()) as AggregateResponse;
        if (!mounted) return;
        setData(json);
      } catch {
        if (!mounted) return;
        setData({ source: "none", scanned: 0, keywords: [], categoryCounts: {} });
      }
    };

    load();
    const timer = setInterval(load, 120000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const keywords = data?.keywords?.length ? data.keywords : [];
  const categoryEntries = Object.entries(data?.categoryCounts || {});

  return (
    <section className={styles.root} aria-label={copy.title}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>{copy.eyebrow}</p>
        <h3 className={styles.title}>{copy.title}</h3>
        <p className={styles.description}>{copy.description}</p>
      </div>

      <div className={styles.metaRow}>
        <span className={styles.metaPill}>
          {copy.scanned}: <strong>{data?.scanned ?? 0}</strong>
        </span>
        {data?.source ? <span className={styles.metaPill}>source: {data.source}</span> : null}
      </div>

      {!keywords.length ? <p className={styles.empty}>{copy.empty}</p> : null}

      {keywords.length ? (
        <div className={styles.tagRow}>
          {keywords.map((item) => (
            <span key={item.id} className={styles.tag}>
              <span className={styles.tagLabel}>{language === "ko" ? item.labelKo : item.labelEn}</span>
              <span className={styles.tagCount}>{item.count}</span>
            </span>
          ))}
        </div>
      ) : null}

      {categoryEntries.length ? (
        <div className={styles.categoryBlock}>
          <p className={styles.categoryTitle}>{copy.categories}</p>
          <div className={styles.categoryRow}>
            {categoryEntries.map(([key, value]) => (
              <span key={key} className={styles.categoryChip}>
                {key}: <strong>{value}</strong>
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
