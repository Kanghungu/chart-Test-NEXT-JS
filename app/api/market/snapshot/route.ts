import { NextResponse } from "next/server";

const TRACKED = [
  { symbol: "BTC", price: null, changePercent: null, volume: null, currency: "USD" },
  { symbol: "ETH", price: null, changePercent: null, volume: null, currency: "USD" },
  { symbol: "S&P 500", price: null, changePercent: null, volume: null, currency: "USD" },
  { symbol: "NASDAQ", price: null, changePercent: null, volume: null, currency: "USD" }
];

async function fetchCryptoBinanceSnapshot() {
  const symbols = ["BTCUSDT", "ETHUSDT"];
  const rows = await Promise.all(
    symbols.map(async (symbol) => {
      const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`Binance request failed: ${res.status}`);
      }
      return res.json();
    })
  );

  return [
    {
      symbol: "BTC",
      price: Number(rows[0]?.lastPrice ?? null),
      changePercent: Number(rows[0]?.priceChangePercent ?? null),
      volume: Number(rows[0]?.quoteVolume ?? null),
      currency: "USD"
    },
    {
      symbol: "ETH",
      price: Number(rows[1]?.lastPrice ?? null),
      changePercent: Number(rows[1]?.priceChangePercent ?? null),
      volume: Number(rows[1]?.quoteVolume ?? null),
      currency: "USD"
    }
  ];
}

async function fetchIndexesYahooSnapshot() {
  const url =
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EGSPC,%5EIXIC";
  const res = await fetch(url, {
    cache: "no-store",
    headers: {
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      accept: "application/json,text/plain,*/*"
    }
  });

  if (!res.ok) {
    throw new Error(`Yahoo index request failed: ${res.status}`);
  }

  const json = await res.json();
  const rows = json?.quoteResponse?.result || [];

  const spx = rows.find((item) => item.symbol === "^GSPC");
  const ixic = rows.find((item) => item.symbol === "^IXIC");

  return [
    {
      symbol: "S&P 500",
      price: spx?.regularMarketPrice ?? null,
      changePercent: spx?.regularMarketChangePercent ?? null,
      volume: spx?.regularMarketVolume ?? null,
      currency: spx?.currency ?? "USD"
    },
    {
      symbol: "NASDAQ",
      price: ixic?.regularMarketPrice ?? null,
      changePercent: ixic?.regularMarketChangePercent ?? null,
      volume: ixic?.regularMarketVolume ?? null,
      currency: ixic?.currency ?? "USD"
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
    fetchIndexesYahooSnapshot(),
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
    try {
      indexAssets = await fetchIndexesStooqSnapshot();
      warnings.push("index_price_fallback_stooq");
    } catch {
      warnings.push("index_price_fallback_failed");
    }
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
