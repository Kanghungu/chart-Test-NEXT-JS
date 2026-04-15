"use client";

import Link from "next/link";
import HomeDashboardExtras from "@/components/home/HomeDashboardExtras";
import HomeSessionBoard from "@/components/home/HomeSessionBoard";
import MarketOverview from "@/components/market/MarketOverview";
import NewsList from "@/components/news/NewsList";
import NewsTitle from "@/components/news/NewsTitle";
import SideEconomyAI from "@/components/sidebar/SideEconomyAI";
import SideEvents from "@/components/sidebar/SideEvents";
import SideMajorNews from "@/components/sidebar/SideMajorNews";
import SideWatchlist from "@/components/sidebar/SideWatchlist";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import styles from "./page.module.css";

export default function Home() {
  const { language } = useLanguage();

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.mainColumn}>
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
          <SideMajorNews />
          <SideWatchlist />
          <SideEvents />
        </aside>
      </div>
    </main>
  );
}
