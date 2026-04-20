"use client";

import { useState, useEffect, useRef } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
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

const COIN_INFO: Record<Coin, { name: string; emoji: string }> = {
  BTC:  { name: "Bitcoin",  emoji: "₿"  },
  ETH:  { name: "Ethereum", emoji: "Ξ"  },
  SOL:  { name: "Solana",   emoji: "◎"  },
  XRP:  { name: "XRP",      emoji: "✕"  },
  BNB:  { name: "BNB",      emoji: "⬡"  },
  ADA:  { name: "Cardano",  emoji: "₳"  },
  DOGE: { name: "Dogecoin", emoji: "Ð"  },
};

const COINS: Coin[] = ["BTC", "ETH", "SOL", "XRP", "BNB", "ADA", "DOGE"];

const TFS: { value: TF; label: string }[] = [
  { value: "15",  label: "15m" },
  { value: "60",  label: "1h"  },
  { value: "240", label: "4h"  },
  { value: "1D",  label: "1D"  },
];

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

// ── Page ──────────────────────────────────────────────────────────────────
export default function CryptoPage() {
  const { language } = useLanguage();
  const [coin, setCoin] = useState<Coin>("BTC");
  const [tf,   setTf]   = useState<TF>("60");

  const detailRef = useRef<HTMLDivElement>(null);

  const locale   = language === "ko" ? "kr" : "en";
  const tfLabel  = TFS.find((t) => t.value === tf)?.label ?? tf;

  const COPY = {
    ko: {
      eyebrow:    "CRYPTO SIGNALS",
      title:      "암호화폐 차트 시그널",
      subtitle:   "TradingView 실시간 기술적 분석 · 오실레이터 · 이동평균 · 종합 시그널",
      screener:   "암호화폐 전체 시그널 스크리너",
      detail:     "코인 상세 분석",
      detailHint: "아래 버튼을 클릭하면 해당 코인의 차트와 기술적 분석을 확인할 수 있습니다",
      analysis:   "기술적 분석",
      chart:      "차트",
      overview:   "시세 개요",
      powered:    "Powered by TradingView",
    },
    en: {
      eyebrow:    "CRYPTO SIGNALS",
      title:      "Crypto Chart Signals",
      subtitle:   "TradingView live technical analysis · Oscillators · Moving Averages · Summary",
      screener:   "Crypto Screener — All Signals",
      detail:     "Coin Detail",
      detailHint: "Click a coin button below to view its chart and technical analysis",
      analysis:   "Technical Analysis",
      chart:      "Chart",
      overview:   "Price Overview",
      powered:    "Powered by TradingView",
    },
  };
  const c = COPY[language];

  function selectCoin(co: Coin) {
    setCoin(co);
    // small delay so widgets re-render before scroll
    setTimeout(() => {
      detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  return (
    <div className={styles.page}>
      <div className={styles.inner}>

        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <p className={styles.eyebrow}>{c.eyebrow}</p>
            <h1 className={styles.title}>{c.title}</h1>
            <p className={styles.subtitle}>{c.subtitle}</p>
          </div>
          <span className={styles.powered}>{c.powered}</span>
        </div>

        {/* ── Screener ── */}
        <div className={styles.panel}>
          <p className={styles.panelTitle}>{c.screener}</p>
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
              locale,
              isTransparent:   true,
            }}
          />
        </div>

        {/* ── Coin selector ── */}
        <div className={styles.coinSelectorSection}>
          <p className={styles.selectorHint}>{c.detailHint}</p>
          <div className={styles.coinGrid}>
            {COINS.map((co) => (
              <button
                key={co}
                className={`${styles.coinCard} ${coin === co ? styles.coinCardActive : ""}`}
                onClick={() => selectCoin(co)}
              >
                <span className={styles.coinEmoji}>{COIN_INFO[co].emoji}</span>
                <span className={styles.coinTicker}>{co}</span>
                <span className={styles.coinName}>{COIN_INFO[co].name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Detail panel (ref target) ── */}
        <div ref={detailRef} className={styles.detailSection}>

          {/* Detail header */}
          <div className={styles.detailHeader}>
            <div className={styles.detailHeaderLeft}>
              <span className={styles.detailEmoji}>{COIN_INFO[coin].emoji}</span>
              <div>
                <h2 className={styles.detailTitle}>{coin}/USDT</h2>
                <p className={styles.detailSubtitle}>{COIN_INFO[coin].name} · {c.detail}</p>
              </div>
            </div>
            {/* Timeframe selector */}
            <div className={styles.filterGroup}>
              {TFS.map((t) => (
                <button
                  key={t.value}
                  className={`${styles.filterBtn} ${tf === t.value ? styles.filterBtnActive : ""}`}
                  onClick={() => setTf(t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── Symbol Overview (price + mini chart) ── */}
          <div className={styles.panel}>
            <p className={styles.panelTitle}>{c.overview} — {coin}/USDT</p>
            <TVWidget
              height={200}
              src="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js"
              config={{
                symbols:      [[TV_SYMBOL[coin], TV_SYMBOL[coin] + "|1D"]],
                chartOnly:    false,
                width:        "100%",
                height:       190,
                locale,
                colorTheme:   "dark",
                autosize:     false,
                showVolume:   false,
                showMA:       false,
                hideDateRanges: false,
                hideMarketStatus: false,
                hideSymbolLogo:   false,
                scalePosition:    "right",
                scaleMode:        "Normal",
                fontFamily:       "-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif",
                fontSize:         "10",
                noTimeScale:      false,
                valuesTracking:   "1",
                changeMode:       "price-and-percent",
                isTransparent:    true,
              }}
            />
          </div>

          {/* ── Technical Analysis + Chart grid ── */}
          <div className={styles.analysisGrid}>
            {/* Technical Analysis */}
            <div className={styles.panel}>
              <p className={styles.panelTitle}>
                {c.analysis} — {coin}/USDT · {tfLabel}
              </p>
              <TVWidget
                height={460}
                src="https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js"
                config={{
                  interval:         tf,
                  width:            "100%",
                  height:           450,
                  symbol:           TV_SYMBOL[coin],
                  showIntervalTabs: false,
                  displayMode:      "single",
                  colorTheme:       "dark",
                  locale,
                  isTransparent:    true,
                }}
              />
            </div>

            {/* Advanced Chart */}
            <div className={styles.panel}>
              <p className={styles.panelTitle}>
                {c.chart} — {coin}/USDT · {tfLabel}
              </p>
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

        </div>{/* end detailSection */}

      </div>
    </div>
  );
}
