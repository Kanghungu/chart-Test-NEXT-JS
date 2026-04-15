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
      { value: "korea", label: "한국주식" },
      { value: "stock", label: "미국주식" }
    ],
    placeholder: "키워드 검색 (코스피, 삼성전자, Fed, NVIDIA...)",
    latest: "최신",
    impact: "영향도",
    count: "한국",
    countStock: "미국",
    signalTitle: "뉴스 시그널"
  },
  en: {
    filterOptions: [
      { value: "all", label: "All" },
      { value: "korea", label: "Korean Stocks" },
      { value: "stock", label: "US Stocks" }
    ],
    placeholder: "Search keyword (KOSPI, Samsung, Fed, NVIDIA...)",
    latest: "Latest",
    impact: "Impact",
    count: "Korean",
    countStock: "US",
    signalTitle: "News signals"
  }
} as const;

export default function NewsList() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const [koreaNews, setKoreaNews] = useState<NewsItem[]>([]);
  const [stockNews, setStockNews] = useState<NewsItem[]>([]);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortType, setSortType] = useState<SortType>("latest");
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadNews = async () => {
      try {
        const [koreaRes, stockRes] = await Promise.all([
          fetch("/api/news/korea", { cache: "no-store" }),
          fetch("/api/news/stock", { cache: "no-store" })
        ]);
        const [koreaJson, stockJson] = await Promise.all([koreaRes.json(), stockRes.json()]);

        if (!mounted) return;
        setKoreaNews(Array.isArray(koreaJson?.results) ? koreaJson.results : []);
        setStockNews(Array.isArray(stockJson?.data) ? stockJson.data : []);
      } catch {
        if (!mounted) return;
        setKoreaNews([]);
        setStockNews([]);
      }
    };

    loadNews();

    return () => {
      mounted = false;
    };
  }, []);

  const preparedKoreaNews = useMemo(() => {
    return filterAndSortNews(koreaNews, "korea", keyword, sortType, language);
  }, [koreaNews, keyword, language, sortType]);

  const preparedStockNews = useMemo(() => {
    return filterAndSortNews(stockNews, "stock", keyword, sortType, language);
  }, [keyword, language, sortType, stockNews]);

  const newsSignals = useMemo(() => {
    return buildNewsSignals(preparedKoreaNews, preparedStockNews, language);
  }, [language, preparedKoreaNews, preparedStockNews]);

  const showKorea = filterType === "all" || filterType === "korea";
  const showStock = filterType === "all" || filterType === "stock";

  return (
    <div className={styles.root}>
      <div className={styles.controlPanel}>
        <div className={styles.filterButtons}>
          {copy.filterOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setFilterType(option.value as FilterType)}
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
            {copy.count} {preparedKoreaNews.length} | {copy.countStock} {preparedStockNews.length}
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
        {showKorea && <NewsSection items={preparedKoreaNews} isFullColumn={!showStock} type="korea" />}
        {showStock && <NewsSection items={preparedStockNews} isFullColumn={!showKorea} type="stock" />}
      </div>
    </div>
  );
}
