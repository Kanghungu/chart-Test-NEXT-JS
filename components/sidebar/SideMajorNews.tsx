"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./SideMajorNews.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { MajorNewsItem } from "@/components/news/newsTypes";
import { getLink, getPublishedLabel, getPublisher, getTitle } from "@/components/news/newsUtils";

const COPY = {
  ko: {
    title: "주요 뉴스",
    subtitle: "카더라·루머성 표현은 자동으로 숨깁니다.",
    empty: "표시할 뉴스가 없습니다. 잠시 후 다시 시도해 주세요.",
    moreKorea: "한국 뉴스 더보기",
    moreUs: "미국 뉴스 더보기"
  },
  en: {
    title: "Headline picks",
    subtitle: "Rumor-style headlines are filtered out automatically.",
    empty: "No headlines available. Please try again shortly.",
    moreKorea: "Korean news",
    moreUs: "US news"
  }
} as const;

export default function SideMajorNews() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const [items, setItems] = useState<MajorNewsItem[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await fetch("/api/news/major", { cache: "no-store" });
        const json = await res.json();
        if (!mounted) return;
        setItems(Array.isArray(json?.items) ? json.items : []);
      } catch {
        if (!mounted) return;
        setItems([]);
      }
    };

    load();
    const timer = setInterval(load, 5 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <section className={styles.panel} aria-label={copy.title}>
      <div className={styles.header}>
        <h3 className={styles.title}>{copy.title}</h3>
        <p className={styles.subtitle}>{copy.subtitle}</p>
      </div>

      {!items.length ? <p className={styles.empty}>{copy.empty}</p> : null}

      <ul className={styles.list}>
        {items.map((item, idx) => {
          const href = getLink(item);
          const safeHref = href && href !== "#" ? href : undefined;

          return (
            <li key={`${item.region}-${item.id ?? idx}-${getTitle(item, language).slice(0, 24)}`} className={styles.row}>
              <span className={item.region === "korea" ? styles.badgeKr : styles.badgeUs}>
                {item.region === "korea" ? "KR" : "US"}
              </span>
              <div className={styles.body}>
                {safeHref ? (
                  <a
                    href={safeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.link}
                    title={getTitle(item, language)}
                  >
                    {getTitle(item, language)}
                  </a>
                ) : (
                  <span className={styles.plainTitle}>{getTitle(item, language)}</span>
                )}
                <div className={styles.meta}>
                  <span>{getPublisher(item, language)}</span>
                  <span className={styles.metaTime}>{getPublishedLabel(item, language)}</span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <div className={styles.footer}>
        <Link href="/korea-news" className={styles.footerLink}>
          {copy.moreKorea}
        </Link>
        <Link href="/stock-news" className={styles.footerLink}>
          {copy.moreUs}
        </Link>
      </div>
    </section>
  );
}
