"use client";

import React from "react";
import styles from "./NewsTitle.module.css";

export default function NewsTitle() {
  return (
    <div className={styles.wrapper}>
      <div className={`${styles.card} ${styles.cryptoCard}`}>
        <h2 className={`${styles.title} ${styles.cryptoTitle}`}>코인 뉴스</h2>
        <a href="/crypto-news" className={`${styles.link} ${styles.cryptoLink}`}>
          전체보기
        </a>
      </div>
      <div className={`${styles.card} ${styles.stockCard}`}>
        <h2 className={`${styles.title} ${styles.stockTitle}`}>주식 뉴스</h2>
        <a href="/stock-news" className={`${styles.link} ${styles.stockLink}`}>
          전체보기
        </a>
      </div>
    </div>
  );
}

