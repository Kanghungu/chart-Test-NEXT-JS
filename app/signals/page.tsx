"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/components/discover/DiscoverPage.module.css";
import sStyles from "./signals.module.css";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type AssetItem = {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  currency?: string;
};

type SnapshotData = {
  assets: AssetItem[];
  fearGreed: { value: number; classification: string } | null;
  koreaTradingValue: number | null;
};

type MacroQuote = { price: number | null; changePercent: number | null };
type MacroData  = { dxy: MacroQuote; usdkrw: MacroQuote; gold: MacroQuote; oil: MacroQuote };

const COPY = {
  ko: {
    eyebrow: "SIGNAL BOARD", title: "시장 시그널 센터",
    description: "지수 변화, 시장 심리, 대표 한국주식 거래대금을 묶어 오늘의 시그널을 보여줍니다.",
    signalCount: "시그널 수", fearGreed: "시장 심리", volume: "대표 한국주식 거래대금",
    generatedSignals: "생성된 시그널", autoSummary: "자동 요약",
    assetCheck: "자산 체크", snapshot: "스냅샷",
    positive: "긍정", caution: "주의", neutral: "중립",
    noSignal: "아직 강한 시그널이 없습니다.",
    fearGaugeTitle: "공포·탐욕 지수",
    fearGaugeLevels: ["극단 공포", "공포", "중립", "탐욕", "극단 탐욕"],
    fearGaugeHint: "0 = 극단 공포 · 100 = 극단 탐욕",
    macroTitle: "글로벌 매크로",
    macroHint: "달러·환율·금·원유 실시간",
    dxy: "달러인덱스 (DXY)", usdkrw: "원/달러 환율", gold: "금 (XAU/USD)", oil: "WTI 원유",
    breadthTitle: "시장 너비",
    breadthHint: "상승/하락 종목 비율",
    breadthUp: "상승", breadthDown: "하락",
  },
  en: {
    eyebrow: "SIGNAL BOARD", title: "Market signal center",
    description: "Combine index moves, sentiment, and Korean trading value into actionable signals.",
    signalCount: "Signal count", fearGreed: "Market Sentiment", volume: "Korean Leader Trading Value",
    generatedSignals: "Generated signals", autoSummary: "Auto summary",
    assetCheck: "Asset check", snapshot: "snapshot",
    positive: "Positive", caution: "Caution", neutral: "Neutral",
    noSignal: "No strong signal yet.",
    fearGaugeTitle: "Fear & Greed Index",
    fearGaugeLevels: ["Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"],
    fearGaugeHint: "0 = Extreme Fear · 100 = Extreme Greed",
    macroTitle: "Global Macro",
    macroHint: "Dollar · FX · Gold · Oil live",
    dxy: "Dollar Index (DXY)", usdkrw: "USD/KRW", gold: "Gold (XAU/USD)", oil: "WTI Crude",
    breadthTitle: "Market Breadth",
    breadthHint: "Advancing vs declining ratio",
    breadthUp: "Up", breadthDown: "Down",
  },
} as const;

// 공포탐욕 색상
function fgColor(val: number): string {
  if (val <= 20) return "#f87171";
  if (val <= 40) return "#fb923c";
  if (val <= 60) return "#fbbf24";
  if (val <= 80) return "#4ade80";
  return "#22c55e";
}

function fgLabel(val: number, levels: readonly string[]): string {
  if (val <= 20) return levels[0];
  if (val <= 40) return levels[1];
  if (val <= 60) return levels[2];
  if (val <= 80) return levels[3];
  return levels[4];
}

// 매크로 데이터 — 서버 프록시 사용 (CORS 우회)
async function fetchMacro(): Promise<MacroData> {
  const empty = { price: null, changePercent: null };
  try {
    const res = await fetch("/api/macro/quotes", { cache: "no-store" });
    if (!res.ok) throw new Error();
    const d = await res.json();
    return {
      dxy:    d.dxy    ?? empty,
      usdkrw: d.usdkrw ?? empty,
      gold:   d.gold   ?? empty,
      oil:    d.oil    ?? empty,
    };
  } catch {
    return { dxy: empty, usdkrw: empty, gold: empty, oil: empty };
  }
}

export default function SignalsPage() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const [snapshot, setSnapshot] = useState<SnapshotData>({ assets: [], fearGreed: null, koreaTradingValue: null });
  const [macro, setMacro] = useState<MacroData>({ dxy: { price: null, changePercent: null }, usdkrw: { price: null, changePercent: null }, gold: { price: null, changePercent: null }, oil: { price: null, changePercent: null } });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/market/snapshot", { cache: "no-store" });
        const json = await res.json();
        if (!mounted) return;
        setSnapshot({ assets: Array.isArray(json?.assets) ? json.assets : [], fearGreed: json?.fearGreed ?? null, koreaTradingValue: json?.koreaTradingValue ?? null });
      } catch { if (!mounted) return; setSnapshot({ assets: [], fearGreed: null, koreaTradingValue: null }); }
    };
    load();
    const t = setInterval(load, 60000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetchMacro().then(d => { if (mounted) setMacro(d); });
    const t = setInterval(() => fetchMacro().then(d => { if (mounted) setMacro(d); }), 60000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  const signals = useMemo(() => {
    const list: Array<{ title: string; summary: string; tone: "up" | "down" | "neutral" }> = [];
    snapshot.assets.forEach((asset) => {
      if (typeof asset.changePercent !== "number") return;
      if (asset.changePercent >= 2) {
        list.push({ title: language === "ko" ? `${asset.symbol} 상승 모멘텀` : `${asset.symbol} upside momentum`, summary: language === "ko" ? `${formatPercent(asset.changePercent)} 상승으로 단기 강세 신호.` : `${formatPercent(asset.changePercent)} suggests short-term upside.`, tone: "up" });
      } else if (asset.changePercent <= -2) {
        list.push({ title: language === "ko" ? `${asset.symbol} 하락 압력` : `${asset.symbol} downside pressure`, summary: language === "ko" ? `${formatPercent(asset.changePercent)} 움직임으로 변동성 주의.` : `${formatPercent(asset.changePercent)} signals a fragile setup.`, tone: "down" });
      }
    });
    if ((snapshot.fearGreed?.value ?? 0) >= 70) list.push({ title: language === "ko" ? "심리 과열 구간" : "Greed zone", summary: language === "ko" ? `지수 ${snapshot.fearGreed?.value}로 단기 과열 점검 필요.` : `At ${snapshot.fearGreed?.value}, short-term overheat possible.`, tone: "neutral" });
    if ((snapshot.fearGreed?.value ?? 100) <= 30) list.push({ title: language === "ko" ? "심리 공포 구간" : "Fear zone check", summary: language === "ko" ? `지수 ${snapshot.fearGreed?.value}로 방어적 해석 필요.` : `At ${snapshot.fearGreed?.value}, defensive read may apply.`, tone: "down" });
    return list.slice(0, 8);
  }, [language, snapshot]);

  const fgVal  = snapshot.fearGreed?.value ?? 0;
  const fgAngle = (fgVal / 100) * 180 - 90; // -90 ~ +90deg

  const macroItems = [
    { label: copy.dxy,    q: macro.dxy,    icon: "💵", fmt: (p: number) => p.toFixed(2) },
    { label: copy.usdkrw, q: macro.usdkrw, icon: "₩",  fmt: (p: number) => p.toLocaleString("ko-KR", { maximumFractionDigits: 0 }) },
    { label: copy.gold,   q: macro.gold,   icon: "🥇", fmt: (p: number) => `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}` },
    { label: copy.oil,    q: macro.oil,    icon: "🛢️", fmt: (p: number) => `$${p.toFixed(2)}` },
  ];

  // 시장너비 계산 (assets 기반 간이)
  const upCount   = snapshot.assets.filter(a => (a.changePercent ?? 0) > 0).length;
  const downCount = snapshot.assets.filter(a => (a.changePercent ?? 0) < 0).length;
  const totalCount = upCount + downCount;
  const upPct = totalCount > 0 ? (upCount / totalCount) * 100 : 50;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 className={styles.title}>{copy.title}</h1>
            <p className={styles.description}>{copy.description}</p>
          </div>
          <div className={styles.heroStats}>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.signalCount}</p>
              <p className={styles.statValue}>{signals.length}</p>
              <p className={styles.statHint}>{copy.generatedSignals}</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.fearGreed}</p>
              <p className={styles.statValue} style={{ color: snapshot.fearGreed ? fgColor(fgVal) : undefined }}>
                {snapshot.fearGreed?.value ?? "-"}
              </p>
              <p className={styles.statHint}>{snapshot.fearGreed?.classification || "-"}</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.volume}</p>
              <p className={styles.statValue}>{formatCurrency(snapshot.koreaTradingValue, "KRW")}</p>
              <p className={styles.statHint}>{copy.snapshot}</p>
            </article>
          </div>
        </section>

        {/* 공포탐욕 게이지 + 매크로 */}
        <section className={sStyles.dashRow}>
          {/* 공포탐욕 게이지 */}
          <article className={`${styles.panel} ${sStyles.gaugePanel}`}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{copy.fearGaugeTitle}</h2>
              <span className={styles.panelCaption}>{copy.fearGaugeLevels[
                fgVal <= 20 ? 0 : fgVal <= 40 ? 1 : fgVal <= 60 ? 2 : fgVal <= 80 ? 3 : 4
              ]}</span>
            </div>
            {snapshot.fearGreed ? (
              <div className={sStyles.gaugeWrap}>
                {/* 반원 SVG 게이지 */}
                <svg viewBox="0 0 200 110" className={sStyles.gaugeSvg}>
                  {/* 배경 반원 */}
                  <path d="M 10 100 A 90 90 0 0 1 190 100" stroke="rgba(51,65,85,0.5)" strokeWidth="18" fill="none" strokeLinecap="round" />
                  {/* 컬러 반원 */}
                  <path d="M 10 100 A 90 90 0 0 1 190 100"
                    stroke={`url(#fg-grad)`} strokeWidth="18" fill="none" strokeLinecap="round"
                    strokeDasharray={`${fgVal * 2.83} 283`} />
                  <defs>
                    <linearGradient id="fg-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%"   stopColor="#f87171" />
                      <stop offset="25%"  stopColor="#fb923c" />
                      <stop offset="50%"  stopColor="#fbbf24" />
                      <stop offset="75%"  stopColor="#4ade80" />
                      <stop offset="100%" stopColor="#22c55e" />
                    </linearGradient>
                  </defs>
                  {/* 바늘 */}
                  <line
                    x1="100" y1="100"
                    x2={100 + 70 * Math.cos((fgAngle - 90) * Math.PI / 180)}
                    y2={100 + 70 * Math.sin((fgAngle - 90) * Math.PI / 180)}
                    stroke="#f8fafc" strokeWidth="2.5" strokeLinecap="round"
                  />
                  <circle cx="100" cy="100" r="5" fill="#f8fafc" />
                  {/* 값 텍스트 */}
                  <text x="100" y="85" textAnchor="middle" fontSize="22" fontWeight="bold" fill={fgColor(fgVal)}>{fgVal}</text>
                </svg>
                <p className={sStyles.gaugeLabel} style={{ color: fgColor(fgVal) }}>
                  {fgLabel(fgVal, copy.fearGaugeLevels)}
                </p>
                <p className={sStyles.gaugeHint}>{copy.fearGaugeHint}</p>
                {/* 눈금 레이블 */}
                <div className={sStyles.gaugeTicks}>
                  {["0", "25", "50", "75", "100"].map(t => (
                    <span key={t}>{t}</span>
                  ))}
                </div>
              </div>
            ) : (
              <p className={styles.emptyState}>-</p>
            )}
          </article>

          {/* 글로벌 매크로 */}
          <article className={`${styles.panel} ${sStyles.macroPanel}`}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{copy.macroTitle}</h2>
              <span className={styles.panelCaption}>{copy.macroHint}</span>
            </div>
            <div className={sStyles.macroGrid}>
              {macroItems.map(({ label, q, icon, fmt }) => (
                <div key={label} className={sStyles.macroCell}>
                  <span className={sStyles.macroIcon}>{icon}</span>
                  <div className={sStyles.macroInfo}>
                    <p className={sStyles.macroLabel}>{label}</p>
                    <p className={sStyles.macroPrice}>
                      {q.price !== null && isFinite(q.price) ? fmt(q.price) : "—"}
                    </p>
                    {q.changePercent !== null && isFinite(q.changePercent) && (
                      <p className={q.changePercent >= 0 ? sStyles.macroUp : sStyles.macroDn}>
                        {q.changePercent >= 0 ? "+" : ""}{q.changePercent.toFixed(2)}%
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* 시장 너비 */}
          <article className={`${styles.panel} ${sStyles.breadthPanel}`}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{copy.breadthTitle}</h2>
              <span className={styles.panelCaption}>{copy.breadthHint}</span>
            </div>
            <div className={sStyles.breadthWrap}>
              <div className={sStyles.breadthBar}>
                <div className={sStyles.breadthUp}   style={{ width: `${upPct}%` }} />
                <div className={sStyles.breadthDown} style={{ width: `${100 - upPct}%` }} />
              </div>
              <div className={sStyles.breadthLabels}>
                <span style={{ color: "#4ade80" }}>▲ {copy.breadthUp} {upCount}</span>
                <span style={{ color: "#f87171" }}>▼ {copy.breadthDown} {downCount}</span>
              </div>
              <div className={sStyles.breadthPcts}>
                <span style={{ color: "#4ade80" }}>{upPct.toFixed(0)}%</span>
                <span style={{ color: "#f87171" }}>{(100 - upPct).toFixed(0)}%</span>
              </div>
            </div>
          </article>
        </section>

        {/* 시그널 + 자산 */}
        <section className={styles.masonry}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{copy.generatedSignals}</h2>
              <span className={styles.panelCaption}>{copy.autoSummary}</span>
            </div>
            <div className={styles.stack}>
              {signals.map((signal) => (
                <div key={signal.title} className={styles.listCard}>
                  <div className={styles.panelHeader}>
                    <p className={styles.itemTitle}>{signal.title}</p>
                    <span className={signal.tone === "up" ? styles.upBadge : signal.tone === "down" ? styles.downBadge : styles.neutralBadge}>
                      {signal.tone === "up" ? copy.positive : signal.tone === "down" ? copy.caution : copy.neutral}
                    </span>
                  </div>
                  <p className={styles.itemMeta}>{signal.summary}</p>
                </div>
              ))}
              {!signals.length && <p className={styles.emptyState}>{copy.noSignal}</p>}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{copy.assetCheck}</h2>
              <span className={styles.pill}>{copy.snapshot}</span>
            </div>
            <div className={styles.stack}>
              {snapshot.assets.map((asset) => (
                <div key={asset.symbol} className={styles.listCard}>
                  <div className={styles.itemRow}>
                    <div>
                      <p className={styles.itemTitle}>{asset.symbol}</p>
                      <p className={styles.itemMeta}>{formatCurrency(asset.price, asset.currency || "USD")}</p>
                    </div>
                    <span className={typeof asset.changePercent === "number" ? asset.changePercent >= 0 ? styles.upBadge : styles.downBadge : styles.neutralBadge}>
                      {formatPercent(asset.changePercent)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
