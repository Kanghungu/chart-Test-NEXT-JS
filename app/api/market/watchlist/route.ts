import { NextResponse } from "next/server";

type WatchItem = {
  symbol: string;
  name: string;
  group: "crypto" | "stock";
  price: number | null;
  changePercent: number | null;
};

async function fetchCrypto() {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,dogecoin&vs_currencies=usd&include_24hr_change=true",
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error(`CoinGecko failed: ${res.status}`);
  }

  const json = await res.json();

  const row = (id: string, symbol: string, name: string): WatchItem => ({
    symbol,
    name,
    group: "crypto",
    price: typeof json?.[id]?.usd === "number" ? json[id].usd : null,
    changePercent:
      typeof json?.[id]?.usd_24h_change === "number" ? json[id].usd_24h_change : null
  });

  return [
    row("bitcoin", "BTC", "비트코인"),
    row("ethereum", "ETH", "이더리움"),
    row("solana", "SOL", "솔라나"),
    row("dogecoin", "DOGE", "도지코인")
  ];
}

async function fetchStocks() {
  const res = await fetch("https://stooq.com/q/l/?s=aapl.us,msft.us,nvda.us,tsla.us&i=d", {
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`Stooq failed: ${res.status}`);
  }

  const csv = await res.text();
  const lines = csv.trim().split("\n").slice(1);

  const parsed = new Map<string, string[]>();
  lines.forEach((line) => {
    const cols = line.split(",");
    if (cols[0]) parsed.set(cols[0].toUpperCase(), cols);
  });

  const build = (ticker: string, symbol: string, name: string): WatchItem => {
    const cols = parsed.get(ticker.toUpperCase());
    if (!cols || cols.length < 7) {
      return { symbol, name, group: "stock", price: null, changePercent: null };
    }

    const open = Number(cols[3]);
    const close = Number(cols[6]);
    const price = Number.isFinite(close) && close > 0 ? close : null;
    const changePercent =
      price !== null && Number.isFinite(open) && open > 0 ? ((close - open) / open) * 100 : null;

    return { symbol, name, group: "stock", price, changePercent };
  };

  return [
    build("NVDA.US", "NVDA", "엔비디아"),
    build("AAPL.US", "AAPL", "애플"),
    build("TSLA.US", "TSLA", "테슬라"),
    build("MSFT.US", "MSFT", "마이크로소프트")
  ];
}

export async function GET() {
  const [crypto, stocks] = await Promise.allSettled([fetchCrypto(), fetchStocks()]);

  const result: WatchItem[] = [];
  const warnings: string[] = [];

  if (crypto.status === "fulfilled") result.push(...crypto.value);
  else warnings.push("crypto_unavailable");

  if (stocks.status === "fulfilled") result.push(...stocks.value);
  else warnings.push("stock_unavailable");

  return NextResponse.json({
    items: result,
    warnings,
    updatedAt: new Date().toISOString()
  });
}

