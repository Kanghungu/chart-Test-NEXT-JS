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
  const [snapshot, setSnapshot] = useState(null);
  const [clock, setClock]       = useState(null);

  useEffect(() => {
    setClock(new Date());
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/news/major", { cache: "no-store" });
        const json = await res.json();
        if (!mounted) return;
        setMajorNewsItems(Array.isArray(json?.items) ? json.items : []);
      } catch { if (mounted) setMajorNewsItems([]); }
      finally  { if (mounted) setMajorNewsLoading(false); }
    };
    load();
    const t = setInterval(load, 5 * 60_000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

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
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }) : "--:--:--";

  const dateStr = clock ? clock.toLocaleDateString(language === "ko" ? "ko-KR" : "en-US", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  }) : "";

  const kospi  = snapshot?.assets?.find(a => a.symbol === "KOSPI");
  const kosdaq = snapshot?.assets?.find(a => a.symbol === "KOSDAQ");
  const sp500  = snapshot?.assets?.find(a => a.symbol === "S&P 500");
  const nasdaq = snapshot?.assets?.find(a => a.symbol === "NASDAQ");
  const fgVal  = snapshot?.fearGreed?.value;
  const fgCls  = snapshot?.fearGreed?.classification;

  const pctColor = v => v == null ? "rgba(0,212,255,0.3)" : v >= 0 ? "#00ff88" : "#ff3366";
  const fmtPct   = v => v == null ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`;
  const fmtKrw   = v => v ? `₩${Number(v).toLocaleString("ko-KR")}` : "—";
  const fmtUsd   = v => v ? `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—";

  const shortcuts = [
    { href: "/crypto",    prefix: ">", ko: "크립토 터미널",  en: "CRYPTO" },
    { href: "/tools",     prefix: ">", ko: "트레이딩 도구",  en: "TOOLS" },
    { href: "/signals",   prefix: ">", ko: "시장 시그널",    en: "SIGNALS" },
    { href: "/briefing",  prefix: ">", ko: "AI 브리핑",      en: "BRIEFING" },
    { href: "/watchlist", prefix: ">", ko: "워치리스트",     en: "WATCHLIST" },
    { href: "/calendar",  prefix: ">", ko: "캘린더",         en: "CALENDAR" },
    { href: "/chart",     prefix: ">", ko: "차트",           en: "CHART" },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.inner}>

        {/* ══ HERO ══════════════════════════════════════════════ */}
        <header className={styles.hero}>
          <div className={styles.heroBg} />

          <div className={styles.heroLeft}>
            {/* 시스템 ID */}
            <div className={styles.statusRow}>
              <span className={styles.systemId}>MPK-SYS-v3 · ONLINE</span>
              <div className={styles.liveBadge}>
                <span className={styles.liveDot} />
                LIVE
              </div>
              <span className={styles.liveClock}>{timeStr}</span>
              <span className={styles.heroDate}>{dateStr}</span>
            </div>

            {/* 타이틀 */}
            <h1 className={styles.heroTitle}>
              MARKET{" "}
              <span className={styles.heroTitleAccent}>PULSE</span>
              {" "}KOREA
            </h1>

            {/* 서브타이틀 (터미널 스타일) */}
            <p className={styles.heroSub}>
              <span>실시간 시장</span>
              <i>·</i>
              <span>AI 분석</span>
              <i>·</i>
              <span>글로벌 매크로</span>
              <i>·</i>
              <span>크립토 터미널</span>
            </p>

            {/* CTA */}
            <div className={styles.heroActions}>
              <Link href="/crypto" className={styles.heroBtnPrimary}>
                ◈ {language === "ko" ? "크립토 터미널" : "CRYPTO TERMINAL"}
              </Link>
              <Link href="/tools" className={styles.heroBtnSecondary}>
                ⬡ {language === "ko" ? "트레이딩 도구" : "TOOLS"}
              </Link>
              <Link href="/briefing" className={styles.heroBtnSecondary}>
                ⬙ {language === "ko" ? "AI 브리핑" : "BRIEFING"}
              </Link>
            </div>
          </div>

          {/* 퀵스탯 그리드 */}
          <div className={styles.heroRight}>
            <div className={styles.quickStats}>
              {[
                { label:"KOSPI",   val:fmtKrw(kospi?.price),   pct:kospi?.changePercent   },
                { label:"KOSDAQ",  val:fmtKrw(kosdaq?.price),  pct:kosdaq?.changePercent  },
                { label:"S&P 500", val:fmtUsd(sp500?.price),   pct:sp500?.changePercent   },
                { label:"NASDAQ",  val:fmtUsd(nasdaq?.price),  pct:nasdaq?.changePercent  },
              ].map(({ label, val, pct }) => (
                <div key={label} className={styles.quickCard}>
                  <span className={styles.quickLabel}>{label}</span>
                  <span className={styles.quickPrice}>{val}</span>
                  <span className={styles.quickPct} style={{ color: pctColor(pct) }}>
                    {fmtPct(pct)}
                  </span>
                </div>
              ))}
              {fgVal != null && (
                <div className={styles.fgCard}>
                  <span className={styles.fgLabel}>{language === "ko" ? "공포탐욕" : "FEAR/GREED"}</span>
                  <span className={styles.fgValue} style={{
                    color: fgVal >= 70 ? "#00ff88" : fgVal <= 30 ? "#ff3366" : "#ffaa00",
                    textShadow: `0 0 15px ${fgVal >= 70 ? "rgba(0,255,136,0.7)" : fgVal <= 30 ? "rgba(255,51,102,0.7)" : "rgba(255,170,0,0.7)"}`,
                  }}>{fgVal}</span>
                  <span className={styles.fgClass}>{fgCls}</span>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ══ MAIN GRID ════════════════════════════════════════ */}
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

        {/* ══ 단축 메뉴 ════════════════════════════════════════ */}
        <div className={styles.shortcuts}>
          {shortcuts.map(({ href, prefix, ko, en }) => (
            <Link key={href} href={href} className={styles.shortcutBtn}>
              <span style={{ color:"rgba(0,212,255,0.4)", fontWeight:300 }}>{prefix}</span>
              {language === "ko" ? ko : en}
            </Link>
          ))}
        </div>

      </div>
    </main>
  );
}
