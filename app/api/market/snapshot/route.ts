import { NextResponse } from "next/server";

const TRACKED = [
  { symbol: "BTC", price: null, changePercent: null, volume: null, currency: "USD" },
  { symbol: "ETH", price: null, changePercent: null, volume: null, currency: "USD" },
  { symbol: "S&P 500", price: null, changePercent: null, volume: null, currency: "USD" },
  { symbol: "NASDAQ", price: null, changePercent: null, volume: null, currency: "USD" }
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function classifyFearGreed(value: number) {
  if (value <= 24) return "Extreme Fear";
  if (value <= 44) return "Fear";
  if (value <= 55) return "Neutral";
  if (value <= 74) return "Greed";
  return "Extreme Greed";
}

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

async function fetchIndexesYahooSnapshot() {
  type YahooQuoteRow = {
    symbol?: string;
    regularMarketPrice?: number;
    regularMarketChangePercent?: number;
  };

  const res = await fetch(
    "https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EGSPC,%5EIXIC",
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error(`Yahoo index request failed: ${res.status}`);
  }

  const json = await res.json();
  const rows = json?.quoteResponse?.result as YahooQuoteRow[] | undefined;
  if (!Array.isArray(rows)) {
    throw new Error("Yahoo index payload malformed");
  }

  const spx = rows.find((r) => r?.symbol === "^GSPC");
  const ixic = rows.find((r) => r?.symbol === "^IXIC");

  const toRow = (label: string, row?: YahooQuoteRow) => {
    const price = typeof row?.regularMarketPrice === "number" ? row.regularMarketPrice : null;
    const changePercent =
      typeof row?.regularMarketChangePercent === "number"
        ? row.regularMarketChangePercent
        : null;

    return {
      symbol: label,
      price,
      changePercent,
      volume: null,
      currency: "USD"
    };
  };

  return [toRow("S&P 500", spx), toRow("NASDAQ", ixic)];
}

async function fetchIndexesSnapshot() {
  try {
    return await fetchIndexesYahooSnapshot();
  } catch {
    return await fetchIndexesStooqSnapshot();
  }
}

async function fetchStockLeadersSnapshot() {
  const res = await fetch("https://stooq.com/q/l/?s=aapl.us,msft.us,nvda.us,tsla.us&i=d", {
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`Stooq stock request failed: ${res.status}`);
  }

  const csv = await res.text();
  const lines = csv.trim().split("\n").slice(1);

  return lines
    .map((line) => line.split(","))
    .map((cols) => {
      const symbol = cols[0]?.replace(".US", "").toUpperCase();
      const open = Number(cols[3]);
      const close = Number(cols[6]);
      const valid = Number.isFinite(close) && close > 0;
      const changePercent =
        valid && Number.isFinite(open) && open > 0 ? ((close - open) / open) * 100 : null;

      return {
        symbol,
        changePercent
      };
    })
    .filter((item) => item.symbol);
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

function deriveStockFearGreed(
  indexAssets: Array<{ changePercent: number | null }>,
  stockLeaders: Array<{ changePercent: number | null }>
) {
  const changes = [...indexAssets, ...stockLeaders]
    .map((item) => item.changePercent)
    .filter((value): value is number => typeof value === "number");

  if (!changes.length) {
    return null;
  }

  const averageChange = changes.reduce((sum, value) => sum + value, 0) / changes.length;
  const advancingRatio = changes.filter((value) => value > 0).length / changes.length;
  const score = clamp(Math.round(50 + averageChange * 10 + (advancingRatio - 0.5) * 35), 0, 100);

  return {
    value: score,
    classification: classifyFearGreed(score)
  };
}

export async function GET() {
  const settled = await Promise.allSettled([
    fetchCryptoBinanceSnapshot(),
    fetchIndexesSnapshot(),
    fetchFearGreedIndex(),
    fetchCryptoGlobalVolume(),
    fetchStockLeadersSnapshot()
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

  const stockLeaders =
    settled[4].status === "fulfilled" ? settled[4].value : [];
  if (settled[4].status === "rejected") {
    warnings.push("stock_sentiment_source_unavailable");
  }

  const stockFearGreed = deriveStockFearGreed(indexAssets, stockLeaders);

  return NextResponse.json({
    assets,
    fearGreed,
    cryptoFearGreed: fearGreed,
    stockFearGreed,
    cryptoVolumeUsd,
    warnings,
    updatedAt: new Date().toISOString()
  });
}
