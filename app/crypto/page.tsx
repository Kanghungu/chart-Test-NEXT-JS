"use client";

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import SignalsPanel from "@/components/crypto/SignalsPanel";
import FundingPanel from "@/components/crypto/FundingPanel";
import TechnicalsPanel from "@/components/crypto/TechnicalsPanel";
import LiquidationMap from "@/components/crypto/LiquidationMap";
import styles from "./page.module.css";

// ── Types ─────────────────────────────────────────────────────────────────
type Coin = "BTC" | "ETH" | "SOL" | "XRP" | "BNB" | "ADA" | "DOGE";
type TF   = "15" | "60" | "240" | "1D";

// ── Config ────────────────────────────────────────────────────────────────
const TV_SYMBOL: Record<Coin, string> = {
  BTC:  "BINANCE:BTCUSDT",
  ETH:  "BINANCE:ETHUSDT",
  SOL:  "BINANCE:SOLUSDT",
  XRP:  "BINANCE:XRPUSDT",
  BNB:  "BINANCE:BNBUSDT",
  ADA:  "BINANCE:ADAUSDT",
  DOGE: "BINANCE:DOGEUSDT",
};

const COIN_INFO: Record<Coin, { name: string; symbol: string; tint: string }> = {
  BTC:  { name: "Bitcoin",  symbol: "₿", tint: "#f7931a" },
  ETH:  { name: "Ethereum", symbol: "Ξ", tint: "#627eea" },
  SOL:  { name: "Solana",   symbol: "◎", tint: "#14f195" },
  XRP:  { name: "XRP",      symbol: "✕", tint: "#00a3e0" },
  BNB:  { name: "BNB",      symbol: "⬡", tint: "#f3ba2f" },
  ADA:  { name: "Cardano",  symbol: "₳", tint: "#0033ad" },
  DOGE: { name: "Dogecoin", symbol: "Ð", tint: "#c2a633" },
};

const COINS: Coin[] = ["BTC", "ETH", "SOL", "XRP", "BNB", "ADA", "DOGE"];

const TFS: { value: TF; label: string }[] = [
  { value: "15",  label: "15m" },
  { value: "60",  label: "1h"  },
  { value: "240", label: "4h"  },
  { value: "1D",  label: "1D"  },
];

// Technical-analysis widget expects different interval tokens than the chart widget
const TA_INTERVAL: Record<TF, string> = {
  "15":  "15m",
  "60":  "1h",
  "240": "4h",
  "1D":  "1D",
};

// ── TradingView widget injector ────────────────────────────────────────────
function TVWidget({
  src,
  config,
  height,
}: {
  src: string;
  config: Record<string, unknown>;
  height: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(config);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = "";

    const inner = document.createElement("div");
    inner.className = "tradingview-widget-container__widget";
    el.appendChild(inner);

    const script = document.createElement("script");
    script.type  = "text/javascript";
    script.src   = src;
    script.async = true;
    script.innerHTML = key;
    el.appendChild(script);

    return () => { el.innerHTML = ""; };
  }, [key, src]);

  return (
    <div
      ref={ref}
      className="tradingview-widget-container"
      style={{ height, width: "100%", overflow: "hidden" }}
    />
  );
}

// ── Live clock ────────────────────────────────────────────────────────────
function useClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

// ── Page ──────────────────────────────────────────────────────────────────
type PanelTab = "signals" | "futures" | "liquidations" | "technicals";

export default function CryptoPage() {
  const { language } = useLanguage();
  const [coin, setCoin] = useState<Coin>("BTC");
  const [tf,   setTf]   = useState<TF>("60");
  const [panelTab, setPanelTab] = useState<PanelTab>("signals");

  const detailRef = useRef<HTMLDivElement>(null);
  const clock = useClock();

  const locale   = language === "ko" ? "kr" : "en";
  const tfLabel  = TFS.find((t) => t.value === tf)?.label ?? tf;

  const COPY = {
    ko: {
      eyebrow:     "CRYPTO TERMINAL · LIVE",
      title:       "암호화폐 시그널 터미널",
      subtitle:    "실시간 가격 · 기술적 분석 · 멀티 타임프레임 차트",
      liveDot:     "LIVE",
      powered:     "Powered by TradingView",
      tapeTitle:   "MARKET TAPE",
      screener:    "전체 시그널 스크리너",
      screenerHint:"모든 암호화폐에 대한 종합 매수/매도 시그널 — 컬럼별 정렬 가능",
      screenerStats:["217 매치", "USD 기준", "실시간 정렬"],
      tabSignals:  "시그널",
      tabFutures:  "선물 지표",
      tabLiq:      "청산 맵",
      tabTech:     "테크니컬",
      picker:      "코인 선택",
      pickerHint:  "카드를 클릭하면 상세 분석 섹션으로 이동합니다",
      detailKicker:"DETAIL",
      detail:      "상세 분석",
      overview:    "시세 개요",
      overviewHint:"가격 · 24H 변동 · 멀티 타임프레임 요약",
      analysis:    "기술적 분석",
      analysisHint:"오실레이터 · 이동평균 · 종합 시그널",
      chart:       "고급 차트",
      chartHint:   "RSI · MACD 내장 캔들 차트",
    },
    en: {
      eyebrow:     "CRYPTO TERMINAL · LIVE",
      title:       "Crypto Signals Terminal",
      subtitle:    "Live price · Technical analysis · Multi-timeframe charts",
      liveDot:     "LIVE",
      powered:     "Powered by TradingView",
      tapeTitle:   "MARKET TAPE",
      screener:    "Signal Screener",
      screenerHint:"Aggregate buy/sell signals across all cryptocurrencies — sortable by column",
      screenerStats:["217 matches", "USD view", "Live sort"],
      tabSignals:  "Signals",
      tabFutures:  "Futures",
      tabLiq:      "Liq Map",
      tabTech:     "Technicals",
      picker:      "Select Coin",
      pickerHint:  "Click a card to jump to detailed analysis",
      detailKicker:"DETAIL",
      detail:      "Detailed Analysis",
      overview:    "Price Overview",
      overviewHint:"Price · 24H change · Multi-timeframe summary",
      analysis:    "Technical Analysis",
      analysisHint:"Oscillators · Moving averages · Composite signal",
      chart:       "Advanced Chart",
      chartHint:   "Candlestick chart with built-in RSI & MACD",
    },
  };
  const c = COPY[language];

  function selectCoin(co: Coin) {
    setCoin(co);
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  const timeString = clock
    ? clock.toLocaleTimeString(language === "ko" ? "ko-KR" : "en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "--:--:--";

  return (
    <div className={styles.page}>
      {/* ── Ambient background glow ── */}
      <div className={styles.ambient} aria-hidden="true" />

      <div className={styles.inner}>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* HERO                                                              */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <header className={styles.hero}>
          <div className={styles.heroInner}>
            <div className={styles.heroLeft}>
              <div className={styles.liveBadge}>
                <span className={styles.livePulse} />
                <span className={styles.liveText}>{c.liveDot}</span>
                <span className={styles.liveClock}>{timeString} KST</span>
              </div>
              <p className={styles.eyebrow}>{c.eyebrow}</p>
              <h1 className={styles.title}>{c.title}</h1>
              <p className={styles.subtitle}>{c.subtitle}</p>
            </div>
            <div className={styles.heroRight}>
              <span className={styles.poweredPill}>{c.powered}</span>
            </div>
          </div>
        </header>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* TICKER TAPE                                                      */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className={styles.tapeSection}>
          <div className={styles.tapeLabel}>
            <span className={styles.tapeDot} />
            {c.tapeTitle}
          </div>
          <div className={styles.tapeWidget}>
            <TVWidget
              height={72}
              src="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"
              config={{
                symbols: COINS.map((co) => ({
                  proName:    TV_SYMBOL[co],
                  title:      co,
                })),
                showSymbolLogo: true,
                isTransparent:  false,
                displayMode:    "adaptive",
                colorTheme:     "dark",
                backgroundColor:"#060d1f",
                locale,
              }}
            />
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* SCREENER                                                         */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className={`${styles.panel} ${styles.screenerPanel}`}>
          <div className={`${styles.panelHeader} ${styles.screenerHeader}`}>
            <div>
              <p className={styles.panelKicker}>01 · SCREENER</p>
              <h2 className={styles.panelTitle}>{c.screener}</h2>
              <p className={styles.panelHint}>{c.screenerHint}</p>
            </div>
            <div className={styles.screenerStats} aria-label="Screener status">
              {c.screenerStats.map((stat) => (
                <span key={stat} className={styles.screenerStat}>
                  {stat}
                </span>
              ))}
            </div>
          </div>
          <div className={`${styles.panelBody} ${styles.screenerBody}`}>
            <div className={styles.screenerChrome}>
              <span className={styles.screenerCornerTl} aria-hidden="true" />
              <span className={styles.screenerCornerBr} aria-hidden="true" />
              <div className={styles.screenerWidgetFrame}>
                <TVWidget
                  height={500}
                  src="https://s3.tradingview.com/external-embedding/embed-widget-screener.js"
                  config={{
                    width:           "100%",
                    height:          490,
                    defaultColumn:   "overview",
                    screener_type:   "crypto_mkt",
                    displayCurrency: "USD",
                    colorTheme:      "dark",
                    backgroundColor: "#07111f",
                    locale,
                    isTransparent:   false,
                  }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* PANEL TABS: 시그널 / 선물 지표 / 테크니컬                        */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <div className={styles.panelTabWrap}>
          <div className={styles.panelTabBar}>
            {([
              { key: "signals",      label: c.tabSignals },
              { key: "futures",      label: c.tabFutures },
              { key: "liquidations", label: c.tabLiq     },
              { key: "technicals",   label: c.tabTech    },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                className={`${styles.panelTabBtn} ${panelTab === key ? styles.panelTabBtnActive : ""} ${key === "technicals" ? styles.panelTabBtnPersonal : ""}`}
                onClick={() => setPanelTab(key)}
              >
                {key === "futures"      && <span className={styles.tabIcon}>📊</span>}
                {key === "liquidations" && <span className={styles.tabIcon}>💥</span>}
                {key === "technicals"   && <span className={styles.tabIcon}>🔬</span>}
                {label}
              </button>
            ))}
          </div>
          <div className={styles.panelTabContent}>
            {panelTab === "signals"      && <SignalsPanel />}
            {panelTab === "futures"      && <FundingPanel />}
            {panelTab === "liquidations" && <LiquidationMap />}
            {panelTab === "technicals"   && <TechnicalsPanel />}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* COIN PICKER                                                       */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section className={styles.pickerSection}>
          <div className={styles.pickerHeader}>
            <div>
              <p className={styles.panelKicker}>03 · PICK</p>
              <h2 className={styles.panelTitle}>{c.picker}</h2>
              <p className={styles.panelHint}>{c.pickerHint}</p>
            </div>
          </div>
          <div className={styles.coinGrid}>
            {COINS.map((co) => {
              const info = COIN_INFO[co];
              const isActive = coin === co;
              return (
                <button
                  key={co}
                  className={`${styles.coinCard} ${isActive ? styles.coinCardActive : ""}`}
                  onClick={() => selectCoin(co)}
                  style={{ "--tint": info.tint } as React.CSSProperties}
                >
                  <span className={styles.coinGlow} aria-hidden="true" />
                  <span className={styles.coinSymbolMark}>{info.symbol}</span>
                  <span className={styles.coinTicker}>{co}</span>
                  <span className={styles.coinName}>{info.name}</span>
                  {isActive && <span className={styles.coinActiveBar} />}
                </button>
              );
            })}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* DETAIL                                                            */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <section ref={detailRef} className={styles.detailSection}>

          {/* Detail header — big ticker banner */}
          <div
            className={styles.detailBanner}
            style={{ "--tint": COIN_INFO[coin].tint } as React.CSSProperties}
          >
            <div className={styles.detailBannerGlow} aria-hidden="true" />
            <div className={styles.detailBannerContent}>
              <div className={styles.detailLeft}>
                <span className={styles.detailCoinMark}>{COIN_INFO[coin].symbol}</span>
                <div>
                  <p className={styles.detailKicker}>{c.detailKicker} · 04</p>
                  <h2 className={styles.detailTitle}>
                    {coin}<span className={styles.detailPair}>/USDT</span>
                  </h2>
                  <p className={styles.detailSub}>{COIN_INFO[coin].name} · {c.detail}</p>
                </div>
              </div>
              <div className={styles.detailRight}>
                <div className={styles.tfGroup}>
                  {TFS.map((t) => (
                    <button
                      key={t.value}
                      className={`${styles.tfBtn} ${tf === t.value ? styles.tfBtnActive : ""}`}
                      onClick={() => setTf(t.value)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Symbol Overview */}
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.panelKicker}>{c.overview}</p>
                <h3 className={styles.panelTitleSm}>{coin}/USDT · Overview</h3>
                <p className={styles.panelHint}>{c.overviewHint}</p>
              </div>
            </div>
            <div className={styles.panelBody}>
              <TVWidget
                height={220}
                src="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js"
                config={{
                  symbols:          [[TV_SYMBOL[coin], TV_SYMBOL[coin] + "|1D"]],
                  chartOnly:        false,
                  width:            "100%",
                  height:           210,
                  locale,
                  colorTheme:       "dark",
                  autosize:         false,
                  showVolume:       false,
                  showMA:           false,
                  hideDateRanges:   false,
                  hideMarketStatus: false,
                  hideSymbolLogo:   false,
                  scalePosition:    "right",
                  scaleMode:        "Normal",
                  fontFamily:       "-apple-system, BlinkMacSystemFont, Inter, Roboto, sans-serif",
                  fontSize:         "10",
                  noTimeScale:      false,
                  valuesTracking:   "1",
                  changeMode:       "price-and-percent",
                  isTransparent:    false,
                  backgroundColor:  "#060d1f",
                  lineColor:        "#38bdf8",
                  topColor:         "rgba(56,189,248,0.22)",
                  bottomColor:      "rgba(56,189,248,0.0)",
                  gridLineColor:    "rgba(51,65,85,0.25)",
                  upColor:          "#4ade80",
                  downColor:        "#f87171",
                  borderUpColor:    "#4ade80",
                  borderDownColor:  "#f87171",
                  wickUpColor:      "#4ade80",
                  wickDownColor:    "#f87171",
                }}
              />
            </div>
          </div>

          {/* Analysis + Chart grid */}
          <div className={styles.analysisGrid}>
            <div
              className={`${styles.panel} ${styles.taPanel}`}
              style={{ "--tint": COIN_INFO[coin].tint } as React.CSSProperties}
            >
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.panelKicker}>{c.analysis}</p>
                  <h3 className={styles.panelTitleSm}>
                    {coin}/USDT · {tfLabel}
                  </h3>
                  <p className={styles.panelHint}>{c.analysisHint}</p>
                </div>
                <div className={styles.taBadge}>
                  <span className={styles.taBadgePulse} />
                  AI
                </div>
              </div>

              {/* Indicator type chips */}
              <div className={styles.taChipRow}>
                <span className={`${styles.taChip} ${styles.taChipOsc}`}>
                  <span className={styles.taChipDot} />
                  오실레이터
                </span>
                <span className={`${styles.taChip} ${styles.taChipMa}`}>
                  <span className={styles.taChipDot} />
                  이동평균
                </span>
                <span className={`${styles.taChip} ${styles.taChipPivot}`}>
                  <span className={styles.taChipDot} />
                  피벗 포인트
                </span>
              </div>

              <div className={styles.panelBody}>
                <div className={`${styles.widgetShell} ${styles.taWidgetShell}`}>
                  <div className={styles.widgetToolbar} aria-hidden="true">
                    <span className={styles.widgetToolbarLabel}>SIGNAL MATRIX</span>
                    <span className={styles.widgetToolbarChip}>OSC</span>
                    <span className={styles.widgetToolbarChip}>MA</span>
                    <span className={styles.widgetToolbarChip}>PIVOT</span>
                  </div>
                  <span className={styles.widgetCornerTl} aria-hidden="true" />
                  <span className={styles.widgetCornerBr} aria-hidden="true" />
                  <div className={styles.taScanWrap} aria-hidden="true">
                    <div className={styles.taScanLine} />
                  </div>
                  <div className={styles.widgetViewport}>
                    <TVWidget
                      height={480}
                      src="https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js"
                      config={{
                        interval:         TA_INTERVAL[tf],
                        width:            "100%",
                        height:           470,
                        symbol:           TV_SYMBOL[coin],
                        showIntervalTabs: false,
                        displayMode:      "single",
                        colorTheme:       "dark",
                        backgroundColor:  "#060d1f",
                        locale,
                        isTransparent:    false,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div
              className={`${styles.panel} ${styles.chartPanel}`}
              style={{ "--tint": COIN_INFO[coin].tint } as React.CSSProperties}
            >
              <div className={`${styles.panelHeader} ${styles.chartHeader}`}>
                <div>
                  <p className={styles.panelKicker}>{c.chart}</p>
                  <h3 className={styles.panelTitleSm}>
                    {coin}/USDT · {tfLabel}
                  </h3>
                  <p className={styles.panelHint}>{c.chartHint}</p>
                </div>
                <div className={styles.chartHeaderStats}>
                  <span>{tfLabel}</span>
                  <span>RSI</span>
                  <span>MACD</span>
                </div>
              </div>
              <div className={styles.panelBody}>
                <div className={`${styles.widgetShell} ${styles.chartWidgetShell}`}>
                  <div className={styles.chartRail} aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className={styles.widgetCornerTl} aria-hidden="true" />
                  <span className={styles.widgetCornerBr} aria-hidden="true" />
                  <div className={styles.widgetViewport}>
                    <TVWidget
                      height={460}
                      src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js"
                      config={{
                        autosize:            false,
                        width:               "100%",
                        height:              450,
                        symbol:              TV_SYMBOL[coin],
                        interval:            tf,
                        timezone:            "Asia/Seoul",
                        theme:               "dark",
                        style:               "1",
                        locale,
                        allow_symbol_change: false,
                        hide_side_toolbar:   true,
                        calendar:            false,
                        studies:             ["STD;RSI", "STD;MACD"],
                        support_host:        "https://www.tradingview.com",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </section>

      </div>
    </div>
  );
}
