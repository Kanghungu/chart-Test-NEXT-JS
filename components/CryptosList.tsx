"use client";
import React, { useEffect, useState } from "react";
import styles from "./CryptosList.module.css";

interface NewsItem {
  publisher: string;
  summary_ko: string;
  title_ko: string;
  content_url: string;
  description: string;
  slug?: string;
  id: string | number;
  title: string;
  published_at: string;
}

export default function NewsList() {
  const [cryptoNews, setCryptoNews] = useState<NewsItem[]>([]);
  const [stockNews, setStockNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    fetch("/api/news/crypto")
      .then((res) => res.json())
      .then((data) => setCryptoNews(data.results || []));

    fetch("/api/news/stock")
      .then((res) => res.json())
      .then((json) => setStockNews(json.data || []));
  }, []);

  return (
    <div className={styles.grid}>
      <section className={styles.section}>
        <ul className={styles.list}>
          {cryptoNews.map((n) => (
            <li key={n.id} className={styles.item}>
              <a
                href={`https://cryptopanic.com/news/${n.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
                title={n.title}
              >
                {n.title}
              </a>
              <div className={styles.summary}>{n.description ? `${n.description.slice(0, 80)}...` : ""}</div>
              <div className={styles.date}>{n.published_at ? new Date(n.published_at).toLocaleString() : "날짜 없음"}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <ul className={styles.list}>
          {stockNews.map((n) => (
            <li key={n.id} className={styles.stockItem}>
              <a href={n.content_url} target="_blank" rel="noopener noreferrer" className={styles.link}>
                {n.title_ko}
              </a>
              <div className={styles.summary}>{n.summary_ko?.slice(0, 100)}...</div>
              <div className={styles.metaRow}>
                <span>{n.published_at ? new Date(n.published_at).toLocaleString() : "날짜 없음"}</span>
                <span>출처: {n.publisher}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

