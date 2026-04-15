import styles from "./MarketOverview.module.css";
import { SnapshotData } from "./marketTypes";
import { formatMacroQuotePrice } from "@/lib/formatters";
import {
  DEFAULT_ASSETS,
  formatMoney,
  formatPercent,
  getLocalizedSentimentLabel,
  getMacroQuoteLabel,
  getMarketCopy,
  getRiskStripLabels
} from "./marketUtils";
import { useLanguage } from "@/components/i18n/LanguageProvider";

interface MarketSummaryCardsProps {
  snapshot: SnapshotData;
}

export default function MarketSummaryCards({ snapshot }: MarketSummaryCardsProps) {
  const { language } = useLanguage();
  const copy = getMarketCopy(language);
  const assets = snapshot.assets || DEFAULT_ASSETS;
  const koreaFearGreed = snapshot.koreaFearGreed ?? snapshot.fearGreed ?? null;
  const stockFearGreed = snapshot.stockFearGreed ?? null;
  const koreaTradingValue = snapshot.koreaTradingValue ?? null;
  const macroRail = snapshot.macroRail?.length ? snapshot.macroRail : [];
  const sessionRisk = snapshot.sessionRisk;
  const riskLabels = getRiskStripLabels(language);
  const localeTag = language === "ko" ? "ko-KR" : "en-US";
  const macroHasPrice = macroRail.some((item) => typeof item.price === "number");
  const riskHasPrice =
    sessionRisk &&
    [sessionRisk.vix?.price, sessionRisk.esFuture?.price, sessionRisk.nqFuture?.price].some(
      (priceValue) => typeof priceValue === "number"
    );

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

      {macroRail.length && macroHasPrice ? (
        <div className={styles.macroSection}>
          <p className={styles.sectionEyebrow}>{copy.macroRailTitle}</p>
          <div className={styles.macroRailGrid}>
            {macroRail.map((item) => {
              const hasChange = typeof item.changePercent === "number";
              const up = hasChange && item.changePercent >= 0;

              return (
                <div key={item.id} className={styles.macroCard}>
                  <p className={styles.assetSymbol}>{getMacroQuoteLabel(item.id, language)}</p>
                  <p className={styles.assetPrice}>
                    {formatMacroQuotePrice(item.displayUnit, item.price, localeTag)}
                  </p>
                  <p
                    className={`${styles.assetChange} ${hasChange ? (up ? styles.positive : styles.negative) : styles.muted}`}
                  >
                    {formatPercent(item.changePercent)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {sessionRisk && riskHasPrice ? (
        <div className={styles.riskStripSection}>
          <p className={styles.sectionEyebrow}>{copy.riskStripTitle}</p>
          <div className={styles.riskStripGrid}>
            {[
              { key: "vix", label: riskLabels.vix, row: sessionRisk.vix },
              { key: "es", label: riskLabels.es, row: sessionRisk.esFuture },
              { key: "nq", label: riskLabels.nq, row: sessionRisk.nqFuture }
            ].map(({ key, label, row }) => {
              const hasChange = typeof row?.changePercent === "number";
              const up = hasChange && row.changePercent >= 0;

              return (
                <div key={key} className={styles.macroCard}>
                  <p className={styles.assetSymbol}>{label}</p>
                  <p className={styles.assetPrice}>
                    {typeof row?.price === "number"
                      ? row.price.toLocaleString(localeTag, { maximumFractionDigits: 2 })
                      : "-"}
                  </p>
                  <p
                    className={`${styles.assetChange} ${hasChange ? (up ? styles.positive : styles.negative) : styles.muted}`}
                  >
                    {formatPercent(row?.changePercent ?? null)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>{copy.koreaFearGreed || copy.fearGreed}</p>
          <p className={styles.metricValue}>
            {koreaFearGreed
              ? `${koreaFearGreed.value} (${getLocalizedSentimentLabel(koreaFearGreed.classification, language)})`
              : "-"}
          </p>
        </div>

        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>{copy.stockFearGreed}</p>
          <p className={styles.metricValue}>
            {stockFearGreed
              ? `${stockFearGreed.value} (${getLocalizedSentimentLabel(stockFearGreed.classification, language)})`
              : "-"}
          </p>
        </div>

        <div className={styles.metricCard}>
          <p className={styles.metricLabel}>{copy.volume}</p>
          <p className={styles.metricValue}>{formatMoney(koreaTradingValue, "KRW")}</p>
        </div>
      </div>
    </>
  );
}
