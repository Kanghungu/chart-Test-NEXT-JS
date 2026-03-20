"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./NewsList.module.css";
import NewsSection from "./NewsSection";
import { FilterType, NewsItem, SortType } from "./newsTypes";
import { buildNewsSignals, filterAndSortNews } from "./newsUtils";

const FILTER_OPTIONS = [
  { value: "all", label: "전체" },
  { value: "crypto", label: "코인" },
  { value: "stock", label: "주식" }
] as const;

export default function NewsList() {
  const [cryptoNews, setCryptoNews] = useState<NewsItem[]>([]);
  const [stockNews, setStockNews] = useState<NewsItem[]>([]);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortType, setSortType] = useState<SortType>("latest");
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadNews = async () => {
      try {
        const [cryptoRes, stockRes] = await Promise.all([
          fetch("/api/news/crypto", { cache: "no-store" }),
          fetch("/api/news/stock", { cache: "no-store" })
        ]);
        const [cryptoJson, stockJson] = await Promise.all([cryptoRes.json(), stockRes.json()]);

        if (!mounted) return;

        setCryptoNews(cryptoJson.results || []);
        setStockNews(stockJson.data || []);
      } catch {
        if (!mounted) return;
        setCryptoNews([]);
        setStockNews([]);
      }
    };

    loadNews();

    return () => {
      mounted = false;
    };
  }, []);

  const preparedCryptoNews = useMemo(() => {
    return filterAndSortNews(cryptoNews, "crypto", keyword, (item) => item.description || "", sortType);
  }, [cryptoNews, keyword, sortType]);

  const preparedStockNews = useMemo(() => {
    return filterAndSortNews(stockNews, "stock", keyword, (item) => item.summary_ko || "", sortType);
  }, [keyword, sortType, stockNews]);

  const newsSignals = useMemo(() => {
    return buildNewsSignals(preparedCryptoNews, preparedStockNews);
  }, [preparedCryptoNews, preparedStockNews]);

  const showCrypto = filterType === "all" || filterType === "crypto";
  const showStock = filterType === "all" || filterType === "stock";

  return (
    <div className={styles.root}>
      <div className={styles.controlPanel}>
        <div className={styles.filterButtons}>
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilterType(option.value)}
              className={filterType === option.value ? styles.filterBtnActive : styles.filterBtn}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className={styles.controlGrid}>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="키워드 검색 (ETF, 금리, 테슬라, 비트코인...)"
            className={styles.keywordInput}
          />

          <select value={sortType} onChange={(e) => setSortType(e.target.value as SortType)} className={styles.sortSelect}>
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
        {showCrypto && <NewsSection items={preparedCryptoNews} isFullColumn={!showStock} type="crypto" />}
        {showStock && <NewsSection items={preparedStockNews} isFullColumn={!showCrypto} type="stock" />}
      </div>
    </div>
  );
}
