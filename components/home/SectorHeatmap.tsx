"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./SectorHeatmap.module.css";
import { formatPercent } from "@/lib/formatters";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type WatchItem = {
  symbol: string;
  name: string;
  nameKo?: string;
  nameEn?: string;
  group: "korea" | "stock";
  price: number | null;
  changePercent: number | null;
};

type SnapshotAsset = {
  symbol: string;
  name?: string;
  price: number | null;
  changePercent: number | null;
  currency?: string;
};

type SectorDef = {
  id: string;
  nameKo: string;
  nameEn: string;
  symbols: string[];
};

const KOREA_SECTORS: SectorDef[] = [
  { id: "semiconductor", nameKo: "반도체", nameEn: "Semiconductors", symbols: ["000660", "005930"] },
  { id: "auto",         nameKo: "자동차", nameEn: "Auto",            symbols: ["005380", "000270"] },
  { id: "internet",     nameKo: "인터넷", nameEn: "Internet",         symbols: ["035420", "035720"] },
  { id: "bio",          nameKo: "바이오", nameEn: "Biotech",          symbols: ["068270", "207940"] },
];

const US_SECTORS: SectorDef[] = [
  { id: "ai",       nameKo: "AI/반도체", nameEn: "AI/Chips",   symbols: ["NVDA", "AMD"] },
  { id: "bigtech",  nameKo: "빅테크",   nameEn: "Big Tech",   symbols: ["AAPL", "MSFT", "META"] },
  { id: "ev",       nameKo: "EV",       nameEn: "EV",          symbols: ["TSLA"] },
  { id: "index",    nameKo: "지수",     nameEn: "Indexes",     symbols: ["S&P 500", "NASDAQ"] },
];

function getChangeColor(change: number | null): string {
  if (change === null) return "";
  if (change >= 3) return styles.tier5Up;
  if (change >= 1.5) return styles.tier4Up;
  if (change >= 0.5) return styles.tier3Up;
  if (change > 0) return styles.tier2Up;
  if (change > -0.5) return styles.tier2Down;
  if (change > -1.5) return styles.tier3Down;
  if (change > -3) return styles.tier4Down;
  return styles.tier5Down;
}

function SectorCell({ name, symbol, change }: { name: string; symbol: string; change: number | null }) {
  const colorClass = getChangeColor(change);
  return (
    <div className={`${styles.cell} ${colorClass}`}>
      <span className={styles.cellSymbol}>{symbol}</span>
      <span className={styles.cellName}>{name}</span>
      <span className={styles.cellChange}>{formatPercent(change)}</span>
    </div>
  );
}

function SectorRow({ sector, items }: {
  sector: SectorDef;
  items: Array<{ symbol: string; name: string; change: number | null }>;
  language: "ko" | "en";
}) {
  const avg = useMemo(() => {
    const valid = items.filter((i) => i.change !== null).map((i) => i.change as number);
    if (!valid.length) return null;
    return valid.reduce((a, b) => a + b, 0) / valid.length;
  }, [items]);

  const avgColor = getChangeColor(avg);

  return (
    <div className={styles.sectorRow}>
      <div className={`${styles.sectorLabel} ${avgColor}`}>
        <span className={styles.sectorAvg}>{formatPercent(avg)}</span>
      </div>
      <div className={styles.cellGroup}>
        {items.map((item) => (
          <SectorCell key={item.symbol} name={item.name} symbol={item.symbol} change={item.change} />
        ))}
        {!items.length && (
          <div className={`${styles.cell} ${styles.cellEmpty}`}>
            <span className={styles.cellSymbol}>-</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SectorHeatmap() {
  const { language } = useLanguage();
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [snapshotAssets, setSnapshotAssets] = useState<SnapshotAsset[]>([]);
  const [tab, setTab] = useState<"korea" | "us">("korea");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [watchRes, snapRes] = await Promise.all([
          fetch("/api/market/watchlist", { cache: "no-store" }),
          fetch("/api/market/snapshot", { cache: "no-store" }),
        ]);
        const [watchJson, snapJson] = await Promise.all([watchRes.json(), snapRes.json()]);
        if (!mounted) return;
        setWatchlist(Array.isArray(watchJson?.items) ? watchJson.items : []);
        setSnapshotAssets(Array.isArray(snapJson?.assets) ? snapJson.assets : []);
      } catch {
        // silently fail, watchlist stays empty
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    const timer = setInterval(load, 60000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  const bySymbol = useMemo(() => {
    const map: Record<string, { name: string; change: number | null }> = {};
    for (const item of watchlist) {
      map[item.symbol] = { name: item.nameKo && language === "ko" ? item.nameKo : item.nameEn || item.name, change: item.changePercent };
    }
    for (const asset of snapshotAssets) {
      if (!map[asset.symbol]) {
        map[asset.symbol] = { name: asset.name || asset.symbol, change: asset.changePercent };
      }
    }
    return map;
  }, [watchlist, snapshotAssets, language]);

  const sectorData = useMemo(() => {
    const sectors = tab === "korea" ? KOREA_SECTORS : US_SECTORS;
    return sectors.map((sector) => ({
      sector,
      items: sector.symbols.map((sym) => ({
        symbol: sym,
        name: bySymbol[sym]?.name || sym,
        change: bySymbol[sym]?.change ?? null,
      })),
    }));
  }, [tab, bySymbol]);

  const title = language === "ko" ? "섹터 히트맵" : "Sector Heatmap";
  const subtitle = language === "ko" ? "섹터별 등락 현황" : "Performance by sector";

  return (
    <section className={styles.root}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <p className={styles.eyebrow}>SECTOR</p>
          <h2 className={styles.title}>{title}</h2>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${tab === "korea" ? styles.tabActive : ""}`}
            onClick={() => setTab("korea")}
          >
            {language === "ko" ? "한국" : "Korea"}
          </button>
          <button
            className={`${styles.tab} ${tab === "us" ? styles.tabActive : ""}`}
            onClick={() => setTab("us")}
          >
            {language === "ko" ? "미국" : "US"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>{language === "ko" ? "데이터 불러오는 중..." : "Loading..."}</div>
      ) : (
        <div className={styles.grid}>
          {sectorData.map(({ sector, items }) => (
            <div key={sector.id} className={styles.sectorBlock}>
              <p className={styles.sectorName}>{language === "ko" ? sector.nameKo : sector.nameEn}</p>
              <SectorRow sector={sector} items={items} language={language} />
            </div>
          ))}
        </div>
      )}

      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.tier5Up}`} />
          {language === "ko" ? "+3% 이상" : "≥+3%"}
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.tier3Up}`} />
          {language === "ko" ? "+0.5~3%" : "+0.5–3%"}
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.tier2Down}`} />
          {language === "ko" ? "-0.5% 미만" : "<-0.5%"}
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.tier5Down}`} />
          {language === "ko" ? "-3% 이하" : "≤-3%"}
        </span>
      </div>
    </section>
  );
}
