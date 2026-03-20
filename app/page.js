"use client";

import Link from "next/link";
import HomeDashboardExtras from "@/components/home/HomeDashboardExtras";
import MarketOverview from "@/components/market/MarketOverview";
import NewsList from "@/components/news/NewsList";
import NewsTitle from "@/components/news/NewsTitle";
import SideEconomyAI from "@/components/sidebar/SideEconomyAI";
import SideEvents from "@/components/sidebar/SideEvents";
import SideWatchlist from "@/components/sidebar/SideWatchlist";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.mainColumn}>
          <section className={styles.panel}>
            <MarketOverview />
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
            <Link href="/chart">
              <button className={styles.chartButton}>차트 대시보드 열기</button>
            </Link>
          </div>
        </div>

        <div className={styles.sidebar}>
          <SideEconomyAI />
          <SideWatchlist />
          <SideEvents />
        </div>
      </div>
    </main>
  );
}
