import { NextRequest, NextResponse } from "next/server";

export const revalidate = 10;
export const dynamic = "force-dynamic";

const ALLOWED_SYMBOLS = new Set(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"]);
const ALLOWED_INTERVALS = new Set(["1m", "5m", "15m", "30m"]);

type BinanceKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string,
];

type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type MarketContext = {
  candles: Candle[];
  currentPrice: number | null;
  source: string;
};

function cleanSymbol(value: string | null): string {
  const symbol = (value ?? "BTCUSDT").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return ALLOWED_SYMBOLS.has(symbol) ? symbol : "BTCUSDT";
}

function cleanInterval(value: string | null): string {
  const interval = value ?? "5m";
  return ALLOWED_INTERVALS.has(interval) ? interval : "5m";
}

function cleanLimit(value: string | null): number {
  const parsed = Number(value ?? 48);
  if (!Number.isFinite(parsed)) return 48;
  return Math.max(1, Math.min(300, Math.trunc(parsed)));
}

async function fetchBinanceContext(
  symbol: string,
  interval: string,
  limit: number,
): Promise<MarketContext | null> {
  const [klinesRes, premiumRes] = await Promise.all([
    fetch(
      `https://fapi.binance.com/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    ),
    fetch(
      `https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    ),
  ]);

  if (!klinesRes.ok || !premiumRes.ok) return null;

  const raw = (await klinesRes.json()) as BinanceKline[];
  const premium = (await premiumRes.json()) as { markPrice?: string };
  const currentPrice = Number(premium.markPrice);

  return {
    source: "binance",
    candles: raw.map((k) => ({
      openTime: Number(k[0]),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
    })),
    currentPrice: Number.isFinite(currentPrice) ? currentPrice : null,
  };
}

async function fetchBybitContext(
  symbol: string,
  interval: string,
  limit: number,
): Promise<MarketContext | null> {
  const bybitInterval = interval.replace("m", "");
  const [klinesRes, tickerRes] = await Promise.all([
    fetch(
      `https://api.bybit.com/v5/market/kline?category=linear&symbol=${symbol}&interval=${bybitInterval}&limit=${limit}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    ),
    fetch(
      `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${symbol}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    ),
  ]);

  if (!klinesRes.ok || !tickerRes.ok) return null;

  const klines = (await klinesRes.json()) as {
    retCode?: number;
    result?: { list?: string[][] };
  };
  const ticker = (await tickerRes.json()) as {
    retCode?: number;
    result?: { list?: Array<{ markPrice?: string; lastPrice?: string }> };
  };
  const raw = klines.result?.list;
  if (klines.retCode !== 0 || !Array.isArray(raw) || raw.length === 0) return null;

  const item = ticker.result?.list?.[0];
  const markPrice = Number(item?.markPrice ?? item?.lastPrice);

  return {
    source: "bybit",
    candles: raw.slice().reverse().map((k) => ({
      openTime: Number(k[0]),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
    })),
    currentPrice: Number.isFinite(markPrice) ? markPrice : null,
  };
}

async function fetchOkxContext(
  symbol: string,
  interval: string,
  limit: number,
): Promise<MarketContext | null> {
  const base = symbol.replace("USDT", "");
  const instId = `${base}-USDT-SWAP`;
  const [candlesRes, markRes] = await Promise.all([
    fetch(
      `https://www.okx.com/api/v5/market/candles?instId=${instId}&bar=${interval}&limit=${limit}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    ),
    fetch(
      `https://www.okx.com/api/v5/public/mark-price?instType=SWAP&instId=${instId}`,
      { cache: "no-store", signal: AbortSignal.timeout(6000) },
    ),
  ]);

  if (!candlesRes.ok || !markRes.ok) return null;

  const candles = (await candlesRes.json()) as {
    code?: string;
    data?: string[][];
  };
  const mark = (await markRes.json()) as {
    code?: string;
    data?: Array<{ markPx?: string }>;
  };
  if (candles.code !== "0" || !Array.isArray(candles.data) || candles.data.length === 0) {
    return null;
  }

  const markPrice = Number(mark.data?.[0]?.markPx);

  return {
    source: "okx",
    candles: candles.data.slice().reverse().map((k) => ({
      openTime: Number(k[0]),
      open: Number(k[1]),
      high: Number(k[2]),
      low: Number(k[3]),
      close: Number(k[4]),
    })),
    currentPrice: Number.isFinite(markPrice) ? markPrice : null,
  };
}

async function tryContext(
  fetcher: () => Promise<MarketContext | null>,
): Promise<MarketContext | null> {
  try {
    return await fetcher();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const symbol = cleanSymbol(searchParams.get("symbol"));
  const interval = cleanInterval(searchParams.get("interval"));
  const limit = cleanLimit(searchParams.get("limit"));

  try {
    const context = await tryContext(() => fetchBinanceContext(symbol, interval, limit))
      ?? await tryContext(() => fetchBybitContext(symbol, interval, limit))
      ?? await tryContext(() => fetchOkxContext(symbol, interval, limit));

    if (!context) {
      return NextResponse.json(
        { error: "Failed to fetch liquidation context", candles: [], currentPrice: null },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        symbol,
        interval,
        source: context.source,
        candles: context.candles,
        currentPrice: context.currentPrice,
        fetchedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "s-maxage=10, stale-while-revalidate=20",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load liquidation context";

    return NextResponse.json(
      { error: message, candles: [], currentPrice: null },
      { status: 502 },
    );
  }
}
