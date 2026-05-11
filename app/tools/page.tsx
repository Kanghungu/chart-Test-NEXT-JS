"use client";
import { useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import PositionCalc  from "@/components/tools/PositionCalc";
import KimpMonitor   from "@/components/tools/KimpMonitor";
import EtfFlow       from "@/components/tools/EtfFlow";
import SectorMap     from "@/components/tools/SectorMap";
import Correlation   from "@/components/tools/Correlation";
import styles        from "./tools.module.css";

type Tab = "calc" | "kimp" | "etf" | "sector" | "corr";

const TABS: { key: Tab; icon: string; ko: string; en: string }[] = [
  { key: "calc",   icon: "📐", ko: "포지션 계산기",   en: "Position Calc" },
  { key: "kimp",   icon: "🇰🇷", ko: "김프 모니터",    en: "Kimp Monitor" },
  { key: "etf",    icon: "🏦", ko: "ETF 자금 흐름",  en: "ETF Flow" },
  { key: "sector", icon: "🌐", ko: "섹터 히트맵",    en: "Sector Map" },
  { key: "corr",   icon: "📈", ko: "자산 상관관계",  en: "Correlation" },
];

export default function ToolsPage() {
  const { language } = useLanguage();
  const [tab, setTab] = useState<Tab>("calc");

  return (
    <main className={styles.page}>
      {/* 홀로그램 오브 장식 */}
      <div className={styles.orb1} />
      <div className={styles.orb2} />
      <div className={styles.orb3} />

      <div className={styles.inner}>
        {/* Hero */}
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>TRADING TOOLS · 트레이딩 도구</p>
            <h1 className={styles.heroTitle}>
              {language === "ko" ? "트레이딩 분석 센터" : "Trading Analytics Center"}
            </h1>
            <p className={styles.heroSub}>
              {language === "ko"
                ? "포지션 계산 · 김프 모니터 · ETF 기관 수요 · 섹터 히트맵 · 자산 상관관계"
                : "Position sizing · Kimp · ETF institutional demand · Sector heatmap · Asset correlation"}
            </p>
          </div>
        </header>

        {/* 탭바 */}
        <nav className={styles.tabBar}>
          {TABS.map(t => (
            <button
              key={t.key}
              className={`${styles.tabBtn} ${tab === t.key ? styles.tabBtnActive : ""}`}
              onClick={() => setTab(t.key)}
            >
              <span>{t.icon}</span>
              <span>{language === "ko" ? t.ko : t.en}</span>
            </button>
          ))}
        </nav>

        {/* 탭 콘텐츠 */}
        <div className={styles.content}>
          {tab === "calc"   && <PositionCalc />}
          {tab === "kimp"   && <KimpMonitor />}
          {tab === "etf"    && <EtfFlow />}
          {tab === "sector" && <SectorMap />}
          {tab === "corr"   && <Correlation />}
        </div>
      </div>
    </main>
  );
}
