"use client";

import { useEffect, useMemo, useState } from "react";
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
  latest: "\uCD5C\uC2E0\uC21C",
  oldest: "\uC624\uB798\uB41C\uC21C",
  searchPlaceholder: "\uD0A4\uC6CC\uB4DC \uAC80\uC0C9 (ETF, \uAE08\uB9AC, \uBE44\uD2B8\uCF54\uC778, NVIDIA...)",
  favoritesOnly: "\uC990\uACA8\uCC3E\uAE30 \uB9CC \uBCF4\uAE30",
  spotlight: "\uC2A4\uD3EC\uD2B8\uB77C\uC774\uD2B8",
  signalBoard: "\uD55C\uB208\uC5D0 \uBCF4\uB294 \uD750\uB984",
  recentCount: "\uD45C\uC2DC \uB274\uC2A4",
  sourceCount: "\uCD9C\uCC98 \uC218",
  latestUpdate: "\uCD5C\uC2E0 \uC2DC\uAC01",
  emptyDate: "\uB0A0\uC9DC \uC5C6\uC74C",
  unknownSource: "\uCD9C\uCC98 \uBBF8\uC0C1",
  open: "\uC6D0\uBB38",
  expand: "\uB354\uBCF4\uAE30",
  collapse: "\uC811\uAE30",
  share: "\uB9C1\uD06C \uBCF5\uC0AC",
  copied: "\uBCF5\uC0AC\uB428",
  home: "\uD648\uC73C\uB85C",
  loading: "\uB274\uC2A4\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.",
  error: "\uB274\uC2A4\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.",
  noResults: "\uC870\uAC74\uC5D0 \uB9DE\uB294 \uB274\uC2A4\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.",
  favoriteOn: "\uC990\uACA8\uCC3E\uAE30 \uC800\uC7A5",
  favoriteOff: "\uC990\uACA8\uCC3E\uAE30 \uD574\uC81C",
  summary: "\uC694\uC57D",
  sourceLabel: "\uCD9C\uCC98",
  reset: "\uC804\uCCB4"
} as const;

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString() : COPY.emptyDate;
}

function getLatestTime(items: PreparedItem[]) {
  if (!items.length) return "-";

  const latest = [...items]
    .filter((item) => item.publishedAt)
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())[0];

  return latest ? formatDate(latest.publishedAt) : "-";
}

function normalizeItem(item: FeedItem, index: number, helpers: Omit<NewsFeedPageProps, "title" | "intro" | "badge" | "variant" | "quickFilters" | "fetchUrl" | "getItems">): PreparedItem {
  return {
    id: String(item.id ?? helpers.getItemKey(item, index)),
    key: helpers.getItemKey(item, index),
    title: decodeHtmlEntities(helpers.getItemTitle(item)),
    summary: decodeHtmlEntities(helpers.getItemSummary(item)),
    publisher: item.publisher || COPY.unknownSource,
    publishedAt: item.published_at || "",
    link: helpers.getItemLink(item),
    detailLink: helpers.getDetailLink(item)
  };
}

export default function NewsFeedPage(props: NewsFeedPageProps) {
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
      if (saved) {
        setFavoriteIds(JSON.parse(saved));
      }
    } catch {
      // ignore localStorage read failures
    }
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(favoriteIds));
    } catch {
      // ignore localStorage write failures
    }
  }, [favoriteIds, storageKey]);

  useEffect(() => {
    let mounted = true;

    setLoading(true);
    setError("");

    fetch(fetchUrl)
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;

        const prepared = (getItems(json) || []).map((item: FeedItem, index: number) =>
          normalizeItem(item, index, { getItemKey, getItemLink, getItemTitle, getItemSummary, getDetailLink })
        );

        setItems(prepared);
      })
      .catch(() => {
        if (mounted) {
          setError(COPY.error);
        }
      })
      .finally(() => {
        if (mounted) {
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [fetchUrl, getItems, getItemKey, getItemLink, getItemTitle, getItemSummary, getDetailLink]);

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
    } catch {
      // ignore clipboard failure
    }
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
            <p className={styles.statLabel}>{COPY.recentCount}</p>
            <p className={styles.statValue}>{visibleItems.length}</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>{COPY.sourceCount}</p>
            <p className={styles.statValue}>{publisherCount}</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>{COPY.latestUpdate}</p>
            <p className={styles.statValueSmall}>{getLatestTime(items)}</p>
          </article>
        </div>
      </div>

      <div className={styles.controlPanel}>
        <div className={styles.searchRow}>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder={COPY.searchPlaceholder}
            className={styles.searchInput}
          />

          <select value={sortType} onChange={(e) => setSortType(e.target.value as SortType)} className={styles.sortSelect}>
            <option value="latest">{COPY.latest}</option>
            <option value="oldest">{COPY.oldest}</option>
          </select>
        </div>

        <div className={styles.filterRow}>
          <button onClick={() => setActiveFilter("")} className={!activeFilter ? styles.activeChip : styles.filterChip}>
            {COPY.reset}
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
            {COPY.favoritesOnly}
          </button>
        </div>
      </div>

      <div className={styles.infoGrid}>
        <article className={styles.infoCard}>
          <h2 className={styles.infoTitle}>{COPY.spotlight}</h2>
          <div className={styles.spotlightList}>
            {spotlightItems.map((item) => (
              <a key={item.id} href={item.link} target="_blank" rel="noopener noreferrer" className={styles.spotlightItem}>
                <p className={styles.spotlightTitle}>{item.title}</p>
                <p className={styles.spotlightMeta}>
                  {item.publisher} · {formatDate(item.publishedAt)}
                </p>
              </a>
            ))}
          </div>
        </article>

        <article className={styles.infoCard}>
          <h2 className={styles.infoTitle}>{COPY.signalBoard}</h2>
          <ul className={styles.signalList}>
            <li className={styles.signalItem}>{title}</li>
            <li className={styles.signalItem}>{`\uD544\uD130: ${activeFilter || COPY.reset}`}</li>
            <li className={styles.signalItem}>{`\uC815\uB82C: ${sortType === "latest" ? COPY.latest : COPY.oldest}`}</li>
            <li className={styles.signalItem}>{`\uC990\uACA8\uCC3E\uAE30: ${favoriteIds.length}`}</li>
          </ul>
        </article>
      </div>

      {loading ? <p className={styles.statusText}>{COPY.loading}</p> : null}
      {error ? <p className={styles.statusError}>{error}</p> : null}
      {!loading && !error && !visibleItems.length ? <p className={styles.statusText}>{COPY.noResults}</p> : null}

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
                  aria-label={favoriteIds.includes(item.id) ? COPY.favoriteOff : COPY.favoriteOn}
                >
                  {favoriteIds.includes(item.id) ? "\u2605" : "\u2606"}
                </button>

                <button onClick={() => handleCopy(item)} className={styles.utilityButton}>
                  {copiedId === item.id ? COPY.copied : COPY.share}
                </button>

                <button onClick={() => toggleItem(item.id)} className={styles.toggleBtn}>
                  {openItems[item.id] ? COPY.collapse : COPY.expand}
                </button>
              </div>
            </div>

            {!openItems[item.id] && <div className={styles.summary}>{item.summary.slice(0, 140)}...</div>}

            <div className={styles.metaRow}>
              <span>{formatDate(item.publishedAt)}</span>
              <span>{`${COPY.sourceLabel}: ${item.publisher}`}</span>
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
                    <p className={styles.expandLabel}>{COPY.summary}</p>
                    <p className={styles.expandText}>{item.summary}</p>
                    <div className={styles.linkRow}>
                      <a href={item.detailLink} target="_blank" rel="noopener noreferrer" className={styles.detailLink}>
                        {COPY.open}
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
        <Link href="/">
          <button className={styles.homeBtn}>{COPY.home}</button>
        </Link>
      </div>
    </section>
  );
}
