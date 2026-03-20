"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/components/discover/DiscoverPage.module.css";

type WatchItem = {
  symbol: string;
  name: string;
  group: "crypto" | "stock";
  price: number | null;
  changePercent: number | null;
};

function formatPrice(value: number | null) {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2
  }).format(value);
}

function formatPercent(value: number | null) {
  if (typeof value !== "number") return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export default function WatchlistPage() {
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
            <p className={styles.eyebrow}>WATCHLIST HUB</p>
            <h1 className={styles.title}>관심 자산 보드</h1>
            <p className={styles.description}>
              코인과 미국 주식을 한 보드에서 비교하고, 변동폭이 큰 자산부터 우선 순위로 확인할 수 있도록 구성했습니다.
            </p>
          </div>

          <div className={styles.heroStats}>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>총 자산 수</p>
              <p className={styles.statValue}>{items.length}</p>
              <p className={styles.statHint}>코인 + 주식 통합</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>가장 강한 자산</p>
              <p className={styles.statValue}>{topWinner?.symbol || "-"}</p>
              <p className={styles.statHint}>{formatPercent(topWinner?.changePercent ?? null)}</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>가장 약한 자산</p>
              <p className={styles.statValue}>{topLoser?.symbol || "-"}</p>
              <p className={styles.statHint}>{formatPercent(topLoser?.changePercent ?? null)}</p>
            </article>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>자산 그룹</h2>
            <span className={styles.panelCaption}>빠른 필터</span>
          </div>
          <div className={styles.chipRow}>
            {[
              { id: "all", label: "전체" },
              { id: "crypto", label: "코인" },
              { id: "stock", label: "미국주식" }
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
              <h2 className={styles.panelTitle}>변동폭 순 정렬</h2>
              <span className={styles.pill}>{group === "all" ? "All assets" : group}</span>
            </div>
            <div className={styles.stack}>
              {visible.map((item) => {
                const up = typeof item.changePercent === "number" && item.changePercent >= 0;
                return (
                  <div key={item.symbol} className={styles.listCard}>
                    <div className={styles.itemRow}>
                      <div>
                        <p className={styles.itemTitle}>{item.name}</p>
                        <p className={styles.itemSub}>{item.symbol}</p>
                        <p className={styles.itemMeta}>{item.group === "crypto" ? "Crypto" : "US Stock"}</p>
                      </div>
                      <div className={styles.itemValue}>
                        <p className={styles.price}>{formatPrice(item.price)}</p>
                        <p className={up ? styles.up : styles.down}>{formatPercent(item.changePercent)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {!visible.length ? <p className={styles.emptyState}>표시할 관심 자산이 없습니다.</p> : null}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>오늘 보기 좋은 비교</h2>
              <span className={styles.panelCaption}>Quick pairs</span>
            </div>
            <div className={styles.stack}>
              {[
                ["BTC vs ETH", "메이저 코인 선도 흐름 비교"],
                ["SOL vs DOGE", "공격적 알트 수급 강도 체크"],
                ["NVDA vs TSLA", "기술주 위험 선호 온도 파악"],
                ["AAPL vs MSFT", "대형주 안정감과 순환 흐름 확인"]
              ].map(([title, desc]) => (
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
