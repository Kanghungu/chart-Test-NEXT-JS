"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/components/discover/DiscoverPage.module.css";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { getLocalizedAssetName } from "@/lib/marketLocalization";

type WatchItem = {
  symbol: string;
  name: string;
  nameKo?: string;
  nameEn?: string;
  group: "crypto" | "stock";
  price: number | null;
  changePercent: number | null;
};

const COPY = {
  ko: {
    eyebrow: "워치리스트 허브",
    title: "관심 자산 보드",
    description: "코인과 미국 주식을 한 화면에서 비교하고, 변동폭 기준으로 빠르게 살펴볼 수 있습니다.",
    totalAssets: "총 자산 수",
    totalAssetsHint: "코인 + 주식 통합",
    strongest: "가장 강한 자산",
    weakest: "가장 약한 자산",
    assetGroup: "자산 그룹",
    quickFilter: "빠른 필터",
    all: "전체",
    crypto: "코인",
    stock: "미국주식",
    moveRanking: "변동폭 순 정렬",
    comparePairs: "오늘 보기 좋은 비교",
    quickPairs: "빠른 비교",
    empty: "표시할 관심 자산이 없습니다.",
    allAssets: "전체 자산",
    cryptoType: "코인",
    stockType: "미국 주식"
  },
  en: {
    eyebrow: "WATCHLIST HUB",
    title: "Watchlist board",
    description: "Compare crypto and US stocks on one screen and sort them by the biggest moves.",
    totalAssets: "Total assets",
    totalAssetsHint: "Crypto + stocks",
    strongest: "Strongest asset",
    weakest: "Weakest asset",
    assetGroup: "Asset group",
    quickFilter: "Quick filter",
    all: "All",
    crypto: "Crypto",
    stock: "US stocks",
    moveRanking: "Move ranking",
    comparePairs: "Useful pairs today",
    quickPairs: "Quick pairs",
    empty: "No watchlist assets to display.",
    allAssets: "All assets",
    cryptoType: "Crypto",
    stockType: "US stock"
  }
} as const;

const PAIRS = {
  ko: [
    ["BTC vs ETH", "메이저 코인 주도 흐름 비교"],
    ["SOL vs DOGE", "공격적 알트 강도 체크"],
    ["NVDA vs TSLA", "기술주 위험 선호 온도 확인"],
    ["AAPL vs MSFT", "대형주 안정감과 순환 흐름 점검"]
  ],
  en: [
    ["BTC vs ETH", "Compare leadership among major crypto assets"],
    ["SOL vs DOGE", "Check high-beta altcoin strength"],
    ["NVDA vs TSLA", "Read risk appetite inside tech leaders"],
    ["AAPL vs MSFT", "Compare defensive mega-cap rotation"]
  ]
} as const;

export default function WatchlistPage() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const [items, setItems] = useState<WatchItem[]>([]);
  const [group, setGroup] = useState<"all" | "crypto" | "stock">("all");

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
              { id: "crypto", label: copy.crypto },
              { id: "stock", label: copy.stock }
            ].map((item) => (
              <button
                key={item.id}
                className={group === item.id ? styles.chipActive : styles.chip}
                onClick={() => setGroup(item.id as "all" | "crypto" | "stock")}
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
                {group === "all" ? copy.allAssets : group === "crypto" ? copy.crypto : copy.stock}
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
                          {item.group === "crypto" ? copy.cryptoType : copy.stockType}
                        </p>
                      </div>
                      <div className={styles.itemValue}>
                        <p className={styles.price}>{formatCurrency(item.price)}</p>
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
