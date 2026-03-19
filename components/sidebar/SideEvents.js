"use client";

import { useEffect, useState } from "react";
import styles from "./SideEvents.module.css";

export default function SideEvents() {
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
      <h3 className={styles.title}>경제 일정</h3>
      <div className={styles.list}>
        {items.map((item, idx) => (
          <div key={`${item.time}-${item.title}-${idx}`} className={styles.card}>
            <div className={styles.topRow}>
              <span className={styles.country}>{item.country}</span>
              <span className={styles.impact}>{item.impact}</span>
            </div>
            <p className={styles.eventTitle}>{item.title}</p>
            <p className={styles.time}>{item.time}</p>
          </div>
        ))}
        {!items.length ? <p className={styles.empty}>일정을 불러오는 중입니다...</p> : null}
      </div>
    </section>
  );
}

