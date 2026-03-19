import styles from "./MarketOverview.module.css";
import { TickerItem } from "./marketTypes";
import { formatMoney, formatPercent } from "./marketUtils";

interface MarketTickerProps {
  items: TickerItem[];
  label: string;
}

export default function MarketTicker({ items, label }: MarketTickerProps) {
  const tape = items.length ? [...items, ...items] : [];

  return (
    <div className={styles.tickerSection}>
      <div className={styles.tickerHeader}>
        <div className={styles.liveInfo}>
          <span className={styles.liveDotWrap}>
            <span className={styles.liveDotPing} />
            <span className={styles.liveDot} />
          </span>
          <p className={styles.liveLabel}>{label}</p>
        </div>

        <span className={styles.liveBadge}>LIVE</span>
      </div>

      <div className={styles.tickerFrame}>
        <div className={styles.tapeWrap}>
          <div className={styles.tapeTrack}>
            {tape.map((item, idx) => {
              const hasChange = typeof item.changePercent === "number";
              const up = hasChange && item.changePercent >= 0;

              return (
                <article key={`${item.symbol}-${idx}`} className={styles.tapeCard}>
                  <p className={styles.tapeName}>{item.name || item.symbol}</p>
                  <p className={styles.tapePrice}>{formatMoney(item.price, "USD")}</p>
                  <p className={`${styles.tapeChange} ${hasChange ? (up ? styles.positive : styles.negative) : ""}`}>
                    {formatPercent(item.changePercent)}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </div>

      <div className={styles.fadeLeft} />
      <div className={styles.fadeRight} />
    </div>
  );
}
