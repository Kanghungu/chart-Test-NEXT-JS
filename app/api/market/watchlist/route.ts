import { NextResponse } from "next/server";

type WatchItem = {
  symbol: string;
  name: string;
  nameKo: string;
  nameEn: string;
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

  const row = (id: string, symbol: string, nameKo: string, nameEn: string): WatchItem => ({
    symbol,
    name: nameKo,
    nameKo,
    nameEn,
    group: "crypto",
    price: typeof json?.[id]?.usd === "number" ? json[id].usd : null,
    changePercent:
      typeof json?.[id]?.usd_24h_change === "number" ? json[id].usd_24h_change : null
  });

  return [
    row("bitcoin", "BTC", "비트코인", "Bitcoin"),
    row("ethereum", "ETH", "이더리움", "Ethereum"),
    row("solana", "SOL", "솔라나", "Solana"),
    row("dogecoin", "DOGE", "도지코인", "Dogecoin")
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

  const build = (ticker: string, symbol: string, nameKo: string, nameEn: string): WatchItem => {
    const cols = parsed.get(ticker.toUpperCase());
    if (!cols || cols.length < 7) {
      return { symbol, name: nameKo, nameKo, nameEn, group: "stock", price: null, changePercent: null };
    }

    const open = Number(cols[3]);
    const close = Number(cols[6]);
    const price = Number.isFinite(close) && close > 0 ? close : null;
    const changePercent =
      price !== null && Number.isFinite(open) && open > 0 ? ((close - open) / open) * 100 : null;

    return { symbol, name: nameKo, nameKo, nameEn, group: "stock", price, changePercent };
  };

  return [
    build("NVDA.US", "NVDA", "엔비디아", "NVIDIA"),
    build("AAPL.US", "AAPL", "애플", "Apple"),
    build("TSLA.US", "TSLA", "테슬라", "Tesla"),
    build("MSFT.US", "MSFT", "마이크로소프트", "Microsoft")
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
