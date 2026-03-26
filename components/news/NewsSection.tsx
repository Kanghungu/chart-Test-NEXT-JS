"use client";

import styles from "./NewsList.module.css";
import { NewsItem, NewsType } from "./newsTypes";
import { getLink, getPublishedLabel, getPublisher, getTitle } from "./newsUtils";
import { useLanguage } from "@/components/i18n/LanguageProvider";

interface NewsSectionProps {
  items: NewsItem[];
  isFullColumn: boolean;
  type: NewsType;
}

export default function NewsSection({ items, isFullColumn, type }: NewsSectionProps) {
  const { language } = useLanguage();
  const titleClassName = type === "crypto" ? styles.cryptoTitle : styles.stockTitle;
  const linkClassName = type === "crypto" ? styles.cryptoLink : styles.stockLink;
  const keyField = type === "crypto" ? "slug" : "content_url";
  const sectionLabel = type === "crypto"
    ? language === "ko"
      ? "코인 뉴스"
      : "Crypto News"
    : language === "ko"
      ? "주식 뉴스"
      : "Stock News";

  return (
    <section className={`${styles.newsSection} ${isFullColumn ? styles.fullColumn : ""}`}>
      <h3 className={`${styles.sectionTitle} ${titleClassName}`}>{sectionLabel}</h3>

      <ul className={styles.newsList}>
        {items.map((item, idx) => (
          <li key={item.id || `${item[keyField]}-${idx}`} className={styles.newsItem}>
            <a
              href={getLink(item, type)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.newsLink} ${linkClassName}`}
              title={getTitle(item)}
            >
              {getTitle(item)}
            </a>

            <div className={styles.metaRow}>
              <span className={styles.metaText}>{getPublisher(item, language)}</span>
              <span className={`${styles.metaText} ${styles.metaRight}`}>
                {getPublishedLabel(item, language)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
