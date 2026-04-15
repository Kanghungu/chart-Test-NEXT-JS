"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/components/discover/DiscoverPage.module.css";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { getLocalizedAssetName } from "@/lib/marketLocalization";

type WatchGroup = "korea" | "stock";

type WatchItem = {
  symbol: string;
  name: string;
  nameKo?: string;
  nameEn?: string;
  group: WatchGroup;
  price: number | null;
  changePercent: number | null;
};

const COPY = {
  ko: {
    eyebrow: "WATCHLIST HUB",
    title: "미국주식 / 한국주식 보드",
    description: "미국주식과 한국주식을 같은 화면에서 비교하고, 변동폭 기준으로 빠르게 훑어봅니다.",
    totalAssets: "총 자산",
    totalAssetsHint: "한국주식 + 미국주식",
    strongest: "가장 강한 자산",
    weakest: "가장 약한 자산",
    assetGroup: "자산 그룹",
    quickFilter: "빠른 필터",
    all: "전체",
    korea: "한국주식",
    stock: "미국주식",
    moveRanking: "변동폭 기준 정렬",
    comparePairs: "오늘 보기 좋은 비교",
    quickPairs: "빠른 비교",
    empty: "표시할 자산이 없습니다.",
    allAssets: "전체 자산",
    koreaType: "한국주식",
    stockType: "미국주식"
  },
  en: {
    eyebrow: "WATCHLIST HUB",
    title: "US / Korea stock board",
    description: "Compare US and Korean stocks on one screen and sort them by the biggest moves.",
    totalAssets: "Total assets",
    totalAssetsHint: "Korean + US stocks",
    strongest: "Strongest asset",
    weakest: "Weakest asset",
    assetGroup: "Asset group",
    quickFilter: "Quick filter",
    all: "All",
    korea: "Korean stocks",
    stock: "US stocks",
    moveRanking: "Move ranking",
    comparePairs: "Useful pairs today",
    quickPairs: "Quick pairs",
    empty: "No watchlist assets to display.",
    allAssets: "All assets",
    koreaType: "Korean stock",
    stockType: "US stock"
  }
} as const;

const PAIRS = {
  ko: [
    ["삼성전자 vs SK하이닉스", "국내 반도체 주도주 비교"],
    ["NAVER vs 현대차", "성장주와 경기민감주 톤 비교"],
    ["NVDA vs TSLA", "미국 성장주 위험선호 체크"],
    ["AAPL vs MSFT", "미국 메가캡 안정감 비교"]
  ],
  en: [
    ["Samsung vs SK hynix", "Compare Korean semiconductor leadership"],
    ["NAVER vs Hyundai", "Check growth vs cyclical tone in Korea"],
    ["NVDA vs TSLA", "Read risk appetite inside US leaders"],
    ["AAPL vs MSFT", "Compare defensive mega-cap rotation"]
  ]
} as const;

export default function WatchlistPage() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const [items, setItems] = useState<WatchItem[]>([]);
  const [group, setGroup] = useState<"all" | WatchGroup>("all");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await fetch("/api/market/watchlist", { cache: "no-store" });
        const json = await res.json();
        if (mounted) setItems(Array.isArray(json?.items) ? json.items : []);
      } catch {
        if (mounted) setItems([]);
      }
    };

    load();
    const timer = setInterval(load, 60000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const visible = useMemo(() => {
    const filtered = group === "all" ? items : items.filter((item) => item.group === group);
    return [...filtered].sort((a, b) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0));
  }, [group, items]);

  const topWinner = [...items]
    .filter((item) => typeof item.changePercent === "number")
    .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))[0];

  const topLoser = [...items]
    .filter((item) => typeof item.changePercent === "number")
    .sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))[0];

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 className={styles.title}>{copy.title}</h1>
            <p className={styles.description}>{copy.description}</p>
          </div>

          <div className={styles.heroStats}>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.totalAssets}</p>
              <p className={styles.statValue}>{items.length}</p>
              <p className={styles.statHint}>{copy.totalAssetsHint}</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.strongest}</p>
              <p className={styles.statValue}>{topWinner?.symbol || "-"}</p>
              <p className={styles.statHint}>{formatPercent(topWinner?.changePercent ?? null)}</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.weakest}</p>
              <p className={styles.statValue}>{topLoser?.symbol || "-"}</p>
              <p className={styles.statHint}>{formatPercent(topLoser?.changePercent ?? null)}</p>
            </article>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>{copy.assetGroup}</h2>
            <span className={styles.panelCaption}>{copy.quickFilter}</span>
          </div>
          <div className={styles.chipRow}>
            {[
              { id: "all", label: copy.all },
              { id: "korea", label: copy.korea },
              { id: "stock", label: copy.stock }
            ].map((item) => (
              <button
                key={item.id}
                className={group === item.id ? styles.chipActive : styles.chip}
                onClick={() => setGroup(item.id as "all" | WatchGroup)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.grid2}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{copy.moveRanking}</h2>
              <span className={styles.pill}>
                {group === "all" ? copy.allAssets : group === "korea" ? copy.korea : copy.stock}
              </span>
            </div>
            <div className={styles.stack}>
              {visible.map((item) => {
                const up = typeof item.changePercent === "number" && item.changePercent >= 0;
                return (
                  <div key={item.symbol} className={styles.listCard}>
                    <div className={styles.itemRow}>
                      <div>
                        <p className={styles.itemTitle}>{getLocalizedAssetName(item, language)}</p>
                        <p className={styles.itemSub}>{item.symbol}</p>
                        <p className={styles.itemMeta}>
                          {item.group === "korea" ? copy.koreaType : copy.stockType}
                        </p>
                      </div>
                      <div className={styles.itemValue}>
                        <p className={styles.price}>{formatCurrency(item.price, item.group === "korea" ? "KRW" : "USD")}</p>
                        <p className={up ? styles.up : styles.down}>{formatPercent(item.changePercent)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!visible.length ? <p className={styles.emptyState}>{copy.empty}</p> : null}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{copy.comparePairs}</h2>
              <span className={styles.panelCaption}>{copy.quickPairs}</span>
            </div>
            <div className={styles.stack}>
              {PAIRS[language].map(([title, desc]) => (
                <div key={title} className={styles.listCard}>
                  <p className={styles.itemTitle}>{title}</p>
                  <p className={styles.itemMeta}>{desc}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
