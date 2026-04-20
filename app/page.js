"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HomeDashboardExtras from "@/components/home/HomeDashboardExtras";
import HomeSessionBoard from "@/components/home/HomeSessionBoard";
import MarketOverview from "@/components/market/MarketOverview";
import SectorHeatmap from "@/components/home/SectorHeatmap";
import EarningsCalendar from "@/components/home/EarningsCalendar";
import NewsList from "@/components/news/NewsList";
import NewsTitle from "@/components/news/NewsTitle";
import SideEconomyAI from "@/components/sidebar/SideEconomyAI";
import SideEvents from "@/components/sidebar/SideEvents";
import SideMajorNews from "@/components/sidebar/SideMajorNews";
import SideWatchlist from "@/components/sidebar/SideWatchlist";
import GeoRiskMonitor from "@/components/home/GeoRiskMonitor";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import styles from "./page.module.css";

export default function Home() {
  const { language } = useLanguage();
  const [majorNewsItems, setMajorNewsItems] = useState([]);
  const [majorNewsLoading, setMajorNewsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadMajorNews = async () => {
      try {
        const res = await fetch("/api/news/major", { cache: "no-store" });
        const json = await res.json();
        if (!mounted) return;
        setMajorNewsItems(Array.isArray(json?.items) ? json.items : []);
      } catch {
        if (mounted) setMajorNewsItems([]);
      } finally {
        if (mounted) setMajorNewsLoading(false);
      }
    };

    loadMajorNews();
    const timer = setInterval(loadMajorNews, 5 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <section className={styles.panel}>
            <GeoRiskMonitor />
          </section>

          <section className={styles.panel}>
            <MarketOverview />
          </section>

          <section className={styles.panel}>
            <HomeSessionBoard />
          </section>

          <section className={styles.panel}>
            <HomeDashboardExtras />
          </section>

          <section className={styles.panel}>
            <SectorHeatmap />
          </section>

          <section className={styles.panel}>
            <EarningsCalendar />
          </section>

          <section className={styles.panel}>
            <NewsTitle />
            <div className={styles.newsContent}>
              <NewsList />
            </div>
          </section>

          <div className={styles.chartButtonWrap}>
            <Link href="/chart" className={styles.chartButton}>
              {language === "ko" ? "차트 대시보드 열기" : "Open Chart Dashboard"}
            </Link>
          </div>
        </div>

        <aside className={styles.sidebar}>
          <SideEconomyAI />
          <div className={styles.majorNewsDesktopSlot}>
            <SideMajorNews items={majorNewsItems} loading={majorNewsLoading} />
          </div>
          <SideWatchlist />
          <SideEvents />
        </aside>
      </div>
    </main>
  );
}
