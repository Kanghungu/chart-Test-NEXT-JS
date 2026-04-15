"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import styles from "./HomeDashboardExtras.module.css";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import {
  getLocalizedAssetName,
  getLocalizedEventCountry,
  getLocalizedEventTitle,
  getLocalizedImpact
} from "@/lib/marketLocalization";

type WatchItem = {
  symbol: string;
  name: string;
  nameKo?: string;
  nameEn?: string;
  group: "crypto" | "stock";
  price: number | null;
  changePercent: number | null;
};

type EventItem = {
  time: string;
  country: string;
  countryKo?: string;
  countryEn?: string;
  title: string;
  titleKo?: string;
  titleEn?: string;
  impact: string;
  impactKo?: string;
  impactEn?: string;
};

type SnapshotAsset = {
  symbol: string;
  name?: string;
  price: number | null;
  changePercent: number | null;
  currency?: string;
};

type HeatmapAsset = {
  symbol: string;
  name?: string;
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

type Language = "ko" | "en";

const QUICK_LINKS: Array<{
  href: string;
  eyebrow: string;
  title: Record<Language, string>;
  description: Record<Language, string>;
}> = [
  {
    href: "/stock-news",
    eyebrow: "US STOCKS",
    title: { ko: "주식 뉴스 전체보기", en: "Browse all stock news" },
    description: {
      ko: "미국 주식 헤드라인과 요약을 한 번에 확인해 보세요.",
      en: "See US stock headlines and summaries in one place."
    }
  },
  {
    href: "/crypto-news",
    eyebrow: "KOREA",
    title: { ko: "한국주식 뉴스 전체보기", en: "Browse all Korean stock news" },
    description: {
      ko: "코스피, 코스닥, 반도체, 대형주 이슈를 한 번에 살펴보세요.",
      en: "Track KOSPI, KOSDAQ, semiconductors, and local market headlines together."
    }
  },
  {
    href: "/chart",
    eyebrow: "CHART",
    title: { ko: "차트 대시보드 열기", en: "Open chart dashboard" },
    description: {
      ko: "한국주식과 미국주식 차트를 나란히 비교해 보세요.",
      en: "Compare Korean and US stock charts side by side."
    }
  }
];

const COPY: Record<
  Language,
  {
    eyebrow: string;
    title: string;
    description: string;
    spotlightEyebrow: string;
    spotlightTitle: string;
    dbLive: string;
    latestBriefing: string;
    risingAssets: string;
    fallingAssets: string;
    risingHint: string;
    fallingHint: string;
    preparingSummary: string;
    seededBriefing: string;
    signalsLoading: string;
    heatmap: string;
    leaders: string;
    todayScenario: string;
    whatToWatch: string;
    quickPulse: string;
    overview: string;
    strongestAsset: string;
    weakestAsset: string;
    marketView: string;
    marketViewFallback: string;
    live: string;
    marketBrief: string;
    topMovers: string;
    moversHint: string;
    macroPreview: string;
    macroHint: string;
    quickIdeas: string;
    quickIdeasHint: string;
    noEvents: string;
    noMovers: string;
  }
> = {
  ko: {
    eyebrow: "더 보기",
    title: "홈에서 더 다양한 정보를 자연스럽게 확인해 보세요",
    description: "시장 요약 아래에 움직임, 일정, 시그널, 빠른 이동 경로를 묶어두었습니다.",
    spotlightEyebrow: "오늘의 플레이북",
    spotlightTitle: "한 번에 읽는 시장 컨텍스트",
    dbLive: "DB 연결",
    latestBriefing: "최신 브리핑",
    risingAssets: "상승 자산",
    fallingAssets: "하락 자산",
    risingHint: "최신 스냅샷에서 오른 종목 수",
    fallingHint: "아직 약한 흐름의 종목 수",
    preparingSummary: "시장 요약을 준비하고 있습니다...",
    seededBriefing: "브리핑과 대시보드 코멘트가 이 영역에 표시됩니다.",
    signalsLoading: "DB에서 시그널 데이터를 불러오는 중입니다...",
    heatmap: "미니 히트맵",
    leaders: "강한 움직임",
    todayScenario: "오늘의 시나리오",
    whatToWatch: "집중 포인트",
    quickPulse: "퀵 펄스",
    overview: "요약",
    strongestAsset: "가장 강한 자산",
    weakestAsset: "가장 약한 자산",
    marketView: "시장 해석",
    marketViewFallback: "위험 선호와 이벤트 흐름 요약이 이곳에 표시됩니다.",
    live: "실시간",
    marketBrief: "시장 브리프",
    topMovers: "오늘 주목할 자산",
    moversHint: "변동폭 기준",
    macroPreview: "경제 일정 미리보기",
    macroHint: "이번 주 체크",
    quickIdeas: "탐색 시작 포인트",
    quickIdeasHint: "바로 보기",
    noEvents: "일정 데이터를 불러오는 중입니다...",
    noMovers: "변동 자산 데이터를 불러오는 중입니다..."
  },
  en: {
    eyebrow: "DISCOVER MORE",
    title: "See more market context without leaving the home screen",
    description: "We bundle movement, events, signals, and fast routes below the market overview.",
    spotlightEyebrow: "TODAY'S PLAYBOOK",
    spotlightTitle: "Market context at a glance",
    dbLive: "DB LIVE",
    latestBriefing: "Latest briefing",
    risingAssets: "Rising assets",
    fallingAssets: "Falling assets",
    risingHint: "Positive movers in the latest snapshot",
    fallingHint: "Names still trading on the back foot",
    preparingSummary: "Preparing market summary...",
    seededBriefing: "Seeded briefing and dashboard commentary will appear here.",
    signalsLoading: "Signal data is loading from the database...",
    heatmap: "Mini heatmap",
    leaders: "leaders",
    todayScenario: "Today scenario",
    whatToWatch: "What to watch",
    quickPulse: "Quick pulse",
    overview: "overview",
    strongestAsset: "Strongest asset",
    weakestAsset: "Weakest asset",
    marketView: "Market view",
    marketViewFallback: "Risk appetite and event flow summary will appear here.",
    live: "LIVE",
    marketBrief: "Market brief",
    topMovers: "Top movers today",
    moversHint: "by volatility",
    macroPreview: "Macro preview",
    macroHint: "this week",
    quickIdeas: "Quick ideas",
    quickIdeasHint: "jump in",
    noEvents: "Loading event data...",
    noMovers: "Loading mover data..."
  }
};

function getImpactTone(impact: string) {
  if (impact.includes("높") || impact.toUpperCase().includes("HIGH")) return styles.highImpact;
  if (impact.includes("중") || impact.toUpperCase().includes("MEDIUM")) return styles.mediumImpact;
  return styles.lowImpact;
}

function formatHeatPrice(value: number | null, currency = "USD") {
  if (typeof value !== "number") return "-";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 2 : 2
  }).format(value);
}

function getHeatmapToneClass(change: number) {
  if (change >= 2) return styles.heatStrongUp;
  if (change > 0) return styles.heatUp;
  if (change <= -2) return styles.heatStrongDown;
  return styles.heatDown;
}

function getHeatmapSizeClass(index: number) {
  if (index === 0) return styles.heatTileHero;
  if (index <= 2) return styles.heatTileLarge;
  if (index <= 6) return styles.heatTileMedium;
  return styles.heatTileSmall;
}

export default function HomeDashboardExtras() {
  const { language } = useLanguage();
  const copy = COPY[language];

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
    const rising = snapshot.assets.filter(
      (asset) => typeof asset.changePercent === "number" && asset.changePercent > 0
    ).length;
    const falling = snapshot.assets.filter(
      (asset) => typeof asset.changePercent === "number" && asset.changePercent < 0
    ).length;
    return { rising, falling };
  }, [snapshot.assets]);

  const featuredBriefing = briefings[0] ?? null;
  const nextEvent = events[0] ?? null;

  const cryptoHeatmapAssets = useMemo<HeatmapAsset[]>(() => {
    return watchlist
      .filter((item) => item.group === "crypto" && typeof item.changePercent === "number")
      .sort((a, b) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0))
      .slice(0, 8)
      .map((item) => ({
        symbol: item.symbol,
        name: getLocalizedAssetName(item, language),
        price: item.price,
        changePercent: item.changePercent,
        currency: "USD"
      }));
  }, [language, watchlist]);

  const stockHeatmapAssets = useMemo<HeatmapAsset[]>(() => {
    const benchmarkAssets = snapshot.assets
      .filter((asset) => asset.symbol === "S&P 500" || asset.symbol === "NASDAQ")
      .map((asset) => ({
        symbol: asset.symbol,
        name: asset.symbol === "S&P 500" ? "S&P 500" : "NASDAQ",
        price: asset.price,
        changePercent: asset.changePercent,
        currency: asset.currency || "USD"
      }));

    const stockItems = watchlist
      .filter((item) => item.group === "stock" && typeof item.changePercent === "number")
      .sort((a, b) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0))
      .map((item) => ({
        symbol: item.symbol,
        name: getLocalizedAssetName(item, language),
        price: item.price,
        changePercent: item.changePercent,
        currency: "USD"
      }));

    return [...benchmarkAssets, ...stockItems].slice(0, 8);
  }, [language, snapshot.assets, watchlist]);

  const todayScenario = useMemo(() => {
    if (snapshot.fearGreed && snapshot.fearGreed.value <= 30) {
      return {
        title: language === "ko" ? "방어적인 출발 가능성" : "Defensive open",
        tone: "DOWN" as const,
        summary:
          language === "ko"
            ? "공포 구간에 가까워서 장 초반에는 변동성 확대와 보수적인 대응이 더 중요합니다."
            : "Fear is elevated, so a cautious first hour and sharper reactions are more likely.",
        focus:
          (nextEvent ? getLocalizedEventTitle(nextEvent, language) : "") ||
          (language === "ko"
            ? "고베타 자산의 급격한 흔들림을 우선 체크하세요."
            : "Watch for sudden risk-off moves in high-beta assets.")
      };
    }

    if (marketBreadth.rising >= marketBreadth.falling + 2) {
      return {
        title: language === "ko" ? "위험 선호 이어짐" : "Risk-on continuation",
        tone: "UP" as const,
        summary:
          language === "ko"
            ? "상승 자산 수가 더 많아 주도주의 흐름이 이어질 가능성이 높습니다."
            : "More assets are participating on the upside, which supports continuation in leaders.",
        focus: strongestAsset?.symbol
          ? language === "ko"
            ? `${strongestAsset.symbol} 중심의 상대강도 흐름을 계속 보세요.`
            : `Momentum focus remains on ${strongestAsset.symbol} and other strong names.`
          : language === "ko"
            ? "상대적으로 강한 자산부터 확인해 보세요."
            : "Lean on leaders with the cleanest upside structure."
      };
    }

    return {
      title: language === "ko" ? "박스권 + 이벤트 대기" : "Range and catalyst watch",
      tone: "NEUTRAL" as const,
      summary:
        language === "ko"
          ? "시장 균형이 맞는 구간이라 다음 거시 이벤트가 방향을 정할 가능성이 큽니다."
          : "The tape looks balanced, so macro headlines and scheduled events may decide the next move.",
      focus: nextEvent
        ? language === "ko"
          ? `가장 중요한 촉매: ${getLocalizedEventTitle(nextEvent, language)}`
          : `Primary catalyst: ${getLocalizedEventTitle(nextEvent, language)}`
        : language === "ko"
          ? "다음 예정된 거시 이벤트를 확인해 보세요."
          : "Monitor the next scheduled macro event for direction."
    };
  }, [language, snapshot.fearGreed, marketBreadth, nextEvent, strongestAsset]);

  const toneClassName = (tone: DashboardSignal["tone"]) => {
    if (tone === "UP") return styles.toneUp;
    if (tone === "DOWN") return styles.toneDown;
    return styles.toneNeutral;
  };

  return (
    <section className={styles.root}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.eyebrow}>{copy.eyebrow}</p>
          <h2 className={styles.title}>{copy.title}</h2>
        </div>
        <p className={styles.description}>{copy.description}</p>
      </div>

      <div className={styles.quickLinkGrid}>
        {QUICK_LINKS.map((item) => (
          <Link key={item.href} href={item.href} className={styles.quickLinkCard}>
            <span className={styles.quickEyebrow}>{item.eyebrow}</span>
            <strong className={styles.quickTitle}>{item.title[language]}</strong>
            <p className={styles.quickDescription}>{item.description[language]}</p>
          </Link>
        ))}
      </div>

      <section className={styles.spotlightGrid}>
        <article className={`${styles.panel} ${styles.spotlightPanel}`}>
          <div className={styles.panelHeader}>
            <div>
              <p className={styles.spotlightEyebrow}>{copy.spotlightEyebrow}</p>
              <h3 className={styles.panelTitle}>{copy.spotlightTitle}</h3>
            </div>
            <span className={styles.panelBadge}>{copy.dbLive}</span>
          </div>

          <div className={styles.spotlightSummary}>
            <div className={styles.spotlightCard}>
              <p className={styles.spotlightLabel}>{copy.latestBriefing}</p>
              <strong className={styles.spotlightTitle}>
                {featuredBriefing?.title || copy.preparingSummary}
              </strong>
              <p className={styles.spotlightText}>
                {featuredBriefing?.summary || copy.seededBriefing}
              </p>
            </div>

            <div className={styles.spotlightMiniGrid}>
              <div className={styles.spotlightMiniCard}>
                <span className={styles.briefLabel}>{copy.risingAssets}</span>
                <strong className={styles.briefValue}>{marketBreadth.rising}</strong>
                <p className={styles.briefMeta}>{copy.risingHint}</p>
              </div>
              <div className={styles.spotlightMiniCard}>
                <span className={styles.briefLabel}>{copy.fallingAssets}</span>
                <strong className={styles.briefValue}>{marketBreadth.falling}</strong>
                <p className={styles.briefMeta}>{copy.fallingHint}</p>
              </div>
            </div>
          </div>

          <div className={styles.signalRail}>
            {signals.map((signal) => (
              <div key={signal.id} className={styles.signalCard}>
                <div className={styles.signalCardTop}>
                  <strong className={styles.signalCardTitle}>{signal.title}</strong>
                  <span className={`${styles.signalTone} ${toneClassName(signal.tone)}`}>
                    {signal.tone}
                  </span>
                </div>
                <p className={styles.signalCardText}>{signal.summary}</p>
              </div>
            ))}
            {!signals.length ? <p className={styles.empty}>{copy.signalsLoading}</p> : null}
          </div>

          <div className={styles.visualGrid}>
            <div className={styles.heatmapStack}>
              <div className={styles.heatmapCard}>
                <div className={styles.panelHeader}>
                  <h4 className={styles.visualTitle}>
                    {language === "ko" ? "한국주식 히트맵" : "Korean stock heatmap"}
                  </h4>
                  <span className={styles.panelSubtle}>{copy.leaders}</span>
                </div>

                <div className={styles.heatmapGrid}>
                  {cryptoHeatmapAssets.map((asset, index) => (
                    <div
                      key={asset.symbol}
                      className={`${styles.heatTile} ${getHeatmapSizeClass(index)} ${getHeatmapToneClass(asset.changePercent ?? 0)}`}
                    >
                      <div className={styles.heatTop}>
                        <span className={styles.heatSymbol}>{asset.symbol}</span>
                        {asset.name ? <span className={styles.heatName}>{asset.name}</span> : null}
                      </div>
                      <div className={styles.heatBottom}>
                        <strong className={styles.heatPrice}>{formatHeatPrice(asset.price, asset.currency)}</strong>
                        <span className={styles.heatChange}>{formatPercent(asset.changePercent)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.heatmapCard}>
                <div className={styles.panelHeader}>
                  <h4 className={styles.visualTitle}>
                    {language === "ko" ? "미국 주식 히트맵" : "US stock heatmap"}
                  </h4>
                  <span className={styles.panelSubtle}>
                    {language === "ko" ? "대형주와 지수" : "mega caps and indexes"}
                  </span>
                </div>

                <div className={styles.heatmapGrid}>
                  {stockHeatmapAssets.map((asset, index) => (
                    <div
                      key={asset.symbol}
                      className={`${styles.heatTile} ${getHeatmapSizeClass(index)} ${getHeatmapToneClass(asset.changePercent ?? 0)}`}
                    >
                      <div className={styles.heatTop}>
                        <span className={styles.heatSymbol}>{asset.symbol}</span>
                        {asset.name ? <span className={styles.heatName}>{asset.name}</span> : null}
                      </div>
                      <div className={styles.heatBottom}>
                        <strong className={styles.heatPrice}>{formatHeatPrice(asset.price, asset.currency)}</strong>
                        <span className={styles.heatChange}>{formatPercent(asset.changePercent)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.scenarioCard}>
              <div className={styles.panelHeader}>
                <h4 className={styles.visualTitle}>{copy.todayScenario}</h4>
                <span className={`${styles.signalTone} ${toneClassName(todayScenario.tone)}`}>
                  {todayScenario.tone}
                </span>
              </div>

              <strong className={styles.scenarioTitle}>{todayScenario.title}</strong>
              <p className={styles.scenarioText}>{todayScenario.summary}</p>

              <div className={styles.scenarioFocus}>
                <span className={styles.scenarioLabel}>{copy.whatToWatch}</span>
                <p className={styles.scenarioFocusText}>{todayScenario.focus}</p>
              </div>
            </div>
          </div>
        </article>

        <article className={`${styles.panel} ${styles.snapshotSidePanel}`}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>{copy.quickPulse}</h3>
            <span className={styles.panelSubtle}>{copy.overview}</span>
          </div>

          <div className={styles.stackStats}>
            <div className={styles.stackStatCard}>
              <span className={styles.briefLabel}>{copy.strongestAsset}</span>
              <strong className={styles.briefValue}>{strongestAsset?.symbol || "-"}</strong>
              <p className={styles.positiveText}>
                {formatPercent(strongestAsset?.changePercent ?? null)}
              </p>
            </div>
            <div className={styles.stackStatCard}>
              <span className={styles.briefLabel}>{copy.weakestAsset}</span>
              <strong className={styles.briefValue}>{weakestAsset?.symbol || "-"}</strong>
              <p className={styles.negativeText}>
                {formatPercent(weakestAsset?.changePercent ?? null)}
              </p>
            </div>
            <div className={styles.stackStatCard}>
              <span className={styles.briefLabel}>{copy.marketView}</span>
              <p className={styles.briefMeta}>
                {featuredBriefing?.marketView || copy.marketViewFallback}
              </p>
            </div>
          </div>
        </article>
      </section>

      <div className={styles.grid}>
        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>{copy.marketBrief}</h3>
            <span className={styles.panelBadge}>{copy.live}</span>
          </div>

          <div className={styles.briefGrid}>
            <div className={styles.briefCard}>
              <span className={styles.briefLabel}>
                {language === "ko" ? "공포·탐욕 지수" : "Fear & Greed"}
              </span>
              <strong className={styles.briefValue}>
                {snapshot.fearGreed ? `${snapshot.fearGreed.value}` : "-"}
              </strong>
              <p className={styles.briefMeta}>{snapshot.fearGreed?.classification || "-"}</p>
            </div>

            <div className={styles.briefCard}>
              <span className={styles.briefLabel}>{copy.strongestAsset}</span>
              <strong className={styles.briefValue}>{strongestAsset?.symbol || "-"}</strong>
              <p className={styles.positiveText}>
                {formatPercent(strongestAsset?.changePercent ?? null)}
              </p>
            </div>

            <div className={styles.briefCard}>
              <span className={styles.briefLabel}>{copy.weakestAsset}</span>
              <strong className={styles.briefValue}>{weakestAsset?.symbol || "-"}</strong>
              <p className={styles.negativeText}>
                {formatPercent(weakestAsset?.changePercent ?? null)}
              </p>
            </div>
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>{copy.topMovers}</h3>
            <span className={styles.panelSubtle}>{copy.moversHint}</span>
          </div>

          <div className={styles.moverList}>
            {topMovers.map((item) => {
              const isUp = typeof item.changePercent === "number" && item.changePercent >= 0;

              return (
                <div key={item.symbol} className={styles.moverRow}>
                  <div>
                    <p className={styles.assetName}>{getLocalizedAssetName(item, language)}</p>
                    <p className={styles.assetSymbol}>{item.symbol}</p>
                  </div>
                  <div className={styles.assetMeta}>
                    <p className={styles.assetPrice}>{formatCurrency(item.price)}</p>
                    <p className={isUp ? styles.positiveText : styles.negativeText}>
                      {formatPercent(item.changePercent)}
                    </p>
                  </div>
                </div>
              );
            })}
            {!topMovers.length ? <p className={styles.empty}>{copy.noMovers}</p> : null}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>{copy.macroPreview}</h3>
            <span className={styles.panelSubtle}>{copy.macroHint}</span>
          </div>

          <div className={styles.eventList}>
            {events.map((item, index) => (
              <div key={`${item.time}-${item.title}-${index}`} className={styles.eventCard}>
                <div className={styles.eventTop}>
                  <span className={styles.eventCountry}>{getLocalizedEventCountry(item, language)}</span>
                  <span className={`${styles.impactBadge} ${getImpactTone(getLocalizedImpact(item, language))}`}>
                    {getLocalizedImpact(item, language)}
                  </span>
                </div>
                <p className={styles.eventTitle}>{getLocalizedEventTitle(item, language)}</p>
                <p className={styles.eventTime}>{item.time}</p>
              </div>
            ))}
            {!events.length ? <p className={styles.empty}>{copy.noEvents}</p> : null}
          </div>
        </article>

        <article className={styles.panel}>
          <div className={styles.panelHeader}>
            <h3 className={styles.panelTitle}>{copy.quickIdeas}</h3>
            <span className={styles.panelSubtle}>{copy.quickIdeasHint}</span>
          </div>

          <div className={styles.promptList}>
            <div className={styles.promptCard}>
              <p className={styles.promptLabel}>
                {language === "ko" ? "미국주식 뉴스에서 보기 좋은 키워드" : "US stock news filters"}
              </p>
              <p className={styles.promptText}>ETF, Fed, AI, Tesla, NVIDIA, Earnings</p>
            </div>
            <div className={styles.promptCard}>
              <p className={styles.promptLabel}>
                {language === "ko" ? "한국주식 뉴스에서 보기 좋은 키워드" : "Korean stock news filters"}
              </p>
              <p className={styles.promptText}>코스피, 코스닥, 삼성전자, SK하이닉스, 반도체, 외국인</p>
            </div>
            <div className={styles.promptCard}>
              <p className={styles.promptLabel}>
                {language === "ko" ? "차트에서 바로 비교할 조합" : "Useful chart pairs"}
              </p>
              <p className={styles.promptText}>삼성전자 / SK하이닉스, NAVER / 현대차, NVDA / TSLA, DXY / USDKRW</p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

