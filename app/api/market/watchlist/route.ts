import { NextResponse } from "next/server";

type WatchGroup = "korea" | "stock";

type WatchItem = {
  symbol: string;
  name: string;
  nameKo: string;
  nameEn: string;
  group: WatchGroup;
  price: number | null;
  changePercent: number | null;
};

const KR_STOCKS = [
  { code: "005930", symbol: "005930", nameKo: "삼성전자", nameEn: "Samsung Electronics" },
  { code: "000660", symbol: "000660", nameKo: "SK하이닉스", nameEn: "SK hynix" },
  { code: "035420", symbol: "035420", nameKo: "NAVER", nameEn: "NAVER" },
  { code: "005380", symbol: "005380", nameKo: "현대차", nameEn: "Hyundai Motor" }
] as const;

const US_STOCKS = [
  { ticker: "NVDA.US", symbol: "NVDA", nameKo: "엔비디아", nameEn: "NVIDIA" },
  { ticker: "AAPL.US", symbol: "AAPL", nameKo: "애플", nameEn: "Apple" },
  { ticker: "TSLA.US", symbol: "TSLA", nameKo: "테슬라", nameEn: "Tesla" },
  { ticker: "MSFT.US", symbol: "MSFT", nameKo: "마이크로소프트", nameEn: "Microsoft" }
] as const;

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const normalized = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(normalized) ? normalized : null;
}

async function fetchKoreanStocks() {
  const results = await Promise.all(
    KR_STOCKS.map(async ({ code, symbol, nameKo, nameEn }) => {
      const res = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
        cache: "no-store"
      });

      if (!res.ok) {
        throw new Error(`Naver stock request failed for ${code}: ${res.status}`);
      }

      const json = await res.json();
      return {
        symbol,
        name: nameKo,
        nameKo,
        nameEn,
        group: "korea" as const,
        price: toNumber(json?.closePrice),
        changePercent: toNumber(json?.fluctuationsRatio)
      };
    })
  );

  return results;
}

async function fetchUsStocks() {
  const symbols = US_STOCKS.map((item) => item.ticker.toLowerCase()).join(",");
  const res = await fetch(`https://stooq.com/q/l/?s=${symbols}&i=d`, {
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

  return US_STOCKS.map(({ ticker, symbol, nameKo, nameEn }) => {
    const cols = parsed.get(ticker.toUpperCase());
    if (!cols || cols.length < 7) {
      return {
        symbol,
        name: nameKo,
        nameKo,
        nameEn,
        group: "stock" as const,
        price: null,
        changePercent: null
      };
    }

    const open = Number(cols[3]);
    const close = Number(cols[6]);
    const price = Number.isFinite(close) && close > 0 ? close : null;
    const changePercent =
      price !== null && Number.isFinite(open) && open > 0 ? ((close - open) / open) * 100 : null;

    return {
      symbol,
      name: nameKo,
      nameKo,
      nameEn,
      group: "stock" as const,
      price,
      changePercent
    };
  });
}

export async function GET() {
  const [koreanStocks, usStocks] = await Promise.allSettled([fetchKoreanStocks(), fetchUsStocks()]);

  const result: WatchItem[] = [];
  const warnings: string[] = [];

  if (koreanStocks.status === "fulfilled") result.push(...koreanStocks.value);
  else warnings.push("korean_stock_unavailable");

  if (usStocks.status === "fulfilled") result.push(...usStocks.value);
  else warnings.push("us_stock_unavailable");

  return NextResponse.json({
    items: result,
    warnings,
    updatedAt: new Date().toISOString()
  });
}
