import styles from "./MarketOverview.module.css";
import { AssetItem, SnapshotData } from "./marketTypes";
import { COPY, DEFAULT_ASSETS, formatMoney, formatPercent } from "./marketUtils";

interface MarketSummaryCardsProps {
  snapshot: SnapshotData;
}

export default function MarketSummaryCards({ snapshot }: MarketSummaryCardsProps) {
  const assets = snapshot.assets || DEFAULT_ASSETS;

  return (
    <>
      <div className={styles.assetGrid}>
        {assets.map((asset) => {
          const hasChange = typeof asset.changePercent === "number";
          const up = hasChange && asset.changePercent >= 0;

          return (
            <div key={asset.symbol} className={styles.assetCard}>
              <p className={styles.assetSymbol}>{asset.symbol}</p>
              <p className={styles.assetPrice}>{formatMoney(asset.price, asset.currency || "USD")}</p>
              <p className={`${styles.assetChange} ${hasChange ? (up ? styles.positive : styles.negative) : styles.muted}`}>
                {formatPercent(asset.changePercent)}
              </p>
            </div>
          );
        })}
      </div>

      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>{COPY.fearGreed}</p>
          <p className={styles.metricValue}>
            {snapshot.fearGreed ? `${snapshot.fearGreed.value} (${snapshot.fearGreed.classification})` : "-"}
          </p>
        </div>

        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>{COPY.volume}</p>
          <p className={styles.metricValue}>{formatMoney(snapshot.cryptoVolumeUsd, "USD")}</p>
        </div>
      </div>
    </>
  );
}
