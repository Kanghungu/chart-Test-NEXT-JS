import { AssetItem, SnapshotData, TickerItem } from "./marketTypes";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { Language } from "@/components/i18n/LanguageProvider";

export function getMarketCopy(language: Language) {
  return language === "ko"
    ? {
        unstableSource: "일부 데이터 소스가 일시적으로 불안정합니다.",
        networkError: "시장 요약 데이터를 불러오는 중 네트워크 오류가 발생했습니다.",
        title: "실시간 시장 요약",
        description: "오늘 핵심 지표, 시그널, 실시간 티커를 한눈에 확인하세요.",
        fearGreed: "공포·탐욕 지수",
        cryptoFearGreed: "코인 공포·탐욕 지수",
        stockFearGreed: "미국 주식 공포·탐욕 지수",
        volume: "24시간 코인 거래대금",
        signalTitle: "알림 시그널",
        liveLabel: "실시간 가격 변동",
        updatedAt: "업데이트",
        noSignal: "강한 시그널은 아직 없습니다. 실시간 변동을 모니터링 중입니다.",
        momentum: "상승 모멘텀",
        drop: "하락 신호",
        overheat: "공포·탐욕 과열",
        fearZone: "공포·탐욕 공포 구간",
        overheatHint: "단기 과열 가능성",
        fearHint: "변동성 주의"
      }
    : {
        unstableSource: "Some data sources are temporarily unstable.",
        networkError: "A network error occurred while loading the market overview.",
        title: "Real-time Market Overview",
        description: "Track today's key indicators, signals, and live ticker moves at a glance.",
        fearGreed: "Fear & Greed Index",
        cryptoFearGreed: "Crypto Fear & Greed",
        stockFearGreed: "US Stock Fear & Greed",
        volume: "24H Crypto Volume",
        signalTitle: "Signal Alerts",
        liveLabel: "Live Price Moves",
        updatedAt: "Updated",
        noSignal: "No strong signal yet. Live moves are still being monitored.",
        momentum: "momentum",
        drop: "drop signal",
        overheat: "Fear & Greed overheating",
        fearZone: "Fear & Greed fear zone",
        overheatHint: "possible short-term overheating",
        fearHint: "watch volatility"
      };
}

export const DEFAULT_ASSETS: AssetItem[] = [
  { symbol: "BTC", price: null, changePercent: null, currency: "USD" },
  { symbol: "ETH", price: null, changePercent: null, currency: "USD" },
  { symbol: "S&P 500", price: null, changePercent: null, currency: "USD" },
  { symbol: "NASDAQ", price: null, changePercent: null, currency: "USD" }
];

export const INITIAL_SNAPSHOT: SnapshotData = {
  assets: DEFAULT_ASSETS,
  fearGreed: null,
  cryptoFearGreed: null,
  stockFearGreed: null,
  cryptoVolumeUsd: null,
  warnings: [],
  updatedAt: null
};

export const formatMoney = formatCurrency;
export { formatPercent };

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

  if (snapshot.cryptoFearGreed?.value >= 75) {
    list.push(`${copy.overheat} (${snapshot.cryptoFearGreed.value}) - ${copy.overheatHint}`);
  }

  if (snapshot.cryptoFearGreed?.value <= 25) {
    list.push(`${copy.fearZone} (${snapshot.cryptoFearGreed.value}) - ${copy.fearHint}`);
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

  if (snapshot.cryptoFearGreed?.value >= 75) {
    list.push(`${copy.overheat} (${snapshot.cryptoFearGreed.value}) - ${copy.overheatHint}`);
  }

  if (snapshot.cryptoFearGreed?.value <= 25) {
    list.push(`${copy.fearZone} (${snapshot.cryptoFearGreed.value}) - ${copy.fearHint}`);
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
