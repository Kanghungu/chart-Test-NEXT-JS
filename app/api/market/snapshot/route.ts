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
  const settled = await Promise.allSettled([
    fetchYahooSnapshot(),
    fetchFearGreedIndex(),
    fetchCryptoGlobalVolume()
  ]);

  const warnings: string[] = [];

  const assets =
    settled[0].status === "fulfilled"
      ? settled[0].value
      : TRACKED.map((item) => ({
          symbol: item.label,
          price: null,
          changePercent: null,
          volume: null,
          currency: "USD"
        }));

  if (settled[0].status === "rejected") {
    warnings.push("price_source_unavailable");
  }

  const fearGreed = settled[1].status === "fulfilled" ? settled[1].value : null;
  if (settled[1].status === "rejected") {
    warnings.push("fear_greed_unavailable");
  }

  const cryptoVolumeUsd = settled[2].status === "fulfilled" ? settled[2].value : null;
  if (settled[2].status === "rejected") {
    warnings.push("volume_source_unavailable");
  }

  return NextResponse.json({
    assets,
    fearGreed,
    cryptoVolumeUsd,
    warnings,
    updatedAt: new Date().toISOString()
  });
}
