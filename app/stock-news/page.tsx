"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import styles from "./page.module.css";

export default function StockNewsPage() {
  const [stockNews, setStockNews] = useState<any[]>([]);
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/news/stock")
      .then((res) => res.json())
      .then((json) => setStockNews(json.data || []));
  }, []);

  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section className={styles.pageSection}>
      <h1 className={styles.pageTitle}>전체 주식 뉴스</h1>
      <ul className={styles.newsList}>
        {stockNews.map((n) => (
          <li key={n.id} className={styles.newsItem}>
            <div className={styles.rowTop}>
              <a
                href={n.content_url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.newsLink}
              >
                {n.title_ko}
              </a>
              <button onClick={() => toggleItem(n.id)} className={styles.toggleBtn}>
                {openItems[n.id] ? "접기" : "더보기"}
              </button>
            </div>

            {!openItems[n.id] && <div className={styles.summary}>{(n.summary_ko || "").slice(0, 100)}...</div>}

            <div className={styles.metaRow}>
              <span>{n.published_at ? new Date(n.published_at).toLocaleString() : "날짜 없음"}</span>
              <span>출처: {n.publisher}</span>
            </div>

            <AnimatePresence>
              {openItems[n.id] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={styles.expandWrap}
                >
                  <div className={styles.expandCard}>
                    <p>{n.summary_ko}</p>
                    <p className={styles.detailLinkWrap}>
                      원문 보기:{" "}
                      <a
                        href={n.content_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.detailLink}
                      >
                        {n.publisher}
                      </a>
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        ))}
      </ul>
      <div className={styles.homeBtnWrap}>
        <Link href="/">
          <button className={styles.homeBtn}>홈으로</button>
        </Link>
      </div>
    </section>
  );
}

