"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import HomeDashboardExtras from "@/components/home/HomeDashboardExtras";
import HomeSessionBoard    from "@/components/home/HomeSessionBoard";
import GeoRiskMonitor      from "@/components/home/GeoRiskMonitor";
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
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");

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

  const askAi = async (q) => {
    const question = (q || aiQuestion).trim();
    if (!question) return;
    setAiLoading(true);
    setAiAnswer("");
    try {
      const res = await fetch("/api/ai/economy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question }),
      });
      const json = await res.json();
      setAiAnswer(json?.answer || "");
    } catch { setAiAnswer("응답을 가져오지 못했습니다. 잠시 후 다시 시도해주세요."); }
    setAiLoading(false);
  };

  const timeStr = clock ? clock.toLocaleTimeString("ko-KR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }) + " KST" : "--:--:-- KST";

  const dateStr = clock ? clock.toLocaleDateString(language === "ko" ? "ko-KR" : "en-US", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  }) : "";

  // snapshot 자산 찾기
  const assets   = snapshot?.assets ?? [];
  const kospi    = assets.find(a => a.symbol === "KOSPI");
  const kosdaq   = assets.find(a => a.symbol === "KOSDAQ");
  const sp500    = assets.find(a => a.symbol === "S&P 500");
  const nasdaq   = assets.find(a => a.symbol === "NASDAQ");
  const fgVal    = snapshot?.fearGreed?.value;
  const fgCls    = snapshot?.fearGreed?.classification;

  const fmtKrw = v => v != null ? `₩${Number(v).toLocaleString("ko-KR")}` : "—";
  const fmtUsd = v => v != null ? `$${Number(v).toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—";
  const fmtPct = v => v == null ? "—" : `${v >= 0 ? "+" : ""}${Number(v).toFixed(2)}%`;
  const pctCls = v => v == null ? "" : v >= 0 ? styles.metricUp : styles.metricDn;
  const barPct = v => Math.min(100, Math.max(0, 50 + (v ?? 0) * 8));

  const quickSuggestions = language === "ko"
    ? ["오늘 시장 요약", "코스피 전망", "반도체 분석", "CPI 시나리오"]
    : ["Market brief", "KOSPI outlook", "Semiconductor", "CPI scenario"];

  const shortcuts = [
    { href: "/crypto",    ko: "크립토 터미널",  en: "Crypto" },
    { href: "/tools",     ko: "트레이딩 도구",  en: "Tools" },
    { href: "/signals",   ko: "시장 시그널",    en: "Signals" },
    { href: "/briefing",  ko: "AI 브리핑",      en: "Briefing" },
    { href: "/watchlist", ko: "워치리스트",     en: "Watchlist" },
    { href: "/calendar",  ko: "경제 캘린더",    en: "Calendar" },
    { href: "/chart",     ko: "고급 차트",      en: "Chart" },
  ];

  return (
    <main>
      <div className={styles.page}>

        {/* ══ ROW 1: HERO + AI ══════════════════════════════════ */}
        <div className={styles.row1}>

          {/* ── HERO ── */}
          <div className={`${styles.panel} ${styles.hero}`}>
            {/* Eyebrow */}
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              <span className={styles.eyebrowTitle}>
                {language === "ko" ? "시장 현황" : "Market Overview"}
              </span>
              <span className={styles.eyebrowMeta}>REAL-TIME · KR · US · CRYPTO</span>
            </div>

            {/* 상태 행 */}
            <div className={styles.statusRow}>
              <div className={styles.liveBadge}>
                <span className={styles.liveDot} />
                LIVE
              </div>
              <span className={styles.liveClock}>{timeStr}</span>
              <span className={styles.heroDate}>{dateStr}</span>
            </div>

            {/* 타이틀 */}
            <h1 className={styles.heroTitle}>
              {language === "ko" ? (
                <>실시간 시장,<br /><span className={styles.heroTitleGrad}>한눈에 보다</span></>
              ) : (
                <>Real-time markets,<br /><span className={styles.heroTitleGrad}>at a glance</span></>
              )}
            </h1>
            <p className={styles.heroSub}>
              {language === "ko" ? (
                <>한국·미국·크립토 시장을 동시에 추적합니다. 시장 변동성과 트렌드를 <span className={styles.heroSubAccent}>AI 분석</span>으로 빠르게 파악하세요.</>
              ) : (
                <>Track Korean, US, and crypto markets simultaneously. Use <span className={styles.heroSubAccent}>AI analysis</span> to spot trends fast.</>
              )}
            </p>

            {/* Metric 카드 4개 */}
            <div className={styles.metrics}>
              {[
                { label: "KOSPI",   val: fmtKrw(kospi?.price),  pct: kospi?.changePercent,  barW: barPct(kospi?.changePercent) },
                { label: "KOSDAQ",  val: fmtKrw(kosdaq?.price), pct: kosdaq?.changePercent, barW: barPct(kosdaq?.changePercent) },
                { label: "S&P 500", val: fmtUsd(sp500?.price),  pct: sp500?.changePercent,  barW: barPct(sp500?.changePercent) },
                { label: fgVal != null ? `탐욕 ${fgVal}` : "공포탐욕", val: fgVal != null ? String(fgVal) : "—", pct: null, fgCls: fgCls, isFg: true, barW: fgVal ?? 50 },
              ].map(({ label, val, pct, barW, isFg }) => (
                <div key={label} className={`${styles.metric} ${pctCls(pct)}`}>
                  <div className={styles.metricLabel}>{label}</div>
                  <div className={styles.metricValue}>{val}</div>
                  {pct != null && <div className={styles.metricPct}>{fmtPct(pct)}</div>}
                  {isFg && fgVal != null && (
                    <div className={styles.metricPct} style={{
                      color: fgVal >= 60 ? "var(--gr)" : fgVal <= 40 ? "var(--ro)" : "var(--am)"
                    }}>{fgCls}</div>
                  )}
                  <div className={styles.metricBar}>
                    <i className={`${styles.metricBarFill} ${pct != null && pct < 0 ? styles.metricBarFillDn : ""}`}
                       style={{ width: `${barW}%`, display:"block", height:"100%" }} />
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className={styles.heroActions}>
              <Link href="/crypto" className={styles.heroBtnPrimary}>
                ◈ {language === "ko" ? "크립토 터미널" : "Crypto Terminal"}
              </Link>
              <Link href="/tools" className={styles.heroBtnSecondary}>
                ⬡ {language === "ko" ? "트레이딩 도구" : "Tools"}
              </Link>
              <Link href="/briefing" className={styles.heroBtnSecondary}>
                ⬙ {language === "ko" ? "AI 브리핑" : "Briefing"}
              </Link>
            </div>
          </div>

          {/* ── AI 어시스턴트 ── */}
          <div className={`${styles.panel} ${styles.aiPanel}`}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              <span className={styles.eyebrowTitle}>AI 어시스턴트</span>
              <span className={styles.eyebrowMeta}>AI 코어 · 응답 대기</span>
            </div>

            <div className={styles.aiTop}>
              <div className={styles.aiIcon} aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path
                    d="M10 1.5L11.8 7.2L17.5 9L11.8 10.8L10 16.5L8.2 10.8L2.5 9L8.2 7.2L10 1.5Z"
                    fill="#fff"
                  />
                </svg>
              </div>

              <div>
                <div className={styles.aiName}>Market Pulse AI</div>
                <div className={styles.aiRole}>
                  {language === "ko" ? "시장 인텔리전스 분석가" : "Market Intelligence Analyst"}
                </div>
                <div className={styles.aiState}>
                  {language === "ko" ? "생각 중 · 시장 데이터 분석" : "Analyzing market data"}
                </div>
                <div className={styles.wave}>
                  {[30,65,90,50,75,40,85,55,70,35,80,50].map((h, i) => (
                    <i key={i} className={styles.waveLine} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>

            {/* 말풍선 */}
            <div className={styles.bubble}>
              <span className={styles.bubbleTs}>
                {language === "ko" ? "방금 · 오늘의 브리핑" : "Just now · Today's brief"}
              </span>
              {aiLoading ? (
                <>{language === "ko" ? "분석 중" : "Analyzing"}<span className={styles.caret} /></>
              ) : aiAnswer ? (
                aiAnswer
              ) : (
                <>
                  {language === "ko" ? (
                    <>{fgVal != null ? (fgVal >= 60 ? `공포탐욕 ${fgVal}로 시장 과열 구간` : fgVal <= 40 ? `공포탐욕 ${fgVal}로 공포 구간` : `공포탐욕 ${fgVal} 중립 구간`) : "시장 데이터 분석 중"} · <span className={styles.bubbleAccent}>AI에게 질문</span>해보세요<span className={styles.caret} /></>
                  ) : (
                    <>Fear&Greed {fgVal ?? "..."} · Ask me anything about today&apos;s market<span className={styles.caret} /></>
                  )}
                </>
              )}
            </div>

            {/* 빠른 질문 */}
            <div className={styles.suggest}>
              {quickSuggestions.map(q => (
                <button key={q} className={styles.chip} onClick={() => askAi(q)}>{q}</button>
              ))}
            </div>

            {/* 입력창 */}
            <div className={styles.askRow}>
              <input
                className={styles.askInput}
                placeholder={language === "ko" ? "AI에게 시장을 물어보세요…" : "Ask about the market…"}
                value={aiQuestion}
                onChange={e => setAiQuestion(e.target.value)}
                onKeyDown={e => e.key === "Enter" && askAi()}
              />
              <button className={styles.askBtn} onClick={() => askAi()} disabled={aiLoading}>
                {language === "ko" ? "물어보기" : "Ask"}
              </button>
            </div>
          </div>

        </div>

        {/* ══ ROW 2: 세션보드 · 워치리스트/뉴스 · 리스크 ═══════════ */}
        <div className={styles.row2}>

          {/* 세션 보드 */}
          <div className={styles.panel}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              <span className={styles.eyebrowTitle}>{language === "ko" ? "세션 보드" : "Session Board"}</span>
              <span className={styles.eyebrowMeta}>KR · US · EU</span>
            </div>
            <HomeSessionBoard />
          </div>

          {/* 주요 뉴스 */}
          <div className={styles.panel}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              <span className={styles.eyebrowTitle}>{language === "ko" ? "주요 뉴스" : "Major News"}</span>
              <span className={styles.eyebrowMeta}>REAL-TIME</span>
            </div>
            <SideMajorNews items={majorNewsItems} loading={majorNewsLoading} />
          </div>

          {/* 지정학 리스크 */}
          <div className={styles.panel}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              <span className={styles.eyebrowTitle}>{language === "ko" ? "지정학 리스크" : "Geo Risk"}</span>
              <span className={styles.eyebrowMeta}>4 REGIONS</span>
            </div>
            <GeoRiskMonitor />
          </div>

        </div>

        {/* ══ ROW 3: 대시보드 · 워치리스트 · 이벤트 ═══════════════ */}
        <div className={styles.row2}>
          <div className={styles.panel}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              <span className={styles.eyebrowTitle}>{language === "ko" ? "시장 대시보드" : "Dashboard"}</span>
            </div>
            <HomeDashboardExtras />
          </div>
          <div className={styles.panel}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              <span className={styles.eyebrowTitle}>{language === "ko" ? "워치리스트" : "Watchlist"}</span>
            </div>
            <SideWatchlist />
          </div>
          <div className={styles.panel}>
            <div className={styles.eyebrow}>
              <span className={styles.eyebrowDot} />
              <span className={styles.eyebrowTitle}>{language === "ko" ? "경제 캘린더" : "Events"}</span>
            </div>
            <SideEvents />
          </div>
        </div>

        {/* ══ 단축 메뉴 ════════════════════════════════════════════ */}
        <div className={styles.shortcuts}>
          {shortcuts.map(({ href, ko, en }) => (
            <Link key={href} href={href} className={styles.shortcutBtn}>
              {language === "ko" ? ko : en}
            </Link>
          ))}
        </div>

      </div>
    </main>
  );
}
