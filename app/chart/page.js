"use client";

import { useEffect, useMemo, useState } from "react";
import TradingViewChart from "@/components/chart/TradingViewChart";
import styles from "./page.module.css";

const COPY = {
  title: "\uCC28\uD2B8 \uCEE8\uD2B8\uB864 \uB370\uC2A4\uD06C",
  description:
    "\uBA54\uC774\uC800 \uCF54\uC778, \uBBF8\uAD6D \uC8FC\uC2DD, \uB9AC\uC2A4\uD06C \uC628 \uC2DC\uADF8\uB110\uC744 \uD55C \uD654\uBA74\uC5D0 \uBAA8\uC544\uC11C \uBE60\uB974\uAC8C \uD750\uB984\uC744 \uBCF4\uB294 \uC6A9\uB3C4\uC758 \uCC28\uD2B8 \uB300\uC2DC\uBCF4\uB4DC\uC785\uB2C8\uB2E4.",
  heroBadge: "LIVE SETUP",
  stat1Label: "\uD2B8\uB808\uB529 \uBC30\uCE58",
  stat1Value: "9 Charts",
  stat2Label: "\uD575\uC2EC \uD14C\uB9C8",
  stat2Value: "Crypto / Tech / Macro",
  stat3Label: "\uAE30\uBCF8 \uC2DC\uAC04\uB300",
  notesTitle: "\uBE60\uB978 \uCCB4\uD06C \uD3EC\uC778\uD2B8",
  notes: [
    "\uBA54\uC774\uC800 \uCF54\uC778 \uC139\uC158\uC5D0\uC11C \uC120\uB3C4\uC790\uAC00 \uB204\uAD6C\uC778\uC9C0 \uBA3C\uC800 \uD655\uC778\uD558\uC138\uC694.",
    "\uAE30\uC220\uC8FC \uC139\uC158\uC740 \uB9AC\uC2A4\uD06C \uC628 \uC2EC\uB9AC\uB97C \uAC00\uC7A5 \uBE60\uB974\uAC8C \uBC18\uC601\uD569\uB2C8\uB2E4.",
    "\uB9E4\uD06C\uB85C \uC139\uC158\uC5D0\uC11C \uB2EC\uB7EC, \uAE08, \uC6D0/\uB2EC\uB7EC\uB97C \uAC19\uC774 \uBCF4\uBA74 \uD68C\uD53C \uC2EC\uB9AC\uB97C \uBE60\uB974\uAC8C \uC77D\uC744 \uC218 \uC788\uC2B5\uB2C8\uB2E4."
  ],
  watchTitle: "\uC624\uB298 \uBCF4\uAE30 \uC88B\uC740 \uD750\uB984",
  watchItems: [
    { label: "BTC vs ETH", value: "\uAE09\uB4F1 \uC774\uD6C4 \uC120\uB3C4 \uC790\uC0B0 \uD655\uC778" },
    { label: "SOL / XRP", value: "\uC54C\uD2B8 \uC21C\uD658 \uAC15\uB3C4 \uCCB4\uD06C" },
    { label: "NVDA / TSLA", value: "\uAE30\uC220\uC8FC \uC704\uD5D8 \uC120\uD638 \uC628\uB3C4" },
    { label: "DXY / XAUUSD", value: "\uBC29\uC5B4 \uC2EC\uB9AC \uC720\uC785 \uC5EC\uBD80" }
  ],
  presetTitle: "\uBE60\uB978 \uD504\uB9AC\uC14B",
  focusTitle: "\uD3EC\uCEE4\uC2A4 \uC2EC\uBCFC",
  checklistTitle: "\uCC28\uD2B8 \uC77D\uAE30 \uCCB4\uD06C\uB9AC\uC2A4\uD2B8",
  compareTitle: "\uC9C0\uAE08 \uBE44\uAD50 \uD3EC\uC778\uD2B8"
};

const SECTION_TABS = [
  { value: "all", label: "\uC804\uCCB4 \uBCF4\uAE30" },
  { value: "crypto", label: "\uCF54\uC778" },
  { value: "tech", label: "\uAE30\uC220\uC8FC" },
  { value: "macro", label: "\uB9E4\uD06C\uB85C" }
];

const TIMEFRAME_OPTIONS = [
  { value: "15", label: "15M" },
  { value: "60", label: "1H" },
  { value: "240", label: "4H" },
  { value: "1D", label: "1D" }
];

const PRESETS = [
  {
    id: "crypto-scout",
    label: "Crypto Scout",
    description: "\uCF54\uC778 \uC120\uB3C4 \uD750\uB984\uC744 \uBE60\uB974\uAC8C \uBCF4\uB294 \uAD6C\uC131",
    tab: "crypto",
    timeframe: "15"
  },
  {
    id: "tech-swing",
    label: "Tech Swing",
    description: "\uAE30\uC220\uC8FC \uC2A4\uC719 \uD750\uB984\uACFC \uB9AC\uC2A4\uD06C \uC628 \uC2EC\uB9AC \uD655\uC778",
    tab: "tech",
    timeframe: "240"
  },
  {
    id: "macro-defense",
    label: "Macro Defense",
    description: "\uB2EC\uB7EC\u00B7\uAE08\u00B7\uD658\uC728 \uD750\uB984 \uC704\uC8FC \uBC29\uC5B4 \uCCB4\uD06C",
    tab: "macro",
    timeframe: "1D"
  }
];

const CHART_SECTIONS = [
  {
    id: "crypto",
    title: "\uBA54\uC774\uC800 \uCF54\uC778",
    description:
      "\uBE44\uD2B8\uCF54\uC778\uACFC \uC774\uB354\uB9AC\uC6C0 \uADF8\uB9AC\uACE0 \uAC15\uC138 \uC54C\uD2B8\uC758 \uC21C\uC11C\uB97C \uBE44\uAD50\uD558\uAE30 \uC88B\uC740 \uAD6C\uC131\uC785\uB2C8\uB2E4.",
    focusHint: "\uBA3C\uC800 BTC \uBC29\uD5A5\uC131\uC744 \uBCF4\uACE0 ETH\u00B7SOL \uD655\uC0B0 \uC5EC\uBD80\uB97C \uC774\uC5B4\uC11C \uBCF4\uC138\uC694.",
    checklist: [
      "\uACE0\uC810 \uB3CC\uD30C \uD6C4 \uAC70\uB798 \uC9C0\uC18D \uC5EC\uBD80",
      "\uC120\uB3C4\uC790 BTC \uB300\uBE44 \uD6C4\uBC1C \uC790\uC0B0 \uAC15\uB3C4",
      "\uC9C0\uC9C0 / \uC800\uD56D \uBC18\uC751 \uC18D\uB3C4"
    ],
    charts: [
      {
        symbol: "BINANCE:BTCUSDT",
        title: "Bitcoin",
        caption: "\uC2DC\uC7A5 \uC120\uB3C4\uC790",
        role: "\uBA54\uC774\uC800 \uB9AC\uC2A4\uD06C \uC628 \uAE30\uC900",
        summary: "\uC804\uCCB4 \uCF54\uC778 \uC2EC\uB9AC\uB97C \uC774\uB044\uB294 \uC911\uC2EC \uCD95"
      },
      {
        symbol: "BINANCE:ETHUSDT",
        title: "Ethereum",
        caption: "\uB300\uD615 \uC54C\uD2B8 \uAE30\uC900",
        role: "\uD655\uC0B0 \uC2EC\uB9AC \uC120\uD589 \uC790\uC0B0",
        summary: "\uBE44\uD2B8\uCF54\uC778 \uC774\uD6C4 \uC790\uAE08 \uD655\uC0B0 \uD750\uB984 \uD655\uC778 \uC6A9\uB3C4"
      },
      {
        symbol: "BINANCE:SOLUSDT",
        title: "Solana",
        caption: "\uACF5\uACA9\uC801 \uC218\uAE09 \uCCB4\uD06C",
        role: "\uACF5\uACA9\uC801 \uC54C\uD2B8 \uCCB4\uB825 \uD655\uC778",
        summary: "\uB2E8\uAE30 \uC22B\uAE09\uC758 \uAC15\uB3C4\uB97C \uBCF4\uAE30 \uC88B\uC740 \uC885\uBAA9"
      }
    ]
  },
  {
    id: "tech",
    title: "\uAE30\uC220\uC8FC \uB9AC\uC2A4\uD06C \uC628",
    description:
      "\uB098\uC2A4\uB2E5 \uB300\uD45C \uC885\uBAA9\uB4E4\uC744 \uAC19\uC774 \uBCF4\uBA74 \uD22C\uC790 \uC2EC\uB9AC\uAC00 \uC0B4\uC544\uC788\uB294\uC9C0 \uBE60\uB974\uAC8C \uD30C\uC545\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.",
    focusHint: "\uB300\uD615 \uAE30\uC220\uC8FC \uC911 \uB204\uAC00 \uC120\uB3C4\uD558\uB294\uC9C0 \uBCF4\uBA74 \uB9E4\uC218 \uC2EC\uB9AC \uC628\uB3C4\uAC00 \uBCF4\uC785\uB2C8\uB2E4.",
    checklist: [
      "\uAC2D \uC0C1\uC2B9 \uB4A4 \uC9C0\uC9C0 \uC720\uC9C0 \uC5EC\uBD80",
      "\uC2DC\uCD1D \uC0C1\uC704 \uC885\uBAA9 \uB3D9\uC870 \uC5EC\uBD80",
      "\uC2DC\uAC00 \uB300\uBE44 \uC885\uAC00 \uD76C\uC18C \uD750\uB984"
    ],
    charts: [
      {
        symbol: "NASDAQ:NVDA",
        title: "NVIDIA",
        caption: "AI \uB300\uD45C\uC8FC",
        role: "AI \uD14C\uB9C8 \uB300\uD45C \uC8FC\uB3C4\uC8FC",
        summary: "\uACF5\uACA9\uC801 \uC131\uC7A5 \uC2EC\uB9AC\uC758 \uCCB4\uC628\uACC4"
      },
      {
        symbol: "NASDAQ:TSLA",
        title: "Tesla",
        caption: "\uBCC0\uB3D9\uC131 \uC120\uD638 \uB300\uD45C",
        role: "\uB9AC\uC2A4\uD06C \uC628/\uC624\uD504 \uC804\uD658 \uBBFC\uAC10 \uC885\uBAA9",
        summary: "\uD22C\uC790\uC790 \uACF5\uACA9\uC131\uC744 \uBE60\uB974\uAC8C \uBC18\uC601"
      },
      {
        symbol: "NASDAQ:MSFT",
        title: "Microsoft",
        caption: "\uB300\uD615 \uD14C\uD06C \uC548\uC815\uAC10",
        role: "\uC548\uC815\uC801 \uC131\uC7A5 \uD750\uB984 \uAE30\uC900\uC810",
        summary: "\uBB34\uAC8C\uAC10 \uC788\uB294 \uB300\uD615\uC8FC \uD750\uB984 \uD655\uC778"
      }
    ]
  },
  {
    id: "macro",
    title: "\uB9E4\uD06C\uB85C \uD750\uB984",
    description:
      "\uB2EC\uB7EC, \uAE08, \uD658\uC728 \uD750\uB984\uC740 \uCF54\uC778\uACFC \uC8FC\uC2DD \uC591\uCABD\uC758 \uB9AC\uC2A4\uD06C \uC2EC\uB9AC\uB97C \uD574\uC11D\uD560 \uB54C \uAC19\uC774 \uBD10\uC57C \uD569\uB2C8\uB2E4.",
    focusHint: "\uB2EC\uB7EC \uAC15\uC138 \uACFC \uAE08 \uC0C1\uC2B9\uC774 \uAC19\uC774 \uB098\uC624\uBA74 \uACBD\uACC4 \uC2EC\uB9AC \uC77C \uD655\uB960\uC774 \uB192\uC544\uC9D1\uB2C8\uB2E4.",
    checklist: [
      "\uB2EC\uB7EC \uAC15\uC138 / \uC57D\uC138 \uC804\uD658 \uC9C0\uC810",
      "\uAE08 \uC0C1\uC2B9\uACFC \uC704\uD5D8 \uC790\uC0B0 \uB3D9\uD589 \uC5EC\uBD80",
      "\uD658\uC728 \uAE09\uB4F1 \uC2DC \uB9AC\uC2A4\uD06C \uD68C\uD53C \uD750\uB984"
    ],
    charts: [
      {
        symbol: "TVC:DXY",
        title: "Dollar Index",
        caption: "\uB2EC\uB7EC \uAC15\uC138 / \uC57D\uC138",
        role: "\uC804\uCCB4 \uC790\uAE08 \uC120\uD638 \uC9C0\uD45C",
        summary: "\uC704\uD5D8 \uC790\uC0B0\uACFC \uC885\uC885 \uBC18\uB300 \uD750\uB984\uC744 \uBCF4\uC784"
      },
      {
        symbol: "OANDA:XAUUSD",
        title: "Gold",
        caption: "\uBC29\uC5B4 \uC790\uC0B0 \uC218\uAE09",
        role: "\uD53C\uB09C\uCC98 \uC2EC\uB9AC \uD655\uC778 \uC790\uC0B0",
        summary: "\uBC29\uC5B4 \uC2EC\uB9AC \uC720\uC785 \uC2DC \uAC15\uD558\uAC8C \uBC18\uC751"
      },
      {
        symbol: "FX_IDC:USDKRW",
        title: "USD/KRW",
        caption: "\uC6D0\uD654 \uBBFC\uAC10\uB3C4",
        role: "\uC544\uC2DC\uC544 \uC704\uD5D8 \uC120\uD638 \uCCB4\uAC10 \uD658\uC728",
        summary: "\uAD6D\uB0B4 \uAD00\uC810\uC5D0\uC11C \uC2EC\uB9AC \uBCC0\uD654\uB97C \uBCF4\uAE30 \uC88B\uC74C"
      }
    ]
  }
];

function ChartSection({ section, timeframe, selectedSymbol, onSelectSymbol }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <div>
          <p className={styles.sectionEyebrow}>SECTION</p>
          <h2 className={styles.sectionTitle}>{section.title}</h2>
        </div>
        <p className={styles.sectionDescription}>{section.description}</p>
      </div>

      <div className={styles.chartGrid}>
        {section.charts.map((chart) => (
          <article
            key={chart.symbol}
            className={selectedSymbol === chart.symbol ? styles.chartCardActive : styles.chartCard}
            onClick={() => onSelectSymbol(chart.symbol)}
          >
            <div className={styles.chartCardHeader}>
              <div>
                <h3 className={styles.chartTitle}>{chart.title}</h3>
                <p className={styles.chartCaption}>{chart.caption}</p>
              </div>
              <span className={styles.symbolBadge}>{chart.symbol}</span>
            </div>
            <TradingViewChart symbol={chart.symbol} interval={timeframe} />
          </article>
        ))}
      </div>
    </section>
  );
}

export default function ChartsPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [timeframe, setTimeframe] = useState("60");
  const [selectedSymbol, setSelectedSymbol] = useState("BINANCE:BTCUSDT");

  const visibleSections = useMemo(() => {
    if (activeTab === "all") return CHART_SECTIONS;
    return CHART_SECTIONS.filter((section) => section.id === activeTab);
  }, [activeTab]);

  const flattenedCharts = useMemo(() => visibleSections.flatMap((section) => section.charts), [visibleSections]);

  const focusChart = useMemo(() => {
    return flattenedCharts.find((chart) => chart.symbol === selectedSymbol) || flattenedCharts[0] || null;
  }, [flattenedCharts, selectedSymbol]);

  const focusSection = useMemo(() => {
    return visibleSections.find((section) => section.charts.some((chart) => chart.symbol === focusChart?.symbol)) || visibleSections[0] || null;
  }, [focusChart, visibleSections]);

  const activeTimeframeLabel =
    TIMEFRAME_OPTIONS.find((option) => option.value === timeframe)?.label || timeframe;

  useEffect(() => {
    if (focusChart) return;
    if (flattenedCharts[0]) {
      setSelectedSymbol(flattenedCharts[0].symbol);
    }
  }, [focusChart, flattenedCharts]);

  const handlePreset = (preset) => {
    setActiveTab(preset.tab);
    setTimeframe(preset.timeframe);

    const section = CHART_SECTIONS.find((item) => item.id === preset.tab);
    if (section?.charts[0]) {
      setSelectedSymbol(section.charts[0].symbol);
    }
  };

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.heroBadge}>{COPY.heroBadge}</span>
          <h1 className={styles.heroTitle}>{COPY.title}</h1>
          <p className={styles.heroDescription}>{COPY.description}</p>
        </div>

        <div className={styles.heroStats}>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>{COPY.stat1Label}</p>
            <p className={styles.statValue}>{COPY.stat1Value}</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>{COPY.stat2Label}</p>
            <p className={styles.statValue}>{COPY.stat2Value}</p>
          </article>
          <article className={styles.statCard}>
            <p className={styles.statLabel}>{COPY.stat3Label}</p>
            <p className={styles.statValue}>{`${activeTimeframeLabel} + BB`}</p>
          </article>
        </div>
      </section>

      <section className={styles.controlBar}>
        <div className={styles.controlGroup}>
          <p className={styles.controlLabel}>\uC2EC\uBCFC \uD0ED</p>
          <div className={styles.tabRow}>
            {SECTION_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={activeTab === tab.value ? styles.activeControlButton : styles.controlButton}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.controlGroup}>
          <p className={styles.controlLabel}>\uC2DC\uAC04\uD504\uB808\uC784</p>
          <div className={styles.tabRow}>
            {TIMEFRAME_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setTimeframe(option.value)}
                className={timeframe === option.value ? styles.activeControlButton : styles.controlButton}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.utilityGrid}>
        <article className={styles.infoPanel}>
          <h2 className={styles.infoTitle}>{COPY.presetTitle}</h2>
          <div className={styles.presetGrid}>
            {PRESETS.map((preset) => (
              <button key={preset.id} className={styles.presetCard} onClick={() => handlePreset(preset)}>
                <span className={styles.presetName}>{preset.label}</span>
                <span className={styles.presetDescription}>{preset.description}</span>
              </button>
            ))}
          </div>
        </article>

        <article className={styles.infoPanel}>
          <h2 className={styles.infoTitle}>{COPY.focusTitle}</h2>
          {focusChart ? (
            <div className={styles.focusCard}>
              <div className={styles.focusHeader}>
                <div>
                  <p className={styles.focusName}>{focusChart.title}</p>
                  <p className={styles.focusCaption}>{focusChart.caption}</p>
                </div>
                <span className={styles.symbolBadge}>{focusChart.symbol}</span>
              </div>
              <p className={styles.focusRole}>{focusChart.role}</p>
              <p className={styles.focusSummary}>{focusChart.summary}</p>
              <p className={styles.focusHint}>{focusSection?.focusHint}</p>
            </div>
          ) : null}
        </article>
      </section>

      <section className={styles.infoGrid}>
        <article className={styles.infoPanel}>
          <h2 className={styles.infoTitle}>{COPY.notesTitle}</h2>
          <ul className={styles.noteList}>
            {COPY.notes.map((note) => (
              <li key={note} className={styles.noteItem}>
                {note}
              </li>
            ))}
          </ul>
        </article>

        <article className={styles.infoPanel}>
          <h2 className={styles.infoTitle}>{COPY.watchTitle}</h2>
          <div className={styles.watchGrid}>
            {COPY.watchItems.map((item) => (
              <div key={item.label} className={styles.watchCard}>
                <p className={styles.watchLabel}>{item.label}</p>
                <p className={styles.watchValue}>{item.value}</p>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className={styles.utilityGrid}>
        <article className={styles.infoPanel}>
          <h2 className={styles.infoTitle}>{COPY.checklistTitle}</h2>
          <ul className={styles.noteList}>
            {(focusSection?.checklist || []).map((item) => (
              <li key={item} className={styles.noteItem}>
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className={styles.infoPanel}>
          <h2 className={styles.infoTitle}>{COPY.compareTitle}</h2>
          <div className={styles.compareGrid}>
            {flattenedCharts.map((chart) => (
              <button
                key={chart.symbol}
                className={selectedSymbol === chart.symbol ? styles.compareCardActive : styles.compareCard}
                onClick={() => setSelectedSymbol(chart.symbol)}
              >
                <span className={styles.compareTitle}>{chart.title}</span>
                <span className={styles.compareMeta}>{chart.caption}</span>
              </button>
            ))}
          </div>
        </article>
      </section>

      {visibleSections.map((section) => (
        <ChartSection
          key={section.title}
          section={section}
          timeframe={timeframe}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={setSelectedSymbol}
        />
      ))}
    </div>
  );
}
