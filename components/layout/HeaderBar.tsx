"use client";

import Link from "next/link";
import styles from "@/app/layout.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const COPY = {
  ko: {
    nav: [
      { href: "/", label: "홈" },
      { href: "/chart", label: "차트" },
      { href: "/calendar", label: "캘린더" },
      { href: "/watchlist", label: "워치리스트" },
      { href: "/signals", label: "시그널" },
      { href: "/briefing", label: "브리핑" },
      { href: "/stock-news", label: "미국주식뉴스" },
      { href: "/crypto-news", label: "한국주식뉴스" }
    ],
    description: "실시간 주가, 뉴스, 시그널 대시보드",
    live: "LIVE"
  },
  en: {
    nav: [
      { href: "/", label: "Home" },
      { href: "/chart", label: "Chart" },
      { href: "/calendar", label: "Calendar" },
      { href: "/watchlist", label: "Watchlist" },
      { href: "/signals", label: "Signals" },
      { href: "/briefing", label: "Briefing" },
      { href: "/stock-news", label: "US Stock News" },
      { href: "/crypto-news", label: "Korean Stock News" }
    ],
    description: "Real-time prices, news, and market signals",
    live: "LIVE"
  }
} as const;

export default function HeaderBar() {
  const { language, setLanguage } = useLanguage();
  const copy = COPY[language];

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <Link href="/" className={styles.brandLink}>
              Market Pulse Korea
            </Link>
            <p className={styles.brandDescription}>{copy.description}</p>
          </div>

          <nav className={styles.nav} aria-label={language === "ko" ? "주요 메뉴" : "Main navigation"}>
            {copy.nav.map((item) => (
              <Link key={item.href} href={item.href} className={styles.navLink}>
                {item.label}
              </Link>
            ))}

            <div className={styles.languageToggle} role="group" aria-label="Language toggle">
              <button
                type="button"
                className={language === "ko" ? styles.languageButtonActive : styles.languageButton}
                onClick={() => setLanguage("ko")}
              >
                KO
              </button>
              <button
                type="button"
                className={language === "en" ? styles.languageButtonActive : styles.languageButton}
                onClick={() => setLanguage("en")}
              >
                EN
              </button>
            </div>

            <span className={styles.liveBadge}>{copy.live}</span>
          </nav>
        </div>
      </header>
    </>
  );
}
