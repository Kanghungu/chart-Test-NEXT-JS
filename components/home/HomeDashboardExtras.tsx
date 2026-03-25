"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./HomeDashboardExtras.module.css";
import { formatCurrency, formatPercent } from "@/lib/formatters";

type WatchItem = {
  symbol: string;
  name: string;
  group: "crypto" | "stock";
  price: number | null;
  changePercent: number | null;
};

type EventItem = {
  time: string;
  country: string;
  title: string;
  impact: string;
};

type SnapshotAsset = {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  currency?: string;
};

type SnapshotData = {
  assets: SnapshotAsset[];
  fearGreed: {
    value: number;
    classification: string;
  } | null;
};

type DashboardSignal = {
  id: string;
  title: string;
  summary: string;
  tone: "UP" | "DOWN" | "NEUTRAL";
};

type DashboardBriefing = {
  id: string;
  title: string;
  summary: string;
  marketView: string | null;
};

const QUICK_LINKS = [
  {
    href: "/stock-news",
    eyebrow: "STOCKS",
    title: "주식 뉴스 전체보기",
    description: "미국 주식 헤드라인과 요약을 한 페이지에서 빠르게 확인합니다."
  },
  {
    href: "/crypto-news",
    eyebrow: "CRYPTO",
    title: "코인 뉴스 전체보기",
    description: "비트코인, 이더리움, ETF, 규제 이슈를 모아서 살펴봅니다."
  },
  {
    href: "/chart",
    eyebrow: "CHART",
    title: "차트 데스크 열기",
    description: "코인, 기술주, 매크로 차트를 한 화면에서 비교합니다."
  }
];

function getImpactTone(impact: string) {
  if (impact.includes("높")) return styles.highImpact;
  if (impact.includes("중")) return styles.mediumImpact;
  return styles.lowImpact;
}

export default function HomeDashboardExtras() {
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [snapshot, setSnapshot] = useState<SnapshotData>({ assets: [], fearGreed: null });
  const [signals, setSignals] = useState<DashboardSignal[]>([]);
  const [briefings, setBriefings] = useState<DashboardBriefing[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [watchRes, eventRes, snapshotRes, dashboardRes] = await Promise.all([
          fetch("/api/market/watchlist", { cache: "no-store" }),
          fetch("/api/market/events", { cache: "no-store" }),
          fetch("/api/market/snapshot", { cache: "no-store" }),
          fetch("/api/db/dashboard", { cache: "no-store" })
        ]);

        const [watchJson, eventJson, snapshotJson, dashboardJson] = await Promise.all([
          watchRes.json(),
          eventRes.json(),
          snapshotRes.json(),
          dashboardRes.json()
        ]);

        if (!mounted) return;

        setWatchlist(Array.isArray(watchJson?.items) ? watchJson.items : []);
        setEvents(Array.isArray(eventJson?.items) ? eventJson.items.slice(0, 4) : []);
        setSnapshot({
          assets: Array.isArray(snapshotJson?.assets) ? snapshotJson.assets : [],
          fearGreed: snapshotJson?.fearGreed ?? null
        });
        setSignals(Array.isArray(dashboardJson?.signals) ? dashboardJson.signals.slice(0, 3) : []);
        setBriefings(Array.isArray(dashboardJson?.briefings) ? dashboardJson.briefings.slice(0, 2) : []);
      } catch {
        if (!mounted) return;
        setWatchlist([]);
        setEvents([]);
        setSignals([]);
        setBriefings([]);
      }
    };

    load();
    const timer = setInterval(load, 60000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const topMovers = useMemo(() => {
    return [...watchlist]
      .filter((item) => typeof item.changePercent === "number")
      .sort((a, b) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0))
      .slice(0, 4);
  }, [watchlist]);

  const strongestAsset = useMemo(() => {
    return [...snapshot.assets]
      .filter((asset) => typeof asset.changePercent === "number")
      .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))[0];
  }, [snapshot.assets]);

  const weakestAsset = useMemo(() => {
    return [...snapshot.assets]
      .filter((asset) => typeof asset.changePercent === "number")
      .sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))[0];
  }, [snapshot.assets]);

  const marketBreadth = useMemo(() => {
    const rising = snapshot.assets.filter((asset) => typeof asset.changePercent === "number" && asset.changePercent > 0).length;
    const falling = snapshot.assets.filter((asset) => typeof asset.changePercent === "number" && asset.changePercent < 0).length;
    return { rising, falling };
  }, [snapshot.assets]);

  const featuredBriefing = briefings[0] ?? null;
  const nextEvent = events[0] ?? null;

  const heatmapAssets = useMemo(() => {
    return [...snapshot.assets]
      .filter((asset) => typeof asset.changePercent === "number")
      .sort((a, b) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0))
      .slice(0, 6);
  }, [snapshot.assets]);

  const todayScenario = useMemo(() => {
    if (snapshot.fearGreed && snapshot.fearGreed.value <= 30) {
      return {
        title: "Defensive open",
        tone: "DOWN" as const,
        summary: "Fear is elevated, so a cautious first hour and sharp headline reactions are more likely.",
        focus: nextEvent?.title || "Watch for sudden risk-off moves in high-beta assets."
      };
    }

    if (marketBreadth.rising >= marketBreadth.falling + 2) {
      return {
        title: "Risk-on continuation",
        tone: "UP" as const,
        summary: "More assets are participating on the upside, which supports continuation in leaders.",
        focus: strongestAsset?.symbol
          ? `Momentum focus remains on ${strongestAsset.symbol} and other relative-strength names.`
          : "Lean on leaders with the cleanest upside structure."
      };
    }

    return {
      title: "Range and catalyst watch",
      tone: "NEUTRAL" as const,
      summary: "The tape looks balanced, so macro headlines and scheduled events may decide the next move.",
      focus: nextEvent?.title
        ? `Primary catalyst: ${nextEvent.title}`
        : "Monitor the next scheduled macro event for direction."
    };
  }, [snapshot.fearGreed, marketBreadth, nextEvent, strongestAsset]);

  const toneClassName = (tone: DashboardSignal["tone"]) => {
    if (tone === "UP") return styles.toneUp;
    if (tone === "DOWN") return styles.toneDown;
    return styles.toneNeutral;
  };

  return (
    <section className={styles.root}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>DISCOVER MORE</p>
          <h2 className={styles.title}>홈에서 더 다양한 정보를 자연스럽게 확인할 수 있어요</h2>
        </div>
        <p className={styles.description}>
          뉴스와 차트만 오가는 대신, 자산 움직임과 일정, 빠른 이동 경로를 함께 묶어서 탐색 흐름을 더 편하게 만들었습니다.
        </p>
      </div>

      <div className={styles.quickLinkGrid}>
        {QUICK_LINKS.map((item) => (
          <Link key={item.href} href={item.href} className={styles.quickLinkCard}>
            <span className={styles.quickEyebrow}>{item.eyebrow}</span>
            <strong className={styles.quickTitle}>{item.title}</strong>
            <p className={styles.quickDescription}>{item.description}</p>
          </Link>
        ))}
      </div>

      <section className={styles.spotlightGrid}>
        <article className={`${styles.panel} ${styles.spotlightPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.spotlightEyebrow}>TODAY'S PLAYBOOK</p>
              <h3 className={styles.panelTitle}>한 번에 읽는 시장 컨텍스트</h3>
            </div>
            <span className={styles.panelBadge}>DB LIVE</span>
          </div>

          <div className={styles.spotlightSummary}>
            <div className={styles.spotlightCard}>
              <p className={styles.spotlightLabel}>Latest briefing</p>
              <strong className={styles.spotlightTitle}>{featuredBriefing?.title || "Preparing market summary..."}</strong>
              <p className={styles.spotlightText}>
                {featuredBriefing?.summary || "Seeded briefing and dashboard commentary will appear here."}
              </p>
            </div>

            <div className={styles.spotlightMiniGrid}>
              <div className={styles.spotlightMiniCard}>
                <span className={styles.briefLabel}>Rising assets</span>
                <strong className={styles.briefValue}>{marketBreadth.rising}</strong>
                <p className={styles.briefMeta}>Positive movers in the latest snapshot</p>
              </div>
              <div className={styles.spotlightMiniCard}>
                <span className={styles.briefLabel}>Falling assets</span>
                <strong className={styles.briefValue}>{marketBreadth.falling}</strong>
                <p className={styles.briefMeta}>Names still trading on the back foot</p>
              </div>
            </div>
          </div>

          <div className={styles.signalRail}>
            {signals.map((signal) => (
              <div key={signal.id} className={styles.signalCard}>
                <div className={styles.signalCardTop}>
                  <strong className={styles.signalCardTitle}>{signal.title}</strong>
                  <span className={`${styles.signalTone} ${toneClassName(signal.tone)}`}>{signal.tone}</span>
                </div>
                <p className={styles.signalCardText}>{signal.summary}</p>
              </div>
            ))}
            {!signals.length ? <p className={styles.empty}>Signal data is loading from the database...</p> : null}
          </div>

          <div className={styles.visualGrid}>
            <div className={styles.heatmapCard}>
              <div className={styles.panelHeader}>
                <h4 className={styles.visualTitle}>Mini heatmap</h4>
                <span className={styles.panelSubtle}>leaders</span>
              </div>

              <div className={styles.heatmapGrid}>
                {heatmapAssets.map((asset) => {
                  const change = asset.changePercent ?? 0;
                  const toneClass =
                    change >= 2
                      ? styles.heatStrongUp
                      : change > 0
                        ? styles.heatUp
                        : change <= -2
                          ? styles.heatStrongDown
                          : styles.heatDown;

                  return (
                    <div key={asset.symbol} className={`${styles.heatTile} ${toneClass}`}>
                      <span className={styles.heatSymbol}>{asset.symbol}</span>
                      <strong className={styles.heatPrice}>{formatCurrency(asset.price)}</strong>
                      <span className={styles.heatChange}>{formatPercent(asset.changePercent)}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className={styles.scenarioCard}>
              <div className={styles.panelHeader}>
                <h4 className={styles.visualTitle}>Today scenario</h4>
                <span className={`${styles.signalTone} ${toneClassName(todayScenario.tone)}`}>{todayScenario.tone}</span>
              </div>

              <strong className={styles.scenarioTitle}>{todayScenario.title}</strong>
              <p className={styles.scenarioText}>{todayScenario.summary}</p>

              <div className={styles.scenarioFocus}>
                <span className={styles.scenarioLabel}>What to watch</span>
                <p className={styles.scenarioFocusText}>{todayScenario.focus}</p>
              </div>
            </div>
          </div>
        </article>

        <article className={`${styles.panel} ${styles.snapshotSidePanel}`}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>Quick pulse</h3>
            <span className={styles.panelSubtle}>overview</span>
          </div>

          <div className={styles.stackStats}>
            <div className={styles.stackStatCard}>
              <span className={styles.briefLabel}>Strongest asset</span>
              <strong className={styles.briefValue}>{strongestAsset?.symbol || "-"}</strong>
              <p className={styles.positiveText}>{formatPercent(strongestAsset?.changePercent ?? null)}</p>
            </div>
            <div className={styles.stackStatCard}>
              <span className={styles.briefLabel}>Weakest asset</span>
              <strong className={styles.briefValue}>{weakestAsset?.symbol || "-"}</strong>
              <p className={styles.negativeText}>{formatPercent(weakestAsset?.changePercent ?? null)}</p>
            </div>
            <div className={styles.stackStatCard}>
              <span className={styles.briefLabel}>Market view</span>
              <p className={styles.briefMeta}>
                {featuredBriefing?.marketView || "Risk appetite and event flow summary will appear here."}
              </p>
            </div>
          </div>
        </article>
      </section>

      <div className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>시장 브리핑</h3>
            <span className={styles.panelBadge}>LIVE</span>
          </div>

          <div className={styles.briefGrid}>
            <div className={styles.briefCard}>
              <span className={styles.briefLabel}>공포·탐욕 지수</span>
              <strong className={styles.briefValue}>{snapshot.fearGreed ? `${snapshot.fearGreed.value}` : "-"}</strong>
              <p className={styles.briefMeta}>{snapshot.fearGreed?.classification || "지표 대기 중"}</p>
            </div>

            <div className={styles.briefCard}>
              <span className={styles.briefLabel}>가장 강한 자산</span>
              <strong className={styles.briefValue}>{strongestAsset?.symbol || "-"}</strong>
              <p className={styles.positiveText}>{formatPercent(strongestAsset?.changePercent ?? null)}</p>
            </div>

            <div className={styles.briefCard}>
              <span className={styles.briefLabel}>가장 약한 자산</span>
              <strong className={styles.briefValue}>{weakestAsset?.symbol || "-"}</strong>
              <p className={styles.negativeText}>{formatPercent(weakestAsset?.changePercent ?? null)}</p>
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>오늘 주목 자산</h3>
            <span className={styles.panelSubtle}>변동폭 기준</span>
          </div>

          <div className={styles.moverList}>
            {topMovers.map((item) => {
              const isUp = typeof item.changePercent === "number" && item.changePercent >= 0;

              return (
                <div key={item.symbol} className={styles.moverRow}>
                  <div>
                    <p className={styles.assetName}>{item.name}</p>
                    <p className={styles.assetSymbol}>{item.symbol}</p>
                  </div>
                  <div className={styles.assetMeta}>
                    <p className={styles.assetPrice}>{formatCurrency(item.price)}</p>
                    <p className={isUp ? styles.positiveText : styles.negativeText}>{formatPercent(item.changePercent)}</p>
                  </div>
                </div>
              );
            })}
            {!topMovers.length ? <p className={styles.empty}>데이터를 불러오는 중입니다...</p> : null}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>경제 일정 미리보기</h3>
            <span className={styles.panelSubtle}>이번 주 체크</span>
          </div>

          <div className={styles.eventList}>
            {events.map((item, index) => (
              <div key={`${item.time}-${item.title}-${index}`} className={styles.eventCard}>
                <div className={styles.eventTop}>
                  <span className={styles.eventCountry}>{item.country}</span>
                  <span className={`${styles.impactBadge} ${getImpactTone(item.impact)}`}>{item.impact}</span>
                </div>
                <p className={styles.eventTitle}>{item.title}</p>
                <p className={styles.eventTime}>{item.time}</p>
              </div>
            ))}
            {!events.length ? <p className={styles.empty}>일정을 불러오는 중입니다...</p> : null}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>탐색 시작 포인트</h3>
            <span className={styles.panelSubtle}>바로 보기</span>
          </div>

          <div className={styles.promptList}>
            <div className={styles.promptCard}>
              <p className={styles.promptLabel}>주식 뉴스에서 보기 좋은 키워드</p>
              <p className={styles.promptText}>ETF, Fed, AI, Tesla, NVIDIA, Earnings</p>
            </div>
            <div className={styles.promptCard}>
              <p className={styles.promptLabel}>코인 뉴스에서 보기 좋은 키워드</p>
              <p className={styles.promptText}>Bitcoin, Ethereum, ETF, SEC, Layer2, Solana</p>
            </div>
            <div className={styles.promptCard}>
              <p className={styles.promptLabel}>차트에서 먼저 비교할 흐름</p>
              <p className={styles.promptText}>BTC vs ETH, SOL / XRP, NVDA / TSLA, DXY / XAUUSD</p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
