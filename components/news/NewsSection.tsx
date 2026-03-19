import styles from "./NewsList.module.css";
import { NewsItem, NewsType } from "./newsTypes";
import { getLink, getPublishedAt, getTitle } from "./newsUtils";

interface NewsSectionProps {
  items: NewsItem[];
  isFullColumn: boolean;
  type: NewsType;
}

const SECTION_LABEL = {
  crypto: "코인",
  stock: "주식"
};

export default function NewsSection({ items, isFullColumn, type }: NewsSectionProps) {
  const titleClassName = type === "crypto" ? styles.cryptoTitle : styles.stockTitle;
  const linkClassName = type === "crypto" ? styles.cryptoLink : styles.stockLink;
  const keyField = type === "crypto" ? "slug" : "content_url";

  return (
    <section className={`${styles.newsSection} ${isFullColumn ? styles.fullColumn : ""}`}>
      <h3 className={`${styles.sectionTitle} ${titleClassName}`}>
        <span>{SECTION_LABEL[type]}</span> 뉴스
      </h3>

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
              <span className={styles.metaText}>{item.publisher || "출처 미상"}</span>
              <span className={`${styles.metaText} ${styles.metaRight}`}>{getPublishedAt(item) || "-"}</span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
