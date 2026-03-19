import { AssetItem, SnapshotData, TickerItem } from "./marketTypes";

export const COPY = {
  unstableSource: "\uC77C\uBD80 \uB370\uC774\uD130 \uC18C\uC2A4\uAC00 \uC77C\uC2DC\uC801\uC73C\uB85C \uBD88\uC548\uC815\uD569\uB2C8\uB2E4.",
  networkError:
    "\uC2DC\uC7A5 \uC694\uC57D \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uC911 \uB124\uD2B8\uC6CC\uD06C \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.",
  title: "\uC2E4\uC2DC\uAC04 \uC2DC\uC7A5 \uC694\uC57D",
  description:
    "\uC624\uB298 \uD575\uC2EC \uC9C0\uD45C, \uC2DC\uADF8\uB110, \uC2E4\uC2DC\uAC04 \uD2F0\uCEE4\uB97C \uD55C\uB208\uC5D0 \uD655\uC778\uD558\uC138\uC694.",
  fearGreed: "\uACF5\uD3EC\u00B7\uD0D0\uC695 \uC9C0\uC218",
  volume: "24\uC2DC\uAC04 \uCF54\uC778 \uAC70\uB798\uB300\uAE08",
  signalTitle: "\uC54C\uB9BC \uC2DC\uADF8\uB110",
  liveLabel: "\uC2E4\uC2DC\uAC04 \uAC00\uACA9 \uBCC0\uB3D9",
  updatedAt: "\uC5C5\uB370\uC774\uD2B8",
  noSignal:
    "\uAC15\uD55C \uC2DC\uADF8\uB110\uC740 \uC544\uC9C1 \uC5C6\uC2B5\uB2C8\uB2E4. \uC2E4\uC2DC\uAC04 \uBCC0\uB3D9\uC744 \uBAA8\uB2C8\uD130\uB9C1 \uC911\uC785\uB2C8\uB2E4.",
  momentum: "\uC0C1\uC2B9 \uBAA8\uBA58\uD140",
  drop: "\uAE09\uB77D \uC2E0\uD638",
  overheat:
    "\uACF5\uD3EC\u00B7\uD0D0\uC695 \uC9C0\uC218 \uACFC\uC5F4",
  fearZone:
    "\uACF5\uD3EC\u00B7\uD0D0\uC695 \uC9C0\uC218 \uACF5\uD3EC \uAD6C\uAC04",
  overheatHint: "\uB2E8\uAE30 \uACFC\uC5F4 \uAC00\uB2A5\uC131",
  fearHint: "\uBCC0\uB3D9\uC131 \uC8FC\uC758"
} as const;

export const DEFAULT_ASSETS: AssetItem[] = [
  { symbol: "BTC", price: null, changePercent: null, currency: "USD" },
  { symbol: "ETH", price: null, changePercent: null, currency: "USD" },
  { symbol: "S&P 500", price: null, changePercent: null, currency: "USD" },
  { symbol: "NASDAQ", price: null, changePercent: null, currency: "USD" }
];

export const INITIAL_SNAPSHOT: SnapshotData = {
  assets: DEFAULT_ASSETS,
  fearGreed: null,
  cryptoVolumeUsd: null,
  warnings: [],
  updatedAt: null
};

export function formatMoney(value: number | null, currency = "USD") {
  if (typeof value !== "number") return "-";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value >= 1000 ? 0 : 2
  }).format(value);
}

export function formatPercent(value: number | null) {
  if (typeof value !== "number") return "-";

  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function buildSignals(snapshot: SnapshotData) {
  const list: string[] = [];

  snapshot.assets.forEach((asset) => {
    if (typeof asset.changePercent !== "number") return;

    if (asset.changePercent >= 3) {
      list.push(`${asset.symbol} ${COPY.momentum}: ${formatPercent(asset.changePercent)}`);
    } else if (asset.changePercent <= -3) {
      list.push(`${asset.symbol} ${COPY.drop}: ${formatPercent(asset.changePercent)}`);
    }
  });

  if (snapshot.fearGreed?.value >= 75) {
    list.push(`${COPY.overheat} (${snapshot.fearGreed.value}) - ${COPY.overheatHint}`);
  }

  if (snapshot.fearGreed?.value <= 25) {
    list.push(`${COPY.fearZone} (${snapshot.fearGreed.value}) - ${COPY.fearHint}`);
  }

  if (!list.length) {
    list.push(COPY.noSignal);
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
      price: item.price,
      changePercent: item.changePercent
    });
  });

  return Array.from(map.values());
}
