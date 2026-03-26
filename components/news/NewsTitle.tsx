"use client";

import Link from "next/link";
import styles from "./NewsTitle.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export default function NewsTitle() {
  const { language } = useLanguage();

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.card} ${styles.cryptoCard}`}>
        <h2 className={`${styles.title} ${styles.cryptoTitle}`}>
          {language === "ko" ? "코인 뉴스" : "Crypto News"}
        </h2>
        <Link href="/crypto-news" className={`${styles.link} ${styles.cryptoLink}`}>
          {language === "ko" ? "전체보기" : "View all"}
        </Link>
      </div>
      <div className={`${styles.card} ${styles.stockCard}`}>
        <h2 className={`${styles.title} ${styles.stockTitle}`}>
          {language === "ko" ? "주식 뉴스" : "Stock News"}
        </h2>
        <Link href="/stock-news" className={`${styles.link} ${styles.stockLink}`}>
          {language === "ko" ? "전체보기" : "View all"}
        </Link>
      </div>
    </div>
  );
}
