"use client";

import Link from "next/link";
import styles from "./NewsTitle.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export default function NewsTitle() {
  const { language } = useLanguage();

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.card} ${styles.koreaCard}`}>
        <h2 className={`${styles.title} ${styles.koreaTitle}`}>
          {language === "ko" ? "한국주식 뉴스" : "Korean Stock News"}
        </h2>
        <Link href="/korea-news" className={`${styles.link} ${styles.koreaLink}`}>
          {language === "ko" ? "전체보기" : "View all"}
        </Link>
      </div>
      <div className={`${styles.card} ${styles.stockCard}`}>
        <h2 className={`${styles.title} ${styles.stockTitle}`}>
          {language === "ko" ? "미국주식 뉴스" : "US Stock News"}
        </h2>
        <Link href="/stock-news" className={`${styles.link} ${styles.stockLink}`}>
          {language === "ko" ? "전체보기" : "View all"}
        </Link>
      </div>
    </div>
  );
}
