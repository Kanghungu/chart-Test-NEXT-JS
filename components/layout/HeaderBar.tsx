"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
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
      { href: "/crypto",  label: "크립토" },
      { href: "/briefing", label: "브리핑" },
    ],
    newsDropdown: {
      label: "뉴스",
      items: [
        { href: "/stock-news", label: "미국주식 뉴스" },
        { href: "/korea-news", label: "한국주식 뉴스" },
      ],
    },
    description: "실시간 가격, 뉴스, 시그널을 한 화면에서",
    live: "LIVE",
    navigationLabel: "주요 메뉴",
  },
  en: {
    nav: [
      { href: "/", label: "Home" },
      { href: "/chart", label: "Chart" },
      { href: "/calendar", label: "Calendar" },
      { href: "/watchlist", label: "Watchlist" },
      { href: "/signals", label: "Signals" },
      { href: "/crypto",  label: "Crypto" },
      { href: "/briefing", label: "Briefing" },
    ],
    newsDropdown: {
      label: "News",
      items: [
        { href: "/stock-news", label: "US Stock News" },
        { href: "/korea-news", label: "Korean Stock News" },
      ],
    },
    description: "Real-time prices, news, and market signals",
    live: "LIVE",
    navigationLabel: "Main navigation",
  },
} as const;

export default function HeaderBar() {
  const { language, setLanguage } = useLanguage();
  const copy = COPY[language];
  const [newsOpen, setNewsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setNewsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <div className={styles.brand}>
          <Link href="/" className={styles.brandLink}>
            Market Pulse Korea
          </Link>
          <p className={styles.brandDescription}>{copy.description}</p>
        </div>

        <nav className={styles.nav} aria-label={copy.navigationLabel}>
          {copy.nav.map((item) => (
            <Link key={item.href} href={item.href} className={styles.navLink}>
              {item.label}
            </Link>
          ))}

          {/* News dropdown */}
          <div className={styles.navDropdown} ref={dropdownRef}>
            <button
              type="button"
              className={`${styles.navLink} ${styles.navDropdownTrigger} ${newsOpen ? styles.navDropdownOpen : ""}`}
              onClick={() => setNewsOpen((v) => !v)}
              aria-expanded={newsOpen}
              aria-haspopup="true"
            >
              {copy.newsDropdown.label}
              <svg
                className={styles.navDropdownArrow}
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                aria-hidden="true"
              >
                <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {newsOpen && (
              <div className={styles.navDropdownMenu}>
                {copy.newsDropdown.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={styles.navDropdownItem}
                    onClick={() => setNewsOpen(false)}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

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

          <span className={styles.liveBadge}>
            <span className={styles.liveDot} aria-hidden="true" />
            {copy.live}
          </span>
        </nav>
      </div>
    </header>
  );
}
