"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import styles from "./NewsFeedPage.module.css";
import { decodeHtmlEntities } from "./newsUtils";
import { formatDateTime } from "@/lib/formatters";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type FeedItem = {
  id?: string | number;
  published_at?: string;
  publisher?: string;
  [key: string]: any;
};

type SortType = "latest" | "oldest";

interface NewsFeedPageProps {
  title: string;
  intro: string;
  badge: string;
  variant: "crypto" | "stock";
  quickFilters: string[];
  fetchUrl: string;
  getItems: (json: any) => FeedItem[];
  getItemKey: (item: FeedItem, index: number) => string | number;
  getItemLink: (item: FeedItem) => string;
  getItemTitle: (item: FeedItem) => string;
  getItemSummary: (item: FeedItem) => string;
  getDetailLink: (item: FeedItem) => string;
}

interface PreparedItem {
  id: string;
  key: string | number;
  title: string;
  summary: string;
  publisher: string;
  publishedAt: string;
  link: string;
  detailLink: string;
}

const COPY = {
  ko: {
    latest: "최신순",
    oldest: "오래된순",
    searchPlaceholder: "키워드 검색 (ETF, 금리, 비트코인, NVIDIA...)",
    favoritesOnly: "즐겨찾기만 보기",
    spotlight: "스포트라이트",
    signalBoard: "지금 보는 흐름",
    recentCount: "표시 중인 뉴스",
    sourceCount: "출처 수",
    latestUpdate: "최신 업데이트",
    emptyDate: "날짜 정보 없음",
    unknownSource: "출처 미상",
    open: "원문 보기",
    expand: "자세히",
    collapse: "접기",
    share: "링크 복사",
    copied: "복사 완료",
    home: "홈으로",
    loading: "뉴스를 불러오는 중입니다.",
    error: "뉴스를 불러오지 못했습니다.",
    noResults: "조건에 맞는 뉴스가 없습니다.",
    favoriteOn: "즐겨찾기 추가",
    favoriteOff: "즐겨찾기에서 제거",
    summary: "요약",
    sourceLabel: "출처",
    reset: "전체",
    filterLabel: "필터",
    sortLabel: "정렬",
    favoriteCount: "즐겨찾기",
    noSummary: "요약 정보가 없습니다."
  },
  en: {
    latest: "Latest",
    oldest: "Oldest",
    searchPlaceholder: "Search keyword (ETF, rates, Bitcoin, NVIDIA...)",
    favoritesOnly: "Favorites only",
    spotlight: "Spotlight",
    signalBoard: "Current view",
    recentCount: "Visible news",
    sourceCount: "Sources",
    latestUpdate: "Latest update",
    emptyDate: "No date",
    unknownSource: "Unknown source",
    open: "Open article",
    expand: "Expand",
    collapse: "Collapse",
    share: "Copy link",
    copied: "Copied",
    home: "Back home",
    loading: "Loading news...",
    error: "Failed to load news.",
    noResults: "No news matched the current filters.",
    favoriteOn: "Add to favorites",
    favoriteOff: "Remove from favorites",
    summary: "Summary",
    sourceLabel: "Source",
    reset: "All",
    filterLabel: "Filter",
    sortLabel: "Sort",
    favoriteCount: "Favorites",
    noSummary: "No summary available."
  }
} as const;

function getLatestTime(items: PreparedItem[], emptyDate: string, language: "ko" | "en") {
  if (!items.length) return "-";

  const latest = [...items]
    .filter((item) => item.publishedAt)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0];

  return latest
    ? formatDateTime(latest.publishedAt, language === "ko" ? "ko-KR" : "en-US")
    : emptyDate;
}

function normalizeItem(
  item: FeedItem,
  index: number,
  helpers: Omit<
    NewsFeedPageProps,
    "title" | "intro" | "badge" | "variant" | "quickFilters" | "fetchUrl" | "getItems"
  >,
  unknownSource: string
): PreparedItem {
  return {
    id: String(item.id ?? helpers.getItemKey(item, index)),
    key: helpers.getItemKey(item, index),
    title: decodeHtmlEntities(helpers.getItemTitle(item)),
    summary: decodeHtmlEntities(helpers.getItemSummary(item)),
    publisher: item.publisher || unknownSource,
    publishedAt: item.published_at || "",
    link: helpers.getItemLink(item),
    detailLink: helpers.getDetailLink(item)
  };
}

export default function NewsFeedPage(props: NewsFeedPageProps) {
  const { language } = useLanguage();
  const copy = COPY[language];
  const {
    title,
    intro,
    badge,
    variant,
    quickFilters,
    fetchUrl,
    getItems,
    getItemKey,
    getItemLink,
    getItemTitle,
    getItemSummary,
    getDetailLink
  } = props;

  const storageKey = `favorites:${fetchUrl}`;
  const [items, setItems] = useState<PreparedItem[]>([]);
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [keyword, setKeyword] = useState("");
  const [sortType, setSortType] = useState<SortType>("latest");
  const [activeFilter, setActiveFilter] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [copiedId, setCopiedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) setFavoriteIds(JSON.parse(saved));
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(favoriteIds));
    } catch {}
  }, [favoriteIds, storageKey]);

  useEffect(() => {
    let mounted = true;

    const loadItems = async () => {
      setLoading(true);
      setError("");

      try {
        const res = await fetch(fetchUrl, { cache: "no-store" });
        const json = await res.json();

        if (!mounted) return;

        const prepared = (getItems(json) || []).map((item: FeedItem, index: number) =>
          normalizeItem(
            item,
            index,
            { getItemKey, getItemLink, getItemTitle, getItemSummary, getDetailLink },
            copy.unknownSource
          )
        );

        setItems(prepared);
      } catch {
        if (mounted) setError(copy.error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadItems();

    return () => {
      mounted = false;
    };
  }, [
    copy.error,
    copy.unknownSource,
    fetchUrl,
    getDetailLink,
    getItemKey,
    getItemLink,
    getItemSummary,
    getItemTitle,
    getItems
  ]);

  useEffect(() => {
    if (!copiedId) return;
    const timer = setTimeout(() => setCopiedId(""), 1200);
    return () => clearTimeout(timer);
  }, [copiedId]);

  const visibleItems = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    const normalizedFilter = activeFilter.trim().toLowerCase();

    const filtered = items.filter((item) => {
      const matchesKeyword =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.summary.toLowerCase().includes(query) ||
        item.publisher.toLowerCase().includes(query);

      const matchesFilter =
        !normalizedFilter ||
        item.title.toLowerCase().includes(normalizedFilter) ||
        item.summary.toLowerCase().includes(normalizedFilter) ||
        item.publisher.toLowerCase().includes(normalizedFilter);

      const matchesFavorite = !favoritesOnly || favoriteIds.includes(item.id);
      return matchesKeyword && matchesFilter && matchesFavorite;
    });

    filtered.sort((a, b) => {
      const aTime = new Date(a.publishedAt).getTime();
      const bTime = new Date(b.publishedAt).getTime();
      return sortType === "latest" ? bTime - aTime : aTime - bTime;
    });

    return filtered;
  }, [activeFilter, favoriteIds, favoritesOnly, items, keyword, sortType]);

  const spotlightItems = useMemo(() => visibleItems.slice(0, 3), [visibleItems]);
  const publisherCount = useMemo(() => new Set(items.map((item) => item.publisher)).size, [items]);

  const toggleItem = (id: string) => {
    setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleFavorite = (id: string) => {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleCopy = async (item: PreparedItem) => {
    try {
      await navigator.clipboard.writeText(item.link);
      setCopiedId(item.id);
    } catch {}
  };

  return (
    <section className={`${styles.pageSection} ${variant === "crypto" ? styles.cryptoTheme : styles.stockTheme}`}>
      <div className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.heroBadge}>{badge}</span>
          <h1 className={styles.pageTitle}>{title}</h1>
          <p className={styles.pageIntro}>{intro}</p>
        </div>

        <div className={styles.statGrid}>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>{copy.recentCount}</p>
            <p className={styles.statValue}>{visibleItems.length}</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>{copy.sourceCount}</p>
            <p className={styles.statValue}>{publisherCount}</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>{copy.latestUpdate}</p>
            <p className={styles.statValueSmall}>{getLatestTime(items, copy.emptyDate, language)}</p>
          </article>
        </div>
      </div>

      <div className={styles.controlPanel}>
        <div className={styles.searchRow}>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={copy.searchPlaceholder}
            className={styles.searchInput}
          />

          <select value={sortType} onChange={(e) => setSortType(e.target.value as SortType)} className={styles.sortSelect}>
            <option value="latest">{copy.latest}</option>
            <option value="oldest">{copy.oldest}</option>
          </select>
        </div>

        <div className={styles.filterRow}>
          <button onClick={() => setActiveFilter("")} className={!activeFilter ? styles.activeChip : styles.filterChip}>
            {copy.reset}
          </button>

          {quickFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={activeFilter === filter ? styles.activeChip : styles.filterChip}
            >
              {filter}
            </button>
          ))}

          <button
            onClick={() => setFavoritesOnly((prev) => !prev)}
            className={favoritesOnly ? styles.activeChip : styles.filterChip}
          >
            {copy.favoritesOnly}
          </button>
        </div>
      </div>

      <div className={styles.infoGrid}>
        <article className={styles.infoCard}>
          <h2 className={styles.infoTitle}>{copy.spotlight}</h2>
          <div className={styles.spotlightList}>
            {spotlightItems.map((item) => (
              <a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer" className={styles.spotlightItem}>
                <p className={styles.spotlightTitle}>{item.title}</p>
                <p className={styles.spotlightMeta}>
                  {item.publisher} · {formatDateTime(item.publishedAt, language === "ko" ? "ko-KR" : "en-US")}
                </p>
              </a>
            ))}
          </div>
        </article>

        <article className={styles.infoCard}>
          <h2 className={styles.infoTitle}>{copy.signalBoard}</h2>
          <ul className={styles.signalList}>
            <li className={styles.signalItem}>{title}</li>
            <li className={styles.signalItem}>{`${copy.filterLabel}: ${activeFilter || copy.reset}`}</li>
            <li className={styles.signalItem}>{`${copy.sortLabel}: ${sortType === "latest" ? copy.latest : copy.oldest}`}</li>
            <li className={styles.signalItem}>{`${copy.favoriteCount}: ${favoriteIds.length}`}</li>
          </ul>
        </article>
      </div>

      {loading ? <p className={styles.statusText}>{copy.loading}</p> : null}
      {error ? <p className={styles.statusError}>{error}</p> : null}
      {!loading && !error && !visibleItems.length ? <p className={styles.statusText}>{copy.noResults}</p> : null}

      <ul className={styles.newsList}>
        {visibleItems.map((item) => (
          <li key={item.key} className={styles.newsItem}>
            <div className={styles.rowTop}>
              <a href={item.link} target="_blank" rel="noopener noreferrer" className={styles.newsLink} title={item.title}>
                {item.title}
              </a>

              <div className={styles.actionRow}>
                <button
                  onClick={() => toggleFavorite(item.id)}
                  className={favoriteIds.includes(item.id) ? styles.favoriteButtonActive : styles.favoriteButton}
                  aria-label={favoriteIds.includes(item.id) ? copy.favoriteOff : copy.favoriteOn}
                >
                  {favoriteIds.includes(item.id) ? "★" : "☆"}
                </button>

                <button onClick={() => handleCopy(item)} className={styles.utilityButton}>
                  {copiedId === item.id ? copy.copied : copy.share}
                </button>

                <button onClick={() => toggleItem(item.id)} className={styles.toggleBtn}>
                  {openItems[item.id] ? copy.collapse : copy.expand}
                </button>
              </div>
            </div>

            {!openItems[item.id] && (
              <div className={styles.summary}>{item.summary.slice(0, 140) || copy.noSummary}</div>
            )}

            <div className={styles.metaRow}>
              <span>{formatDateTime(item.publishedAt, language === "ko" ? "ko-KR" : "en-US")}</span>
              <span>{`${copy.sourceLabel}: ${item.publisher}`}</span>
            </div>

            <AnimatePresence>
              {openItems[item.id] && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28 }}
                  className={styles.expandWrap}
                >
                  <div className={styles.expandCard}>
                    <p className={styles.expandLabel}>{copy.summary}</p>
                    <p className={styles.expandText}>{item.summary || copy.noSummary}</p>
                    <div className={styles.linkRow}>
                      <a href={item.detailLink} target="_blank" rel="noopener noreferrer" className={styles.detailLink}>
                        {copy.open}
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        ))}
      </ul>

      <div className={styles.homeBtnWrap}>
        <Link href="/" className={styles.homeBtn}>
          {copy.home}
        </Link>
      </div>
    </section>
  );
}
