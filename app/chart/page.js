"use client";

import { useEffect, useMemo, useState } from "react";
import TradingViewChart from "@/components/chart/TradingViewChart";
import styles from "./page.module.css";

const COPY = {
  title: "차트 컨트롤 데스크",
  description:
    "한국주식, 미국주식, 매크로 흐름을 한 화면에 모아 빠르게 비교하는 차트 대시보드입니다.",
  heroBadge: "LIVE SETUP",
  stat1Label: "트레이딩 배치",
  stat1Value: "9 Charts",
  stat2Label: "핵심 테마",
  stat2Value: "KR / US / Macro",
  stat3Label: "기본 시간대",
  notesTitle: "빠른 체크 포인트",
  notes: [
    "한국주식 섹션에서는 코스피 대형주의 상대 강도를 먼저 확인하세요.",
    "미국주식 섹션은 나스닥 리더들의 위험 선호를 빠르게 보여줍니다.",
    "매크로 섹션에서 달러, 금, 원/달러를 함께 보면 글로벌 자금 흐름을 읽기 쉽습니다."
  ],
  watchTitle: "오늘 보기 좋은 흐름",
  watchItems: [
    { label: "삼성전자 vs SK하이닉스", value: "국내 반도체 리더십 확인" },
    { label: "NAVER / 현대차", value: "성장주와 경기민감주의 온도차 체크" },
    { label: "NVDA / TSLA", value: "미국 성장주 위험 선호 확인" },
    { label: "DXY / USDKRW", value: "달러 강세와 원화 민감도 체크" }
  ],
  presetTitle: "빠른 프리셋",
  focusTitle: "포커스 심볼",
  checklistTitle: "차트 읽기 체크리스트",
  compareTitle: "지금 비교 포인트"
};

const SECTION_TABS = [
  { value: "all", label: "전체 보기" },
  { value: "korea", label: "한국주식" },
  { value: "us", label: "미국주식" },
  { value: "macro", label: "매크로" }
];

const TIMEFRAME_OPTIONS = [
  { value: "15", label: "15M" },
  { value: "60", label: "1H" },
  { value: "240", label: "4H" },
  { value: "1D", label: "1D" }
];

const PRESETS = [
  {
    id: "korea-open",
    label: "Korea Open",
    description: "한국 대형주와 반도체 흐름을 빠르게 확인",
    tab: "korea",
    timeframe: "15"
  },
  {
    id: "us-swing",
    label: "US Swing",
    description: "미국 기술주 스윙 흐름과 리더십 확인",
    tab: "us",
    timeframe: "240"
  },
  {
    id: "macro-defense",
    label: "Macro Defense",
    description: "달러·금·환율 중심 방어 체크",
    tab: "macro",
    timeframe: "1D"
  }
];

const CHART_SECTIONS = [
  {
    id: "korea",
    title: "한국주식 리더",
    description: "코스피 대표 종목과 성장주를 함께 보며 국내 시장의 주도주 흐름을 읽는 구성입니다.",
    focusHint: "삼성전자와 SK하이닉스가 함께 강하면 국내 반도체 주도력이 살아 있는 경우가 많습니다.",
    checklist: [
      "대형주 동반 상승 여부",
      "반도체와 플랫폼주의 순환 여부",
      "갭 상승 뒤 지지 유지 여부"
    ],
    charts: [
      {
        symbol: "KRX:005930",
        title: "삼성전자",
        caption: "국내 시가총액 1위",
        role: "코스피 리더십 기준점",
        summary: "국내 대형주 위험 선호를 가장 빠르게 확인할 수 있는 핵심 종목"
      },
      {
        symbol: "KRX:000660",
        title: "SK하이닉스",
        caption: "반도체 고베타",
        role: "반도체 강도 측정",
        summary: "AI 반도체 수요와 성장 기대를 민감하게 반영하는 대표 종목"
      },
      {
        symbol: "KRX:035420",
        title: "NAVER",
        caption: "플랫폼 성장주",
        role: "성장주 온도 확인",
        summary: "국내 성장주 수급과 밸류에이션 선호를 읽기 좋은 종목"
      }
    ]
  },
  {
    id: "us",
    title: "미국주식 리더",
    description: "나스닥 대표 종목들을 함께 보며 미국 성장주와 위험 선호 흐름을 비교합니다.",
    focusHint: "NVDA와 MSFT가 안정적으로 강하면 미국 기술주 중심의 상승 흐름이 유지될 가능성이 높습니다.",
    checklist: [
      "리더 종목 동조화 여부",
      "갭 상승 뒤 종가까지 힘 유지 여부",
      "고베타 종목이 추세를 확장하는지 여부"
    ],
    charts: [
      {
        symbol: "NASDAQ:NVDA",
        title: "NVIDIA",
        caption: "AI 대표주",
        role: "성장주 모멘텀 리더",
        summary: "공격적인 기술주 심리를 가장 빠르게 반영하는 핵심 종목"
      },
      {
        symbol: "NASDAQ:TSLA",
        title: "Tesla",
        caption: "고변동 성장주",
        role: "리스크 온·오프 민감 종목",
        summary: "투자자의 공격성이 살아 있는지 읽기 좋은 대표 종목"
      },
      {
        symbol: "NASDAQ:MSFT",
        title: "Microsoft",
        caption: "대형 테크 안정축",
        role: "메가캡 안정감 확인",
        summary: "대형 성장주가 추세를 지지하는지 보기 좋은 기준점"
      }
    ]
  },
  {
    id: "macro",
    title: "매크로 흐름",
    description: "달러, 금, 원/달러 흐름은 한국주식과 미국주식 모두의 자금 흐름을 해석할 때 중요합니다.",
    focusHint: "달러와 원/달러가 함께 오르면 국내 자산에 부담이 커질 수 있어 주가 반응을 같이 봐야 합니다.",
    checklist: [
      "달러 강세 전환 지점",
      "금 상승과 위험자산 역행 여부",
      "환율 급등 시 국내주식 민감도"
    ],
    charts: [
      {
        symbol: "TVC:DXY",
        title: "Dollar Index",
        caption: "달러 강세 / 약세",
        role: "글로벌 자금 선호 지표",
        summary: "위험 자산과 반대 흐름이 자주 나오는 핵심 매크로 지표"
      },
      {
        symbol: "OANDA:XAUUSD",
        title: "Gold",
        caption: "방어 자산 수급",
        role: "피난처 심리 확인",
        summary: "불확실성이 커질 때 반응이 강하게 나타나는 자산"
      },
      {
        symbol: "FX_IDC:USDKRW",
        title: "USD/KRW",
        caption: "원화 민감도",
        role: "국내 자산 부담 점검",
        summary: "국내 시장 기준으로 자금 유출입 압력을 읽기 좋은 환율"
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
  const [selectedSymbol, setSelectedSymbol] = useState("KRX:005930");

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
          <p className={styles.controlLabel}>심볼 탭</p>
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
          <p className={styles.controlLabel}>시간프레임</p>
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
