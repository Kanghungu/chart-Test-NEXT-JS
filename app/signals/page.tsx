"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/components/discover/DiscoverPage.module.css";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { useLanguage } from "@/components/i18n/LanguageProvider";

type AssetItem = {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  currency?: string;
};

type SnapshotData = {
  assets: AssetItem[];
  fearGreed: {
    value: number;
    classification: string;
  } | null;
  cryptoVolumeUsd: number | null;
};

const COPY = {
  ko: {
    eyebrow: "시그널 보드",
    title: "시장 시그널 센터",
    description: "지수 변화, 시장 심리, 대표 한국주식 거래대금을 묶어 오늘의 시그널을 보여줍니다.",
    signalCount: "시그널 수",
    fearGreed: "시장 심리",
    volume: "대표 한국주식 거래대금",
    generatedSignals: "생성된 시그널",
    autoSummary: "자동 요약",
    assetCheck: "자산 체크",
    snapshot: "스냅샷",
    positive: "긍정",
    caution: "주의",
    neutral: "중립",
    noSignal: "아직 강한 시그널이 없습니다."
  },
  en: {
    eyebrow: "SIGNAL BOARD",
    title: "Market signal center",
    description: "Combine index moves, sentiment, and Korean trading value into actionable signals.",
    signalCount: "Signal count",
    fearGreed: "Market Sentiment",
    volume: "Korean Leader Trading Value",
    generatedSignals: "Generated signals",
    autoSummary: "Auto summary",
    assetCheck: "Asset check",
    snapshot: "snapshot",
    positive: "Positive",
    caution: "Caution",
    neutral: "Neutral",
    noSignal: "No strong signal yet."
  }
} as const;

export default function SignalsPage() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const [snapshot, setSnapshot] = useState<SnapshotData>({
    assets: [],
    fearGreed: null,
    cryptoVolumeUsd: null
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await fetch("/api/market/snapshot", { cache: "no-store" });
        const json = await res.json();
        if (!mounted) return;
        setSnapshot({
          assets: Array.isArray(json?.assets) ? json.assets : [],
          fearGreed: json?.fearGreed ?? null,
          cryptoVolumeUsd: json?.cryptoVolumeUsd ?? null
        });
      } catch {
        if (!mounted) return;
        setSnapshot({ assets: [], fearGreed: null, cryptoVolumeUsd: null });
      }
    };

    load();
    const timer = setInterval(load, 60000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const signals = useMemo(() => {
    const list: Array<{ title: string; summary: string; tone: "up" | "down" | "neutral" }> = [];

    snapshot.assets.forEach((asset) => {
      if (typeof asset.changePercent !== "number") return;
      if (asset.changePercent >= 2) {
        list.push({
          title: language === "ko" ? `${asset.symbol} 상승 모멘텀` : `${asset.symbol} upside momentum`,
          summary:
            language === "ko"
              ? `${formatPercent(asset.changePercent)} 상승으로 단기 강세 신호가 보입니다.`
              : `${formatPercent(asset.changePercent)} suggests a short-term upside signal.`,
          tone: "up"
        });
      } else if (asset.changePercent <= -2) {
        list.push({
          title: language === "ko" ? `${asset.symbol} 하락 압력` : `${asset.symbol} downside pressure`,
          summary:
            language === "ko"
              ? `${formatPercent(asset.changePercent)} 움직임으로 변동성 주의 구간입니다.`
              : `${formatPercent(asset.changePercent)} signals a more fragile, volatile setup.`,
          tone: "down"
        });
      }
    });

    if (snapshot.fearGreed?.value >= 70) {
      list.push({
        title: language === "ko" ? "심리 과열 구간" : "Greed zone",
        summary:
          language === "ko"
            ? `지수 ${snapshot.fearGreed.value}로 단기 과열 여부를 점검할 필요가 있습니다.`
            : `At ${snapshot.fearGreed.value}, the market may be nearing a short-term overheat zone.`,
        tone: "neutral"
      });
    }

    if (snapshot.fearGreed?.value <= 30) {
      list.push({
        title: language === "ko" ? "심리 위축 구간" : "Fear zone check",
        summary:
          language === "ko"
            ? `지수 ${snapshot.fearGreed.value}로 방어적 해석이 필요한 구간입니다.`
            : `At ${snapshot.fearGreed.value}, a defensive read may be more appropriate.`,
        tone: "down"
      });
    }

    return list.slice(0, 8);
  }, [language, snapshot]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 className={styles.title}>{copy.title}</h1>
            <p className={styles.description}>{copy.description}</p>
          </div>

          <div className={styles.heroStats}>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.signalCount}</p>
              <p className={styles.statValue}>{signals.length}</p>
              <p className={styles.statHint}>{copy.generatedSignals}</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.fearGreed}</p>
              <p className={styles.statValue}>{snapshot.fearGreed?.value ?? "-"}</p>
              <p className={styles.statHint}>{snapshot.fearGreed?.classification || "-"}</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.volume}</p>
              <p className={styles.statValue}>{formatCurrency(snapshot.cryptoVolumeUsd, "KRW")}</p>
              <p className={styles.statHint}>{copy.snapshot}</p>
            </article>
          </div>
        </section>

        <section className={styles.masonry}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{copy.generatedSignals}</h2>
              <span className={styles.panelCaption}>{copy.autoSummary}</span>
            </div>
            <div className={styles.stack}>
              {signals.map((signal) => (
                <div key={signal.title} className={styles.listCard}>
                  <div className={styles.panelHeader}>
                    <p className={styles.itemTitle}>{signal.title}</p>
                    <span
                      className={
                        signal.tone === "up"
                          ? styles.upBadge
                          : signal.tone === "down"
                            ? styles.downBadge
                            : styles.neutralBadge
                      }
                    >
                      {signal.tone === "up"
                        ? copy.positive
                        : signal.tone === "down"
                          ? copy.caution
                          : copy.neutral}
                    </span>
                  </div>
                  <p className={styles.itemMeta}>{signal.summary}</p>
                </div>
              ))}
              {!signals.length ? <p className={styles.emptyState}>{copy.noSignal}</p> : null}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{copy.assetCheck}</h2>
              <span className={styles.pill}>{copy.snapshot}</span>
            </div>
            <div className={styles.stack}>
              {snapshot.assets.map((asset) => (
                <div key={asset.symbol} className={styles.listCard}>
                  <div className={styles.itemRow}>
                    <div>
                      <p className={styles.itemTitle}>{asset.symbol}</p>
                      <p className={styles.itemMeta}>{formatCurrency(asset.price, asset.currency || "USD")}</p>
                    </div>
                    <span
                      className={
                        typeof asset.changePercent === "number"
                          ? asset.changePercent >= 0
                            ? styles.upBadge
                            : styles.downBadge
                          : styles.neutralBadge
                      }
                    >
                      {formatPercent(asset.changePercent)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
