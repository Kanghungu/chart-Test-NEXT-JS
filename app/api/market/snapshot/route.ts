import { NextResponse } from "next/server";

const TRACKED = [
  { symbol: "BTC", price: null, changePercent: null, volume: null, currency: "USD" },
  { symbol: "ETH", price: null, changePercent: null, volume: null, currency: "USD" },
  { symbol: "S&P 500", price: null, changePercent: null, volume: null, currency: "USD" },
  { symbol: "NASDAQ", price: null, changePercent: null, volume: null, currency: "USD" }
];

async function fetchCryptoBinanceSnapshot() {
  const url =
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true";
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`CoinGecko request failed: ${res.status}`);
  }

  const json = await res.json();
  const btc = json?.bitcoin;
  const eth = json?.ethereum;

  return [
    {
      symbol: "BTC",
      price: typeof btc?.usd === "number" ? btc.usd : null,
      changePercent: typeof btc?.usd_24h_change === "number" ? btc.usd_24h_change : null,
      volume: typeof btc?.usd_24h_vol === "number" ? btc.usd_24h_vol : null,
      currency: "USD"
    },
    {
      symbol: "ETH",
      price: typeof eth?.usd === "number" ? eth.usd : null,
      changePercent: typeof eth?.usd_24h_change === "number" ? eth.usd_24h_change : null,
      volume: typeof eth?.usd_24h_vol === "number" ? eth.usd_24h_vol : null,
      currency: "USD"
    }
  ];
}

async function fetchIndexesStooqSnapshot() {
  const res = await fetch("https://stooq.com/q/l/?s=%5Espx,%5Eixic&i=d", {
    cache: "no-store"
  });
  if (!res.ok) {
    throw new Error(`Stooq index request failed: ${res.status}`);
  }

  const csv = await res.text();
  const lines = csv.trim().split("\n");
  const dataLines = lines.slice(1);
  const parsed = dataLines.map((line) => line.split(","));
  const spx = parsed.find((cols) => cols[0]?.toUpperCase() === "^SPX");
  const ixic = parsed.find((cols) => cols[0]?.toUpperCase() === "^IXIC");

  const toRow = (label: string, row?: string[]) => {
    if (!row || row.length < 8) {
      return { symbol: label, price: null, changePercent: null, volume: null, currency: "USD" };
    }
    const open = Number(row[3]);
    const close = Number(row[6]);
    const volume = Number(row[7]);
    const valid = Number.isFinite(close) && close > 0;
    const changePercent = valid && Number.isFinite(open) && open > 0 ? ((close - open) / open) * 100 : null;

    return {
      symbol: label,
      price: valid ? close : null,
      changePercent,
      volume: Number.isFinite(volume) ? volume : null,
      currency: "USD"
    };
  };

  return [toRow("S&P 500", spx), toRow("NASDAQ", ixic)];
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
    fetchCryptoBinanceSnapshot(),
    fetchIndexesStooqSnapshot(),
    fetchFearGreedIndex(),
    fetchCryptoGlobalVolume()
  ]);

  const warnings: string[] = [];

  const cryptoAssets =
    settled[0].status === "fulfilled" ? settled[0].value : TRACKED.slice(0, 2);

  if (settled[0].status === "rejected") {
    warnings.push("crypto_price_source_unavailable");
  }

  let indexAssets: Array<{
    symbol: string;
    price: number | null;
    changePercent: number | null;
    volume: number | null;
    currency: string;
  }> = TRACKED.slice(2);

  if (settled[1].status === "fulfilled") {
    indexAssets = settled[1].value;
  } else {
    warnings.push("index_price_source_unavailable");
  }

  const assets = [...cryptoAssets, ...indexAssets];

  const fearGreed = settled[2].status === "fulfilled" ? settled[2].value : null;
  if (settled[2].status === "rejected") {
    warnings.push("fear_greed_unavailable");
  }

  const cryptoVolumeUsd = settled[3].status === "fulfilled" ? settled[3].value : null;
  if (settled[3].status === "rejected") {
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
