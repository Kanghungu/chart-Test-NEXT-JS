import { AssetItem, SnapshotData, TickerItem } from "./marketTypes";
import type { SessionRiskPayload } from "@/lib/macroQuotes";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { Language } from "@/components/i18n/LanguageProvider";

export function getMarketCopy(language: Language) {
  return language === "ko"
    ? {
        unstableSource: "일부 데이터 소스가 일시적으로 불안정합니다.",
        networkError: "시장 요약 데이터를 불러오는 중 네트워크 오류가 발생했습니다.",
        title: "실시간 시장 요약",
        description: "한국주식과 미국주식의 핵심 지표를 한 번에 확인하세요.",
        fearGreed: "시장 심리 지수",
        koreaFearGreed: "한국주식 심리 지수",
        stockFearGreed: "미국주식 심리 지수",
        volume: "대표 한국주식 거래대금",
        signalTitle: "시그널 알림",
        liveLabel: "실시간 가격 변동",
        updatedAt: "업데이트",
        noSignal: "강한 시그널이 아직 없습니다. 실시간 변동을 계속 추적 중입니다.",
        macroRailTitle: "거시 레일 (원·달러·금리)",
        riskStripTitle: "변동성 · 미국 선물",
        momentum: "강세",
        drop: "약세",
        overheat: "심리 과열",
        fearZone: "심리 공포",
        overheatHint: "단기 과열 가능성",
        fearHint: "변동성 주의"
      }
    : {
        unstableSource: "Some data sources are temporarily unstable.",
        networkError: "A network error occurred while loading the market overview.",
        title: "Real-time Market Overview",
        description: "Track Korean and US equity signals at a glance.",
        fearGreed: "Market Sentiment",
        koreaFearGreed: "Korean Stock Sentiment",
        stockFearGreed: "US Stock Sentiment",
        volume: "Korean Leader Trading Value",
        signalTitle: "Signal Alerts",
        liveLabel: "Live Price Moves",
        updatedAt: "Updated",
        noSignal: "No strong signal yet. Live moves are still being monitored.",
        macroRailTitle: "Macro rail (FX & rates)",
        riskStripTitle: "Volatility · US futures",
        momentum: "momentum",
        drop: "drop signal",
        overheat: "sentiment overheating",
        fearZone: "sentiment fear zone",
        overheatHint: "possible short-term overheating",
        fearHint: "watch volatility"
      };
}

export const DEFAULT_ASSETS: AssetItem[] = [
  { symbol: "KOSPI", price: null, changePercent: null, currency: "KRW" },
  { symbol: "KOSDAQ", price: null, changePercent: null, currency: "KRW" },
  { symbol: "S&P 500", price: null, changePercent: null, currency: "USD" },
  { symbol: "NASDAQ", price: null, changePercent: null, currency: "USD" }
];

const EMPTY_SESSION_RISK: SessionRiskPayload = {
  vix: { price: null, changePercent: null },
  esFuture: { price: null, changePercent: null },
  nqFuture: { price: null, changePercent: null }
};

export const INITIAL_SNAPSHOT: SnapshotData = {
  assets: DEFAULT_ASSETS,
  fearGreed: null,
  koreaFearGreed: null,
  stockFearGreed: null,
  koreaTradingValue: null,
  macroRail: [],
  sessionRisk: EMPTY_SESSION_RISK,
  warnings: [],
  updatedAt: null
};

export const formatMoney = formatCurrency;
export { formatPercent };

/** 거시 타일 라벨 (한/영) */
export function getMacroQuoteLabel(id: string, language: Language) {
  const labelsKo: Record<string, string> = {
    usdkrw: "USD/KRW",
    dxy: "달러 인덱스 (DXY)",
    us10y: "미국 10년 금리",
    kr10y: "한국 10년 금리"
  };

  const labelsEn: Record<string, string> = {
    usdkrw: "USD/KRW",
    dxy: "US Dollar Index (DXY)",
    us10y: "US 10-year yield",
    kr10y: "Korea 10-year yield"
  };

  const table = language === "ko" ? labelsKo : labelsEn;
  return table[id] || id;
}

/** VIX·선물 줄 라벨 */
export function getRiskStripLabels(language: Language) {
  return language === "ko"
    ? { vix: "VIX", es: "S&P 미니 선물", nq: "나스닥 미니 선물" }
    : { vix: "VIX", es: "S&P 500 futures", nq: "Nasdaq futures" };
}

export function getLocalizedSentimentLabel(
  classification: string | null | undefined,
  language: Language
) {
  if (!classification) return "-";

  if (language === "en") return classification;

  switch (classification) {
    case "Extreme Fear":
      return "극도의 공포";
    case "Fear":
      return "공포";
    case "Neutral":
      return "중립";
    case "Greed":
      return "탐욕";
    case "Extreme Greed":
      return "극도의 탐욕";
    default:
      return classification;
  }
}

export function buildSignals(snapshot: SnapshotData) {
  const copy = getMarketCopy("ko");
  const list: string[] = [];

  snapshot.assets.forEach((asset) => {
    if (typeof asset.changePercent !== "number") return;

    if (asset.changePercent >= 3) {
      list.push(`${asset.symbol} ${copy.momentum}: ${formatPercent(asset.changePercent)}`);
    } else if (asset.changePercent <= -3) {
      list.push(`${asset.symbol} ${copy.drop}: ${formatPercent(asset.changePercent)}`);
    }
  });

  if (snapshot.koreaFearGreed?.value >= 75) {
    list.push(`${copy.overheat} (${snapshot.koreaFearGreed.value}) - ${copy.overheatHint}`);
  }

  if (snapshot.koreaFearGreed?.value <= 25) {
    list.push(`${copy.fearZone} (${snapshot.koreaFearGreed.value}) - ${copy.fearHint}`);
  }

  if (!list.length) {
    list.push(copy.noSignal);
  }

  return list.slice(0, 4);
}

export function buildSignalsByLanguage(snapshot: SnapshotData, language: Language) {
  const copy = getMarketCopy(language);
  const list: string[] = [];

  snapshot.assets.forEach((asset) => {
    if (typeof asset.changePercent !== "number") return;

    if (asset.changePercent >= 3) {
      list.push(`${asset.symbol} ${copy.momentum}: ${formatPercent(asset.changePercent)}`);
    } else if (asset.changePercent <= -3) {
      list.push(`${asset.symbol} ${copy.drop}: ${formatPercent(asset.changePercent)}`);
    }
  });

  if (snapshot.koreaFearGreed?.value >= 75) {
    list.push(`${copy.overheat} (${snapshot.koreaFearGreed.value}) - ${copy.overheatHint}`);
  }

  if (snapshot.koreaFearGreed?.value <= 25) {
    list.push(`${copy.fearZone} (${snapshot.koreaFearGreed.value}) - ${copy.fearHint}`);
  }

  if (!list.length) {
    list.push(copy.noSignal);
  }

  return list.slice(0, 4);
}

export function buildTickerSeed(assets: AssetItem[]): TickerItem[] {
  return assets.map((item) => ({
    symbol: item.symbol,
    name: item.symbol,
    price: item.price,
    changePercent: item.changePercent
  }));
}

export function mergeTickerItems(prev: TickerItem[], next: TickerItem[]) {
  const map = new Map<string, TickerItem>();

  [...prev, ...next].forEach((item) => {
    if (!item?.symbol) return;

    map.set(item.symbol, {
      symbol: item.symbol,
      name: item.name || item.symbol,
      nameKo: item.nameKo,
      nameEn: item.nameEn,
      price: item.price,
      changePercent: item.changePercent
    });
  });

  return Array.from(map.values());
}
