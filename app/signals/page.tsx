"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/components/discover/DiscoverPage.module.css";
import { formatCurrency, formatPercent } from "@/lib/formatters";

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

export default function SignalsPage() {
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
          title: `${asset.symbol} 상승 모멘텀`,
          summary: `${formatPercent(asset.changePercent)} 흐름으로 단기 강세 신호가 보입니다.`,
          tone: "up"
        });
      } else if (asset.changePercent <= -2) {
        list.push({
          title: `${asset.symbol} 하락 압력`,
          summary: `${formatPercent(asset.changePercent)} 흐름으로 변동성 확대를 주의할 구간입니다.`,
          tone: "down"
        });
      }
    });

    if (snapshot.fearGreed?.value >= 70) {
      list.push({
        title: "탐욕 구간 진입",
        summary: `공포·탐욕 지수 ${snapshot.fearGreed.value}로 단기 과열 가능성을 체크할 필요가 있습니다.`,
        tone: "neutral"
      });
    }

    if (snapshot.fearGreed?.value <= 30) {
      list.push({
        title: "공포 구간 확대",
        summary: `공포·탐욕 지수 ${snapshot.fearGreed.value}로 방어적 해석이 필요한 구간입니다.`,
        tone: "down"
      });
    }

    return list.slice(0, 8);
  }, [snapshot]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>SIGNAL BOARD</p>
            <h1 className={styles.title}>시장 시그널 센터</h1>
            <p className={styles.description}>
              가격 변화, 공포·탐욕, 거래대금 흐름을 묶어서 오늘 시장에서 바로 해석할 만한 시그널을 카드로 정리했습니다.
            </p>
          </div>

          <div className={styles.heroStats}>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>시그널 수</p>
              <p className={styles.statValue}>{signals.length}</p>
              <p className={styles.statHint}>현재 생성된 핵심 신호</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>공포·탐욕</p>
              <p className={styles.statValue}>{snapshot.fearGreed?.value ?? "-"}</p>
              <p className={styles.statHint}>{snapshot.fearGreed?.classification || "데이터 대기 중"}</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>24H 코인 거래대금</p>
              <p className={styles.statValue}>{formatCurrency(snapshot.cryptoVolumeUsd)}</p>
              <p className={styles.statHint}>유동성 강도 확인용</p>
            </article>
          </div>
        </section>

        <section className={styles.masonry}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>핵심 시그널</h2>
              <span className={styles.panelCaption}>Auto summary</span>
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
                      {signal.tone === "up" ? "긍정" : signal.tone === "down" ? "주의" : "중립"}
                    </span>
                  </div>
                  <p className={styles.itemMeta}>{signal.summary}</p>
                </div>
              ))}
              {!signals.length ? <p className={styles.emptyState}>강한 시그널이 아직 없습니다.</p> : null}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>자산 체크</h2>
              <span className={styles.pill}>snapshot</span>
            </div>
            <div className={styles.stack}>
              {snapshot.assets.map((asset) => (
                <div key={asset.symbol} className={styles.listCard}>
                  <div className={styles.itemRow}>
                    <div>
                      <p className={styles.itemTitle}>{asset.symbol}</p>
                      <p className={styles.itemMeta}>{formatCurrency(asset.price)}</p>
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
