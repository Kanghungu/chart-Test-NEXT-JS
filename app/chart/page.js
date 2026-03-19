"use client";

import TradingViewChart from "@/components/chart/TradingViewChart";
import styles from "./page.module.css";

const PAGE_TITLE = "\uAC00\uB85C 3\uC5F4 \uCC28\uD2B8";

export default function ChartsPage() {
  const symbols = ["BINANCE:BTCUSDT", "BINANCE:ETHUSDT", "BINANCE:XRPUSDT"];

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>{PAGE_TITLE}</h2>
      <div className={styles.grid}>
        {symbols.map((symbol) => (
          <TradingViewChart key={symbol} symbol={symbol} />
        ))}
      </div>
    </div>
  );
}
