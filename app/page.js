"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HomeDashboardExtras from "@/components/home/HomeDashboardExtras";
import HomeSessionBoard    from "@/components/home/HomeSessionBoard";
import EarningsCalendar    from "@/components/home/EarningsCalendar";
import GeoRiskMonitor      from "@/components/home/GeoRiskMonitor";
import SideEconomyAI       from "@/components/sidebar/SideEconomyAI";
import SideEvents          from "@/components/sidebar/SideEvents";
import SideMajorNews       from "@/components/sidebar/SideMajorNews";
import SideWatchlist       from "@/components/sidebar/SideWatchlist";
import { useLanguage }     from "@/components/i18n/LanguageProvider";
import styles              from "./page.module.css";

export default function Home() {
  const { language } = useLanguage();
  const [majorNewsItems, setMajorNewsItems] = useState([]);
  const [majorNewsLoading, setMajorNewsLoading] = useState(true);
  const [snapshot, setSnapshot]   = useState(null);
  const [clock, setClock]         = useState(null);

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

  // 스냅샷
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/market/snapshot", { cache: "no-store" });
        if (mounted) setSnapshot(await res.json());
      } catch {}
    };
    load();
    const t = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  const timeStr = clock ? clock.toLocaleTimeString("ko-KR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }) : "--:--:--";

  const dateStr = clock ? clock.toLocaleDateString(language === "ko" ? "ko-KR" : "en-US", {
    year: "numeric", month: "long", day: "numeric", weekday: "short"
  }) : "";

  const kospi  = snapshot?.assets?.find(a => a.symbol === "KOSPI");
  const kosdaq = snapshot?.assets?.find(a => a.symbol === "KOSDAQ");
  const sp500  = snapshot?.assets?.find(a => a.symbol === "S&P 500");
  const nasdaq = snapshot?.assets?.find(a => a.symbol === "NASDAQ");
  const fgVal  = snapshot?.fearGreed?.value;
  const fgCls  = snapshot?.fearGreed?.classification;

  const pctColor = v => v == null ? "#64748b" : v >= 0 ? "#10b981" : "#f87171";
  const fmtPct   = v => v == null ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`;
  const fmtKrw   = v => v ? `₩${Number(v).toLocaleString("ko-KR")}` : "—";
  const fmtUsd   = v => v ? `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—";

  const shortcuts = [
    { href: "/crypto",    icon: "◈", ko: "크립토 터미널",  en: "Crypto" },
    { href: "/tools",     icon: "⬡", ko: "트레이딩 도구",  en: "Tools" },
    { href: "/signals",   icon: "◉", ko: "시장 시그널",    en: "Signals" },
    { href: "/briefing",  icon: "⬙", ko: "AI 브리핑",      en: "Briefing" },
    { href: "/watchlist", icon: "▦", ko: "워치리스트",     en: "Watchlist" },
    { href: "/calendar",  icon: "▤", ko: "경제 캘린더",    en: "Calendar" },
    { href: "/chart",     icon: "◈", ko: "고급 차트",      en: "Chart" },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.inner}>

        {/* ══ HERO ════════════════════════════════════════════════ */}
        <header className={styles.hero}>
          <div className={styles.heroLeft}>

            {/* 터미널 상단 바 */}
            <div className={styles.terminalBar}>
              <div className={styles.terminalDots}>
                <span className={`${styles.terminalDot} ${styles.dotRed}`}   />
                <span className={`${styles.terminalDot} ${styles.dotAmber}`} />
                <span className={`${styles.terminalDot} ${styles.dotGreen}`} />
              </div>
              <span>market-pulse-korea</span>
              <span className={styles.terminalPath}>/home</span>
            </div>

            <div style={{ display:"flex", alignItems:"center", gap:"1rem", flexWrap:"wrap" }}>
              <div className={styles.liveBadge}>
                <span className={styles.liveDot} />
                LIVE
              </div>
              <span className={styles.liveClock}>{timeStr} KST</span>
              <span className={styles.heroDate}>{dateStr}</span>
            </div>

            <h1 className={styles.heroTitle}>
              {language === "ko" ? "Market Pulse Korea" : "Market Pulse Korea"}
            </h1>

            <p className={styles.heroSub}>
              {language === "ko"
                ? <>실시간 <span>시장 데이터</span> · AI <span>분석</span> · <span>글로벌 매크로</span> · 크립토 <span>터미널</span></>
                : <>Real-time <span>market data</span> · AI <span>analysis</span> · <span>Global macro</span> · Crypto <span>terminal</span></>}
            </p>

            <div className={styles.heroActions}>
              <Link href="/crypto"  className={styles.heroBtnPrimary}>
                ◈ {language === "ko" ? "크립토 터미널" : "Crypto Terminal"}
              </Link>
              <Link href="/tools" className={styles.heroBtnSecondary}>
                ⬡ {language === "ko" ? "트레이딩 도구" : "Trading Tools"}
              </Link>
              <Link href="/briefing" className={styles.heroBtnSecondary}>
                ⬙ {language === "ko" ? "AI 브리핑" : "AI Briefing"}
              </Link>
            </div>
          </div>

          {/* Quick Stats */}
          <div className={styles.heroRight}>
            <div className={styles.quickStats}>
              <div className={styles.quickCard} style={{"--card-color":"#06b6d4"}}>
                <span className={styles.quickLabel}>KOSPI</span>
                <span className={styles.quickPrice}>{fmtKrw(kospi?.price)}</span>
                <span className={styles.quickPct} style={{color:pctColor(kospi?.changePercent)}}>{fmtPct(kospi?.changePercent)}</span>
              </div>
              <div className={styles.quickCard} style={{"--card-color":"#7c3aed"}}>
                <span className={styles.quickLabel}>KOSDAQ</span>
                <span className={styles.quickPrice}>{fmtKrw(kosdaq?.price)}</span>
                <span className={styles.quickPct} style={{color:pctColor(kosdaq?.changePercent)}}>{fmtPct(kosdaq?.changePercent)}</span>
              </div>
              <div className={styles.quickCard} style={{"--card-color":"#10b981"}}>
                <span className={styles.quickLabel}>S&P 500</span>
                <span className={styles.quickPrice}>{fmtUsd(sp500?.price)}</span>
                <span className={styles.quickPct} style={{color:pctColor(sp500?.changePercent)}}>{fmtPct(sp500?.changePercent)}</span>
              </div>
              <div className={styles.quickCard} style={{"--card-color":"#ec4899"}}>
                <span className={styles.quickLabel}>NASDAQ</span>
                <span className={styles.quickPrice}>{fmtUsd(nasdaq?.price)}</span>
                <span className={styles.quickPct} style={{color:pctColor(nasdaq?.changePercent)}}>{fmtPct(nasdaq?.changePercent)}</span>
              </div>
              {fgVal != null && (
                <div className={styles.fgCard}>
                  <span className={styles.fgLabel}>{language === "ko" ? "공포탐욕" : "Fear&Greed"}</span>
                  <span className={styles.fgValue} style={{color: fgVal>=60?"#10b981":fgVal<=40?"#f87171":"#f59e0b",
                    textShadow:`0 0 20px ${fgVal>=60?"rgba(16,185,129,0.8)":fgVal<=40?"rgba(248,113,113,0.8)":"rgba(245,158,11,0.8)"}`
                  }}>{fgVal}</span>
                  <span className={styles.fgClass}>{fgCls}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ══ MAIN GRID ════════════════════════════════════════════ */}
        <div className={styles.mainGrid}>
          <div className={styles.col1}>
            <div className={styles.panel}><GeoRiskMonitor /></div>
            <div className={styles.panel}><HomeSessionBoard /></div>
          </div>
          <div className={styles.col2}>
            <div className={styles.panel}><HomeDashboardExtras /></div>
            <div className={styles.panel}><EarningsCalendar /></div>
          </div>
          <div className={styles.col3}>
            <div className={styles.panel}><SideEconomyAI /></div>
            <div className={styles.panel}><SideMajorNews items={majorNewsItems} loading={majorNewsLoading} /></div>
            <div className={styles.panel}><SideWatchlist /></div>
            <div className={styles.panel}><SideEvents /></div>
          </div>
        </div>

        {/* ══ SHORTCUTS ════════════════════════════════════════════ */}
        <div className={styles.shortcuts}>
          {shortcuts.map(({ href, icon, ko, en }) => (
            <Link key={href} href={href} className={styles.shortcutBtn}>
              <span style={{ fontFamily:"monospace", color:"inherit" }}>{icon}</span>
              <span>{language === "ko" ? ko : en}</span>
            </Link>
          ))}
        </div>

      </div>
    </main>
  );
}
