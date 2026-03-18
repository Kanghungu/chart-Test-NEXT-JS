import { NextResponse } from "next/server";

const TRACKED = [
  { symbol: "BTC-USD", label: "BTC" },
  { symbol: "ETH-USD", label: "ETH" },
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "NASDAQ" }
];

async function fetchYahooSnapshot() {
  const symbols = TRACKED.map((item) => item.symbol).join(",");
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
  const res = await fetch(url, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Yahoo Finance request failed: ${res.status}`);
  }

  const json = await res.json();
  const rows = json?.quoteResponse?.result || [];

  return TRACKED.map((target) => {
    const row = rows.find((item) => item.symbol === target.symbol);
    return {
      symbol: target.label,
      price: row?.regularMarketPrice ?? null,
      changePercent: row?.regularMarketChangePercent ?? null,
      volume: row?.regularMarketVolume ?? null,
      currency: row?.currency ?? null
    };
  });
}

async function fetchFearGreedIndex() {
  const res = await fetch("https://api.alternative.me/fng/?limit=1", { cache: "no-store" });
  if (!res.ok) {
    return null;
  }

  const json = await res.json();
  const item = json?.data?.[0];
  if (!item) {
    return null;
  }

  return {
    value: Number(item.value),
    classification: item.value_classification ?? "Unknown"
  };
}

async function fetchCryptoGlobalVolume() {
  const res = await fetch("https://api.coingecko.com/api/v3/global", { cache: "no-store" });
  if (!res.ok) {
    return null;
  }

  const json = await res.json();
  const volumeUsd = json?.data?.total_volume?.usd;
  return typeof volumeUsd === "number" ? volumeUsd : null;
}

export async function GET() {
  try {
    const [assets, fearGreed, cryptoVolumeUsd] = await Promise.all([
      fetchYahooSnapshot(),
      fetchFearGreedIndex(),
      fetchCryptoGlobalVolume()
    ]);

    return NextResponse.json({
      assets,
      fearGreed,
      cryptoVolumeUsd,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load market snapshot"
      },
      { status: 500 }
    );
  }
}
