"use client";

import { useEffect, useState } from "react";
import styles from "./SideEvents.module.css";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import {
  getLocalizedEventCountry,
  getLocalizedEventTitle,
  getLocalizedImpact
} from "@/lib/marketLocalization";

export default function SideEvents() {
  const { language } = useLanguage();
  const [items, setItems] = useState([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await fetch("/api/market/events", { cache: "no-store" });
        const json = await res.json();
        if (mounted) {
          setItems(Array.isArray(json?.items) ? json.items : []);
        }
      } catch {
        if (mounted) {
          setItems([]);
        }
      }
    };

    load();
    const timer = setInterval(load, 5 * 60 * 1000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <section className={styles.panel}>
      <h3 className={styles.title}>{language === "ko" ? "경제 일정" : "Economic Events"}</h3>
      <div className={styles.list}>
        {items.map((item, idx) => (
          <div key={`${item.time}-${item.title}-${idx}`} className={styles.card}>
            <div className={styles.topRow}>
              <span className={styles.country}>{getLocalizedEventCountry(item, language)}</span>
              <span className={styles.impact}>{getLocalizedImpact(item, language)}</span>
            </div>
            <p className={styles.eventTitle}>{getLocalizedEventTitle(item, language)}</p>
            <p className={styles.time}>{item.time}</p>
          </div>
        ))}
        {!items.length ? (
          <p className={styles.empty}>
            {language === "ko" ? "일정을 불러오는 중입니다..." : "Loading events..."}
          </p>
        ) : null}
      </div>
    </section>
  );
}
