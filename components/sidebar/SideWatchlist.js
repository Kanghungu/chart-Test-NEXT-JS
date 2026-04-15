"use client";

import { useEffect, useState } from "react";
import styles from "./SideWatchlist.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { getLocalizedAssetName } from "@/lib/marketLocalization";

function formatPrice(value, currency) {
  if (typeof value !== "number") return "-";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: value < 1 ? 4 : 2,
    maximumFractionDigits: value < 1 ? 4 : 2
  }).format(value);
}

function formatChange(value) {
  if (typeof value !== "number") return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export default function SideWatchlist() {
  const { language } = useLanguage();
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

  const koreanStocks = items.filter((item) => item.group === "korea");
  const usStocks = items.filter((item) => item.group === "stock");

  return (
    <section className={styles.panel}>
      <h3 className={styles.title}>{language === "ko" ? "관심 자산" : "Watchlist"}</h3>

      <div className={styles.group}>
        <p className={styles.groupLabel}>{language === "ko" ? "한국주식" : "KOREAN STOCKS"}</p>
        <div className={styles.list}>
          {koreanStocks.map((item) => {
            const up = typeof item.changePercent === "number" && item.changePercent >= 0;
            return (
              <div key={item.symbol} className={styles.row}>
                <div>
                  <p className={styles.name}>{getLocalizedAssetName(item, language)}</p>
                  <p className={styles.symbol}>{item.symbol}</p>
                </div>
                <div className={styles.valueBox}>
                  <p className={styles.price}>{formatPrice(item.price, "KRW")}</p>
                  <p className={`${styles.change} ${up ? styles.up : styles.down}`}>{formatChange(item.changePercent)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.group}>
        <p className={styles.groupLabel}>{language === "ko" ? "미국주식" : "US STOCKS"}</p>
        <div className={styles.list}>
          {usStocks.map((item) => {
            const up = typeof item.changePercent === "number" && item.changePercent >= 0;
            return (
              <div key={item.symbol} className={styles.row}>
                <div>
                  <p className={styles.name}>{getLocalizedAssetName(item, language)}</p>
                  <p className={styles.symbol}>{item.symbol}</p>
                </div>
                <div className={styles.valueBox}>
                  <p className={styles.price}>{formatPrice(item.price, "USD")}</p>
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
