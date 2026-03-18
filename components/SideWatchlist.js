"use client";

import { useEffect, useState } from "react";
import styles from "./SideWatchlist.module.css";

function formatPrice(v) {
  if (typeof v !== "number") return "-";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: v < 1 ? 4 : 2,
    maximumFractionDigits: v < 1 ? 4 : 2
  }).format(v);
}

function formatChange(v) {
  if (typeof v !== "number") return "-";
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(2)}%`;
}

export default function SideWatchlist() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await fetch("/api/market/watchlist", { cache: "no-store" });
        const json = await res.json();
        if (mounted) {
          setItems(Array.isArray(json?.items) ? json.items : []);
        }
      } catch {
        if (mounted) setItems([]);
      }
    };

    load();
    const timer = setInterval(load, 60000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const crypto = items.filter((i) => i.group === "crypto");
  const stocks = items.filter((i) => i.group === "stock");

  return (
    <section className={styles.panel}>
      <h3 className={styles.title}>관심 자산</h3>

      <div className={styles.group}>
        <p className={styles.groupLabel}>CRYPTO</p>
        <div className={styles.list}>
          {crypto.map((item) => {
            const up = typeof item.changePercent === "number" && item.changePercent >= 0;
            return (
              <div key={item.symbol} className={styles.row}>
                <div>
                  <p className={styles.name}>{item.name}</p>
                  <p className={styles.symbol}>{item.symbol}</p>
                </div>
                <div className={styles.valueBox}>
                  <p className={styles.price}>${formatPrice(item.price)}</p>
                  <p className={`${styles.change} ${up ? styles.up : styles.down}`}>{formatChange(item.changePercent)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.group}>
        <p className={styles.groupLabel}>US STOCKS</p>
        <div className={styles.list}>
          {stocks.map((item) => {
            const up = typeof item.changePercent === "number" && item.changePercent >= 0;
            return (
              <div key={item.symbol} className={styles.row}>
                <div>
                  <p className={styles.name}>{item.name}</p>
                  <p className={styles.symbol}>{item.symbol}</p>
                </div>
                <div className={styles.valueBox}>
                  <p className={styles.price}>${formatPrice(item.price)}</p>
                  <p className={`${styles.change} ${up ? styles.up : styles.down}`}>{formatChange(item.changePercent)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

