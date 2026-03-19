"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import styles from "./NewsFeedPage.module.css";
import { decodeHtmlEntities } from "./newsUtils";

type FeedItem = {
  id?: string | number;
  published_at?: string;
  publisher?: string;
  [key: string]: any;
};

interface NewsFeedPageProps {
  title: string;
  fetchUrl: string;
  getItems: (json: any) => FeedItem[];
  getItemKey: (item: FeedItem, index: number) => string | number;
  getItemLink: (item: FeedItem) => string;
  getItemTitle: (item: FeedItem) => string;
  getItemSummary: (item: FeedItem) => string;
  getDetailLink: (item: FeedItem) => string;
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : "날짜 없음";
}

export default function NewsFeedPage({
  title,
  fetchUrl,
  getItems,
  getItemKey,
  getItemLink,
  getItemTitle,
  getItemSummary,
  getDetailLink
}: NewsFeedPageProps) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch(fetchUrl)
      .then((res) => res.json())
      .then((json) => setItems(getItems(json)));
  }, [fetchUrl, getItems]);

  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <section className={styles.pageSection}>
      <h1 className={styles.pageTitle}>{title}</h1>

      <ul className={styles.newsList}>
        {items.map((item, index) => {
          const titleText = decodeHtmlEntities(getItemTitle(item));
          const summaryText = decodeHtmlEntities(getItemSummary(item));
          const itemId = String(item.id ?? getItemKey(item, index));

          return (
            <li key={getItemKey(item, index)} className={styles.newsItem}>
              <div className={styles.rowTop}>
                <a
                  href={getItemLink(item)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.newsLink}
                  title={titleText}
                >
                  {titleText}
                </a>

                <button onClick={() => toggleItem(itemId)} className={styles.toggleBtn}>
                  {openItems[itemId] ? "접기" : "더보기"}
                </button>
              </div>

              {!openItems[itemId] && <div className={styles.summary}>{summaryText.slice(0, 100)}...</div>}

              <div className={styles.metaRow}>
                <span>{formatDate(item.published_at)}</span>
                <span>출처: {item.publisher || "출처 미상"}</span>
              </div>

              <AnimatePresence>
                {openItems[itemId] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className={styles.expandWrap}
                  >
                    <div className={styles.expandCard}>
                      <p>{summaryText}</p>
                      <p className={styles.detailLinkWrap}>
                        원문 보기:{" "}
                        <a
                          href={getDetailLink(item)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.detailLink}
                        >
                          {item.publisher || "바로가기"}
                        </a>
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>

      <div className={styles.homeBtnWrap}>
        <Link href="/">
          <button className={styles.homeBtn}>홈으로</button>
        </Link>
      </div>
    </section>
  );
}
