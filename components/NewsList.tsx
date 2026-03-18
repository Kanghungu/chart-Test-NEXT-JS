"use client";
import React, { useEffect, useMemo, useState } from "react";
import styles from "./NewsList.module.css";

type NewsType = "crypto" | "stock";
type FilterType = "all" | NewsType;
type SortType = "latest" | "impact";

interface NewsItem {
  id?: string | number;
  slug?: string;
  title?: string;
  title_ko?: string;
  description?: string;
  summary_ko?: string;
  publisher?: string;
  published_at?: string;
  created_at?: string;
  content_url?: string;
  [key: string]: any;
}

const IMPACT_KEYWORDS = [
  "etf",
  "sec",
  "fed",
  "fomc",
  "lawsuit",
  "regulation",
  "bankruptcy",
  "hack",
  "liquidation",
  "upgrade",
  "earnings",
  "guidance",
  "downgrade",
  "upgrade"
];

function decodeHtmlEntities(str: string) {
  if (!str) return "";
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
}

function getTitle(item: NewsItem) {
  return decodeHtmlEntities(item.title_ko || item.title || "Untitled");
}

function getPublishedAt(item: NewsItem) {
  return item.published_at || item.created_at || "";
}

function getLink(item: NewsItem, type: NewsType) {
  if (type === "crypto" && item.slug) {
    return `https://cryptopanic.com/news/${item.slug}`;
  }
  return item.content_url || "#";
}

function getImpactScore(item: NewsItem, type: NewsType) {
  const title = `${item.title_ko || ""} ${item.title || ""} ${item.summary_ko || ""} ${item.description || ""}`.toLowerCase();

  let score = 0;
  for (const keyword of IMPACT_KEYWORDS) {
    if (title.includes(keyword)) {
      score += 2;
    }
  }

  if (type === "crypto" && item?.votes) {
    const positive = Number(item.votes.positive || 0);
    const negative = Number(item.votes.negative || 0);
    if (Math.abs(positive - negative) >= 5) {
      score += 2;
    }
  }

  const published = getPublishedAt(item);
  if (published) {
    const ageHours = (Date.now() - new Date(published).getTime()) / 1000 / 60 / 60;
    if (ageHours <= 6) score += 2;
    else if (ageHours <= 24) score += 1;
  }

  return score;
}

function sortItems(items: NewsItem[], type: NewsType, sort: SortType) {
  const copied = [...items];

  if (sort === "impact") {
    copied.sort((a, b) => {
      const scoreDiff = getImpactScore(b, type) - getImpactScore(a, type);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(getPublishedAt(b)).getTime() - new Date(getPublishedAt(a)).getTime();
    });
    return copied;
  }

  copied.sort((a, b) => new Date(getPublishedAt(b)).getTime() - new Date(getPublishedAt(a)).getTime());
  return copied;
}

export default function NewsList() {
  const [cryptoNews, setCryptoNews] = useState<NewsItem[]>([]);
  const [stockNews, setStockNews] = useState<NewsItem[]>([]);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortType, setSortType] = useState<SortType>("latest");
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    fetch("/api/news/crypto")
      .then((res) => res.json())
      .then((data) => setCryptoNews(data.results || []));

    fetch("/api/news/stock")
      .then((res) => res.json())
      .then((json) => setStockNews(json.data || []));
  }, []);

  const preparedCryptoNews = useMemo(() => {
    const filtered = cryptoNews.filter((item) => {
      const title = getTitle(item).toLowerCase();
      const body = decodeHtmlEntities(item.description || "").toLowerCase();
      const query = keyword.trim().toLowerCase();
      if (!query) return true;
      return title.includes(query) || body.includes(query);
    });
    return sortItems(filtered, "crypto", sortType);
  }, [cryptoNews, keyword, sortType]);

  const preparedStockNews = useMemo(() => {
    const filtered = stockNews.filter((item) => {
      const title = getTitle(item).toLowerCase();
      const body = decodeHtmlEntities(item.summary_ko || "").toLowerCase();
      const query = keyword.trim().toLowerCase();
      if (!query) return true;
      return title.includes(query) || body.includes(query);
    });
    return sortItems(filtered, "stock", sortType);
  }, [stockNews, keyword, sortType]);

  const newsSignals = useMemo(() => {
    const list: { title: string; score: number; type: NewsType }[] = [];

    preparedCryptoNews.slice(0, 20).forEach((item) => {
      const score = getImpactScore(item, "crypto");
      if (score >= 5) {
        list.push({ title: getTitle(item), score, type: "crypto" });
      }
    });

    preparedStockNews.slice(0, 20).forEach((item) => {
      const score = getImpactScore(item, "stock");
      if (score >= 5) {
        list.push({ title: getTitle(item), score, type: "stock" });
      }
    });

    list.sort((a, b) => b.score - a.score);

    if (!list.length) {
      return ["현재 강한 뉴스 시그널은 없습니다. 실시간 헤드라인을 추적 중입니다."];
    }

    return list.slice(0, 3).map((item) => `${item.type === "crypto" ? "코인" : "주식"} 시그널: ${item.title}`);
  }, [preparedCryptoNews, preparedStockNews]);

  const showCrypto = filterType === "all" || filterType === "crypto";
  const showStock = filterType === "all" || filterType === "stock";

  return (
    <div className={styles.root}>
      <div className={styles.controlPanel}>
        <div className={styles.filterButtons}>
          {(["all", "crypto", "stock"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={filterType === type ? styles.filterBtnActive : styles.filterBtn}
            >
              {type === "all" ? "전체" : type === "crypto" ? "코인" : "주식"}
            </button>
          ))}
        </div>

        <div className={styles.controlGrid}>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="키워드 검색 (ETF, 금리, 테슬라...)"
            className={styles.keywordInput}
          />

          <select
            value={sortType}
            onChange={(e) => setSortType(e.target.value as SortType)}
            className={styles.sortSelect}
          >
            <option value="latest">최신순</option>
            <option value="impact">영향도순</option>
          </select>

          <div className={styles.countInfo}>코인 {preparedCryptoNews.length} | 주식 {preparedStockNews.length}</div>
        </div>
      </div>

      <div className={styles.signalPanel}>
        <p className={styles.signalTitle}>뉴스 시그널</p>
        <ul className={styles.signalList}>
          {newsSignals.map((signal, idx) => (
            <li key={`${signal}-${idx}`} className={styles.signalItem}>
              {signal}
            </li>
          ))}
        </ul>
      </div>

      <div className={styles.newsContainer}>
        {showCrypto && (
          <section className={`${styles.newsSection} ${showCrypto && !showStock ? styles.fullColumn : ""}`}>
            <h3 className={`${styles.sectionTitle} ${styles.cryptoTitle}`}>
              <span>코인</span> 뉴스
            </h3>
            <ul className={styles.newsList}>
              {preparedCryptoNews.map((n, idx) => (
                <li key={n.id || `${n.slug}-${idx}`} className={styles.newsItem}>
                  <a
                    href={getLink(n, "crypto")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.newsLink} ${styles.cryptoLink}`}
                    title={getTitle(n)}
                  >
                    {getTitle(n)}
                  </a>
                  <div className={styles.metaRow}>
                    <span className={styles.metaText}>{n.publisher || "출처 미상"}</span>
                    <span className={`${styles.metaText} ${styles.metaRight}`}>{getPublishedAt(n) || "-"}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {showStock && (
          <section className={`${styles.newsSection} ${showStock && !showCrypto ? styles.fullColumn : ""}`}>
            <h3 className={`${styles.sectionTitle} ${styles.stockTitle}`}>
              <span>주식</span> 뉴스
            </h3>
            <ul className={styles.newsList}>
              {preparedStockNews.map((n, idx) => (
                <li key={n.id || `${n.content_url}-${idx}`} className={styles.newsItem}>
                  <a
                    href={getLink(n, "stock")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${styles.newsLink} ${styles.stockLink}`}
                    title={getTitle(n)}
                  >
                    {getTitle(n)}
                  </a>
                  <div className={styles.metaRow}>
                    <span className={styles.metaText}>{n.publisher || "출처 미상"}</span>
                    <span className={`${styles.metaText} ${styles.metaRight}`}>{getPublishedAt(n) || "-"}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

