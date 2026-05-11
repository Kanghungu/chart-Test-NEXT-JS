"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HomeDashboardExtras from "@/components/home/HomeDashboardExtras";
import HomeSessionBoard from "@/components/home/HomeSessionBoard";
import EarningsCalendar from "@/components/home/EarningsCalendar";
import GeoRiskMonitor from "@/components/home/GeoRiskMonitor";
import SideEconomyAI from "@/components/sidebar/SideEconomyAI";
import SideEvents from "@/components/sidebar/SideEvents";
import SideMajorNews from "@/components/sidebar/SideMajorNews";
import SideWatchlist from "@/components/sidebar/SideWatchlist";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import styles from "./page.module.css";

const QUICK_ASSETS = [
  { label: "KOSPI",  key: "KOSPI",   color: "#06b6d4" },
  { label: "KOSDAQ", key: "KOSDAQ",  color: "#7c3aed" },
  { label: "S&P500", key: "SP500",   color: "#10b981" },
  { label: "나스닥",  key: "NASDAQ",  color: "#ec4899" },
  { label: "공포탐욕", key: "FG",    color: "#f59e0b" },
];

export default function Home() {
  const { language } = useLanguage();
  const [majorNewsItems, setMajorNewsItems] = useState([]);
  const [majorNewsLoading, setMajorNewsLoading] = useState(true);
  const [snapshot, setSnapshot] = useState(null);
  const [clock, setClock] = useState(null);

  // 실시간 시계
  useEffect(() => {
    setClock(new Date());
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // 뉴스
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/news/major", { cache: "no-store" });
        const json = await res.json();
        if (!mounted) return;
        setMajorNewsItems(Array.isArray(json?.items) ? json.items : []);
      } catch { if (mounted) setMajorNewsItems([]); }
      finally { if (mounted) setMajorNewsLoading(false); }
    };
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  // 스냅샷 (KOSPI, KOSDAQ, Fear&Greed)
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/market/snapshot", { cache: "no-store" });
        const json = await res.json();
        if (mounted) setSnapshot(json);
      } catch {}
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  const timeStr = clock
    ? clock.toLocaleTimeString(language === "ko" ? "ko-KR" : "en-US", {
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
      })
    : "--:--:--";

  const dateStr = clock
    ? clock.toLocaleDateString(language === "ko" ? "ko-KR" : "en-US", {
        year: "numeric", month: "long", day: "numeric", weekday: "short",
      })
    : "";

  const kospiAsset = snapshot?.assets?.find(a => a.symbol === "KOSPI");
  const kosdaqAsset = snapshot?.assets?.find(a => a.symbol === "KOSDAQ");
  const sp500Asset  = snapshot?.assets?.find(a => a.symbol === "S&P 500");
  const nasdaqAsset = snapshot?.assets?.find(a => a.symbol === "NASDAQ");
  const fgValue     = snapshot?.fearGreed?.value;
  const fgClass     = snapshot?.fearGreed?.classification;

  function pctColor(v) {
    if (v == null) return "#64748b";
    return v >= 0 ? "#10b981" : "#f87171";
  }
  function fmtPct(v) {
    if (v == null) return "—";
    return `${v >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`;
  }

  return (
    <main className={styles.page}>
      {/* 홀로그램 배경 오브 */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <div className={styles.orb3} />
      <div className={styles.gridLines} />

      <div className={styles.inner}>

        {/* ══ HERO ══════════════════════════════════════════════════════════ */}
        <header className={styles.hero}>
          <div className={styles.heroLeft}>
            <div className={styles.liveBadge}>
              <span className={styles.liveDot} />
              <span>LIVE</span>
              <span className={styles.liveClock}>{timeStr} KST</span>
            </div>
            <div className={styles.heroDate}>{dateStr}</div>
            <h1 className={styles.heroTitle}>Market Pulse Korea</h1>
            <p className={styles.heroSub}>
              {language === "ko"
                ? "실시간 시장 데이터 · AI 분석 · 글로벌 매크로 · 크립토 터미널"
                : "Real-time markets · AI analysis · Global macro · Crypto terminal"}
            </p>
            <div className={styles.heroActions}>
              <Link href="/crypto" className={styles.heroBtnPrimary}>
                🔮 {language === "ko" ? "크립토 터미널" : "Crypto Terminal"}
              </Link>
              <Link href="/tools" className={styles.heroBtnSecondary}>
                🛠 {language === "ko" ? "트레이딩 도구" : "Trading Tools"}
              </Link>
            </div>
          </div>
          <div className={styles.heroRight}>
            {/* Quick stats */}
            <div className={styles.quickStats}>
              <QuickStat label="KOSPI" asset={kospiAsset} pctColor={pctColor} fmtPct={fmtPct} color="#06b6d4"
                format={v => `₩${Number(v).toLocaleString("ko-KR")}`} />
              <QuickStat label="KOSDAQ" asset={kosdaqAsset} pctColor={pctColor} fmtPct={fmtPct} color="#7c3aed"
                format={v => `₩${Number(v).toLocaleString("ko-KR")}`} />
              <QuickStat label="S&P 500" asset={sp500Asset} pctColor={pctColor} fmtPct={fmtPct} color="#10b981"
                format={v => v ? `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"} />
              <QuickStat label="NASDAQ" asset={nasdaqAsset} pctColor={pctColor} fmtPct={fmtPct} color="#ec4899"
                format={v => v ? `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"} />
              {fgValue != null && (
                <div className={styles.fgCard}>
                  <span className={styles.fgLabel}>{language === "ko" ? "공포탐욕" : "Fear&Greed"}</span>
                  <span className={styles.fgValue} style={{ color: fgValue >= 60 ? "#10b981" : fgValue <= 40 ? "#f87171" : "#f59e0b" }}>
                    {fgValue}
                  </span>
                  <span className={styles.fgClass}>{fgClass}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ══ MAIN GRID ══════════════════════════════════════════════════════ */}
        <div className={styles.mainGrid}>

          {/* 좌측: 지정학 + 세션 보드 */}
          <div className={styles.col1}>
            <div className={styles.panel}>
              <GeoRiskMonitor />
            </div>
            <div className={styles.panel}>
              <HomeSessionBoard />
            </div>
          </div>

          {/* 중앙: 대시보드 + 이닝스 */}
          <div className={styles.col2}>
            <div className={styles.panel}>
              <HomeDashboardExtras />
            </div>
            <div className={styles.panel}>
              <EarningsCalendar />
            </div>
          </div>

          {/* 우측: AI + 뉴스 + 워치리스트 + 이벤트 */}
          <div className={styles.col3}>
            <div className={styles.panel}>
              <SideEconomyAI />
            </div>
            <div className={styles.panel}>
              <SideMajorNews items={majorNewsItems} loading={majorNewsLoading} />
            </div>
            <div className={styles.panel}>
              <SideWatchlist />
            </div>
            <div className={styles.panel}>
              <SideEvents />
            </div>
          </div>

        </div>

        {/* ══ 바로가기 버튼들 ═════════════════════════════════════════════ */}
        <div className={styles.shortcuts}>
          {[
            { href: "/crypto",    icon: "🔮", ko: "크립토 터미널",   en: "Crypto Terminal" },
            { href: "/tools",     icon: "🛠", ko: "트레이딩 도구",   en: "Trading Tools" },
            { href: "/signals",   icon: "📡", ko: "시장 시그널",     en: "Market Signals" },
            { href: "/briefing",  icon: "🤖", ko: "AI 브리핑",       en: "AI Briefing" },
            { href: "/watchlist", icon: "📋", ko: "워치리스트",      en: "Watchlist" },
            { href: "/calendar",  icon: "📅", ko: "경제 캘린더",     en: "Calendar" },
          ].map(({ href, icon, ko, en }) => (
            <Link key={href} href={href} className={styles.shortcutBtn}>
              <span>{icon}</span>
              <span>{language === "ko" ? ko : en}</span>
            </Link>
          ))}
        </div>

      </div>
    </main>
  );
}

function QuickStat({ label, asset, pctColor, fmtPct, color, format }) {
  const price = asset?.price;
  const pct   = asset?.changePercent;
  return (
    <div className={styles.quickCard} style={{ "--card-color": color }}>
      <span className={styles.quickLabel}>{label}</span>
      <span className={styles.quickPrice}>{price != null ? format(price) : "—"}</span>
      <span className={styles.quickPct} style={{ color: pctColor(pct) }}>{fmtPct(pct)}</span>
    </div>
  );
}
