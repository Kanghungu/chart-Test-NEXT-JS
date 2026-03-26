"use client";

import styles from "@/app/layout.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export default function FooterBar() {
  const { language } = useLanguage();

  return (
    <footer className={styles.footer}>
      {language === "ko"
        ? "Market Pulse Korea · 실시간 가격, 뉴스, 시그널을 한 화면에서"
        : "Market Pulse Korea · Real-time prices, news, and signals in one view"}
    </footer>
  );
}
