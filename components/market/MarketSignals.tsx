import styles from "./MarketOverview.module.css";

interface MarketSignalsProps {
  signals: string[];
  title: string;
}

export default function MarketSignals({ signals, title }: MarketSignalsProps) {
  return (
    <div className={styles.signalPanel}>
      <p className={styles.signalTitle}>{title}</p>
      <ul className={styles.signalList}>
        {signals.map((signal, idx) => (
          <li key={`${signal}-${idx}`} className={styles.signalItem}>
            {signal}
          </li>
        ))}
      </ul>
    </div>
  );
}
