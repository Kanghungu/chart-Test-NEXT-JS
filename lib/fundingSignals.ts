/**
 * Multi-exchange funding rate & open interest scanner.
 * Public endpoints only; no API key is required.
 */

export type ExchangeId = "binance" | "bybit" | "okx";

export type FundingLevel =
  | "EXTREME_BULL"
  | "HIGH_BULL"
  | "NEUTRAL"
  | "HIGH_BEAR"
  | "EXTREME_BEAR";

export type OITrend =
  | "RISING_FAST"
  | "RISING"
  | "FLAT"
  | "FALLING"
  | "FALLING_FAST";

export type ExchangeFundingRow = {
  exchange: ExchangeId;
  exchangeLabel: string;
  symbol: string;
  base: string;
  fundingRate: number;
  markPrice: number;
  nextFundingTime: number;
  oiUSD: number;
  oiChange1hPct: number;
  frLevel: FundingLevel;
  oiTrend: OITrend;
};

export type FundingRow = {
  symbol: string;
  base: string;
  exchanges: ExchangeFundingRow[];
  availableCount: number;
  fundingRate: number;
  markPrice: number;
  nextFundingTime: number;
  oiUSD: number;
  oiChange1hPct: number;
  frLevel: FundingLevel;
  oiTrend: OITrend;
};

type ExchangeConfig = {
  id: ExchangeId;
  label: string;
  fetcher: (symbol: string) => Promise<ExchangeFundingRow | null>;
};

export const EXCHANGE_LABELS: Record<ExchangeId, string> = {
  binance: "Binance",
  bybit: "Bybit",
  okx: "OKX",
};

const FUTURES_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT",
  "ADAUSDT", "DOGEUSDT", "LTCUSDT", "TAOUSDT", "WLDUSDT",
  "ENAUSDT", "MAGICUSDT", "VIRTUALUSDT", "TURBOUSDT",
];

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

function finiteNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : parseFloat(String(value));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function toFRLevel(fr: number): FundingLevel {
  if (fr >= 0.001) return "EXTREME_BEAR";
  if (fr >= 0.0005) return "HIGH_BEAR";
  if (fr <= -0.001) return "EXTREME_BULL";
  if (fr <= -0.0005) return "HIGH_BULL";
  return "NEUTRAL";
}

function toOITrend(changePct: number): OITrend {
  if (!Number.isFinite(changePct)) return "FLAT";
  if (changePct >= 5) return "RISING_FAST";
  if (changePct >= 2) return "RISING";
  if (changePct <= -5) return "FALLING_FAST";
  if (changePct <= -2) return "FALLING";
  return "FLAT";
}

function buildExchangeRow(
  exchange: ExchangeId,
  symbol: string,
  fundingRate: number,
  markPrice: number,
  nextFundingTime: number,
  oiUSD: number,
  oiChange1hPct: number,
): ExchangeFundingRow | null {
  if (!Number.isFinite(fundingRate)) return null;

  return {
    exchange,
    exchangeLabel: EXCHANGE_LABELS[exchange],
    symbol,
    base: symbol.replace("USDT", ""),
    fundingRate,
    markPrice,
    nextFundingTime,
    oiUSD,
    oiChange1hPct,
    frLevel: toFRLevel(fundingRate),
    oiTrend: toOITrend(oiChange1hPct),
  };
}

async function fetchBinanceFunding(symbol: string): Promise<ExchangeFundingRow | null> {
  const [premium, oiHist] = await Promise.all([
    fetchJSON<{
      lastFundingRate: string;
      markPrice: string;
      nextFundingTime: number;
    }>(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`),
    fetchJSON<Array<{
      sumOpenInterestValue: string;
      timestamp: number;
    }>>(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=2`),
  ]);

  if (!premium || !("lastFundingRate" in premium)) return null;

  let oiUSD = NaN;
  let oiChange1hPct = NaN;

  if (oiHist && oiHist.length >= 2) {
    const [prev, curr] = oiHist;
    oiUSD = finiteNumber(curr.sumOpenInterestValue);
    const prevVal = finiteNumber(prev.sumOpenInterestValue);
    if (prevVal > 0) oiChange1hPct = ((oiUSD - prevVal) / prevVal) * 100;
  } else if (oiHist && oiHist.length === 1) {
    oiUSD = finiteNumber(oiHist[0].sumOpenInterestValue);
  }

  return buildExchangeRow(
    "binance",
    symbol,
    finiteNumber(premium.lastFundingRate),
    finiteNumber(premium.markPrice),
    premium.nextFundingTime,
    oiUSD,
    oiChange1hPct,
  );
}

async function fetchBybitFunding(symbol: string): Promise<ExchangeFundingRow | null> {
  const [ticker, oiHist] = await Promise.all([
    fetchJSON<{
      retCode: number;
      result?: {
        list?: Array<{
          fundingRate?: string;
          markPrice?: string;
          nextFundingTime?: string;
          openInterest?: string;
          openInterestValue?: string;
        }>;
      };
    }>(`https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`),
    fetchJSON<{
      retCode: number;
      result?: {
        list?: Array<{ openInterest: string; timestamp: string }>;
      };
    }>(`https://api.bybit.com/v5/market/open-interest?category=linear&symbol=${symbol}&intervalTime=1h&limit=2`),
  ]);

  const item = ticker?.result?.list?.[0];
  if (!item) return null;

  const markPrice = finiteNumber(item.markPrice);
  const openInterestValue = finiteNumber(item.openInterestValue);
  const openInterest = finiteNumber(item.openInterest);
  let oiUSD = Number.isFinite(openInterestValue)
    ? openInterestValue
    : openInterest * markPrice;
  let oiChange1hPct = NaN;

  const oiList = oiHist?.result?.list;
  if (oiList && oiList.length >= 2) {
    const sorted = [...oiList].sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
    const prev = finiteNumber(sorted[0].openInterest);
    const curr = finiteNumber(sorted[sorted.length - 1].openInterest);
    if (prev > 0) oiChange1hPct = ((curr - prev) / prev) * 100;
    if (!Number.isFinite(oiUSD)) oiUSD = curr * markPrice;
  }

  return buildExchangeRow(
    "bybit",
    symbol,
    finiteNumber(item.fundingRate),
    markPrice,
    finiteNumber(item.nextFundingTime),
    oiUSD,
    oiChange1hPct,
  );
}

async function fetchOkxFunding(symbol: string): Promise<ExchangeFundingRow | null> {
  const instId = symbol.replace("USDT", "-USDT-SWAP");
  const [funding, mark, openInterest] = await Promise.all([
    fetchJSON<{
      data?: Array<{ fundingRate?: string; nextFundingTime?: string }>;
    }>(`https://www.okx.com/api/v5/public/funding-rate?instId=${instId}`),
    fetchJSON<{
      data?: Array<{ markPx?: string }>;
    }>(`https://www.okx.com/api/v5/public/mark-price?instType=SWAP&instId=${instId}`),
    fetchJSON<{
      data?: Array<{ oi?: string; oiCcy?: string; ts?: string }>;
    }>(`https://www.okx.com/api/v5/public/open-interest?instType=SWAP&instId=${instId}`),
  ]);

  const fundingItem = funding?.data?.[0];
  const markPrice = finiteNumber(mark?.data?.[0]?.markPx);
  const oiItem = openInterest?.data?.[0];
  const oiCcy = finiteNumber(oiItem?.oiCcy);
  const contracts = finiteNumber(oiItem?.oi);
  const oiUSD = Number.isFinite(oiCcy)
    ? oiCcy * markPrice
    : contracts * markPrice;

  if (!fundingItem) return null;

  return buildExchangeRow(
    "okx",
    symbol,
    finiteNumber(fundingItem.fundingRate),
    markPrice,
    finiteNumber(fundingItem.nextFundingTime),
    oiUSD,
    NaN,
  );
}

const EXCHANGES: ExchangeConfig[] = [
  { id: "binance", label: EXCHANGE_LABELS.binance, fetcher: fetchBinanceFunding },
  { id: "bybit", label: EXCHANGE_LABELS.bybit, fetcher: fetchBybitFunding },
  { id: "okx", label: EXCHANGE_LABELS.okx, fetcher: fetchOkxFunding },
];

function average(values: number[]): number {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return NaN;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function sum(values: number[]): number {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return NaN;
  return finite.reduce((total, value) => total + value, 0);
}

async function fetchFundingRow(symbol: string): Promise<FundingRow | null> {
  const settled = await Promise.all(EXCHANGES.map((exchange) => exchange.fetcher(symbol)));
  const exchanges = settled.filter((row): row is ExchangeFundingRow => row !== null);
  if (exchanges.length === 0) return null;

  const fundingRate = average(exchanges.map((row) => row.fundingRate));
  const markPrice = exchanges.find((row) => Number.isFinite(row.markPrice))?.markPrice ?? NaN;
  const futureFundingTimes = exchanges
    .map((row) => row.nextFundingTime)
    .filter((time) => Number.isFinite(time) && time > Date.now());
  const nextFundingTime = futureFundingTimes.length > 0
    ? Math.min(...futureFundingTimes)
    : exchanges[0].nextFundingTime;
  const oiUSD = sum(exchanges.map((row) => row.oiUSD));
  const oiChange1hPct = average(exchanges.map((row) => row.oiChange1hPct));

  return {
    symbol,
    base: symbol.replace("USDT", ""),
    exchanges,
    availableCount: exchanges.length,
    fundingRate,
    markPrice,
    nextFundingTime,
    oiUSD,
    oiChange1hPct,
    frLevel: toFRLevel(fundingRate),
    oiTrend: toOITrend(oiChange1hPct),
  };
}

/** Fetch all rows; sort by market-cap rank (FUTURES_SYMBOLS order). */
export async function scanFunding(
  symbols: string[] = FUTURES_SYMBOLS,
): Promise<FundingRow[]> {
  const rankMap = new Map(symbols.map((s, i) => [s, i]));
  const results = await Promise.all(symbols.map(fetchFundingRow));
  return results
    .filter((row): row is FundingRow => row !== null)
    .sort((a, b) => (rankMap.get(a.symbol) ?? 999) - (rankMap.get(b.symbol) ?? 999));
}

export function formatFR(fr: number): string {
  if (!Number.isFinite(fr)) return "N/A";
  return (fr * 100).toFixed(4) + "%";
}

export function formatOI(usd: number): string {
  if (!Number.isFinite(usd)) return "N/A";
  if (usd >= 1e9) return (usd / 1e9).toFixed(2) + "B";
  if (usd >= 1e6) return (usd / 1e6).toFixed(1) + "M";
  return usd.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatPrice(price: number): string {
  if (!Number.isFinite(price)) return "N/A";
  if (price >= 1000) return price.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(3);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}
