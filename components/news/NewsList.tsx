"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./NewsList.module.css";
import NewsSection from "./NewsSection";
import { FilterType, NewsItem, SortType } from "./newsTypes";
import { buildNewsSignals, filterAndSortNews } from "./newsUtils";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const COPY = {
  ko: {
    filterOptions: [
      { value: "all", label: "전체" },
      { value: "crypto", label: "코인" },
      { value: "stock", label: "주식" }
    ],
    placeholder: "키워드 검색 (ETF, 금리, 테슬라, 비트코인...)",
    latest: "최신순",
    impact: "영향도순",
    count: "코인",
    countStock: "주식",
    signalTitle: "뉴스 시그널"
  },
  en: {
    filterOptions: [
      { value: "all", label: "All" },
      { value: "crypto", label: "Crypto" },
      { value: "stock", label: "Stocks" }
    ],
    placeholder: "Search keyword (ETF, rates, Tesla, Bitcoin...)",
    latest: "Latest",
    impact: "Impact",
    count: "Crypto",
    countStock: "Stocks",
    signalTitle: "News signals"
  }
} as const;

export default function NewsList() {
  const { language } = useLanguage();
  const copy = COPY[language];
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
        setCryptoNews(Array.isArray(cryptoJson?.results) ? cryptoJson.results : []);
        setStockNews(Array.isArray(stockJson?.data) ? stockJson.data : []);
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
    return filterAndSortNews(cryptoNews, "crypto", keyword, sortType, language);
  }, [cryptoNews, keyword, language, sortType]);

  const preparedStockNews = useMemo(() => {
    return filterAndSortNews(stockNews, "stock", keyword, sortType, language);
  }, [keyword, language, sortType, stockNews]);

  const newsSignals = useMemo(() => {
    return buildNewsSignals(preparedCryptoNews, preparedStockNews, language);
  }, [language, preparedCryptoNews, preparedStockNews]);

  const showCrypto = filterType === "all" || filterType === "crypto";
  const showStock = filterType === "all" || filterType === "stock";

  return (
    <div className={styles.root}>
      <div className={styles.controlPanel}>
        <div className={styles.filterButtons}>
          {copy.filterOptions.map((option) => (
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
            placeholder={copy.placeholder}
            className={styles.keywordInput}
          />

          <select
            value={sortType}
            onChange={(e) => setSortType(e.target.value as SortType)}
            className={styles.sortSelect}
          >
            <option value="latest">{copy.latest}</option>
            <option value="impact">{copy.impact}</option>
          </select>

          <div className={styles.countInfo}>
            {copy.count} {preparedCryptoNews.length} | {copy.countStock} {preparedStockNews.length}
          </div>
        </div>
      </div>

      <div className={styles.signalPanel}>
        <p className={styles.signalTitle}>{copy.signalTitle}</p>
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
