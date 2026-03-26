"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./MarketOverview.module.css";
import MarketSignals from "./MarketSignals";
import MarketSummaryCards from "./MarketSummaryCards";
import MarketTicker from "./MarketTicker";
import { SnapshotData, TickerItem } from "./marketTypes";
import {
  buildSignalsByLanguage,
  buildTickerSeed,
  getMarketCopy,
  INITIAL_SNAPSHOT,
  mergeTickerItems
} from "./marketUtils";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export default function MarketOverview() {
  const { language } = useLanguage();
  const copy = getMarketCopy(language);
  const [snapshot, setSnapshot] = useState<SnapshotData>(INITIAL_SNAPSHOT);
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    let mounted = true;

    const loadSnapshot = async () => {
      try {
        const res = await fetch("/api/market/snapshot", { cache: "no-store" });
        const json = await res.json();

        if (!mounted) return;

        setFetchError(json.error ? copy.unstableSource : "");
        setSnapshot((prev) => ({
          assets: json.assets?.length ? json.assets : prev.assets,
          fearGreed: json.fearGreed ?? null,
          cryptoVolumeUsd: json.cryptoVolumeUsd ?? null,
          warnings: json.warnings || [],
          updatedAt: json.updatedAt || prev.updatedAt
        }));

        if ((json.assets || []).length) {
          setTickerItems(buildTickerSeed(json.assets));
        }
      } catch {
        if (mounted) {
          setFetchError(copy.networkError);
        }
      }
    };

    loadSnapshot();
    const timer = setInterval(loadSnapshot, 60000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadWatchlist = async () => {
      try {
        const res = await fetch("/api/market/watchlist", { cache: "no-store" });
        const json = await res.json();
        const items = Array.isArray(json?.items) ? json.items : [];

        if (!mounted || !items.length) return;

        setTickerItems((prev) => mergeTickerItems(prev, items));
      } catch {
        // keep latest ticker items
      }
    };

    loadWatchlist();
    const timer = setInterval(loadWatchlist, 60000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const signals = useMemo(() => buildSignalsByLanguage(snapshot, language), [language, snapshot]);

  return (
    <section className={styles.root}>
      <div className={styles.glowTop} />
      <div className={styles.glowBottom} />

      <div className={styles.content}>
        <div className={styles.header}>
          <h2 className={styles.title}>{copy.title}</h2>
          <p className={styles.description}>{copy.description}</p>
        </div>

        {fetchError ? <div className={styles.errorBox}>{fetchError}</div> : null}

        <MarketSummaryCards snapshot={snapshot} />
        <MarketSignals signals={signals} title={copy.signalTitle} />
        <MarketTicker items={tickerItems} label={copy.liveLabel} />

        <p className={styles.updatedAt}>
          {copy.updatedAt}:{" "}
          {snapshot.updatedAt
            ? new Date(snapshot.updatedAt).toLocaleTimeString(language === "ko" ? "ko-KR" : "en-US")
            : "-"}
        </p>
      </div>
    </section>
  );
}
