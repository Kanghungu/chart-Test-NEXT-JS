import { NextResponse } from "next/server";

const TRACKED = [
  { symbol: "KOSPI", price: null, changePercent: null, volume: null, currency: "KRW" },
  { symbol: "KOSDAQ", price: null, changePercent: null, volume: null, currency: "KRW" },
  { symbol: "S&P 500", price: null, changePercent: null, volume: null, currency: "USD" },
  { symbol: "NASDAQ", price: null, changePercent: null, volume: null, currency: "USD" }
];

const KR_LEADERS = ["005930", "000660", "035420", "005380"] as const;
const US_LEADERS = ["aapl.us", "msft.us", "nvda.us", "tsla.us"] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function classifySentiment(value: number) {
  if (value <= 24) return "Extreme Fear";
  if (value <= 44) return "Fear";
  if (value <= 55) return "Neutral";
  if (value <= 74) return "Greed";
  return "Extreme Greed";
}

function toNumber(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const normalized = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(normalized) ? normalized : null;
}

async function fetchKoreanIndexesSnapshot() {
  const [kospiRes, kosdaqRes] = await Promise.all([
    fetch("https://m.stock.naver.com/api/index/KOSPI/basic", { cache: "no-store" }),
    fetch("https://m.stock.naver.com/api/index/KOSDAQ/basic", { cache: "no-store" })
  ]);

  if (!kospiRes.ok || !kosdaqRes.ok) {
    throw new Error(`Naver index request failed: ${kospiRes.status}/${kosdaqRes.status}`);
  }

  const [kospi, kosdaq] = await Promise.all([kospiRes.json(), kosdaqRes.json()]);

  return [
    {
      symbol: "KOSPI",
      price: toNumber(kospi?.closePrice),
      changePercent: toNumber(kospi?.fluctuationsRatio),
      volume: null,
      currency: "KRW"
    },
    {
      symbol: "KOSDAQ",
      price: toNumber(kosdaq?.closePrice),
      changePercent: toNumber(kosdaq?.fluctuationsRatio),
      volume: null,
      currency: "KRW"
    }
  ];
}

async function fetchUsIndexesYahooSnapshot() {
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

  const toRow = (label: string, row?: YahooQuoteRow) => ({
    symbol: label,
    price: typeof row?.regularMarketPrice === "number" ? row.regularMarketPrice : null,
    changePercent:
      typeof row?.regularMarketChangePercent === "number" ? row.regularMarketChangePercent : null,
    volume: null,
    currency: "USD"
  });

  return [toRow("S&P 500", spx), toRow("NASDAQ", ixic)];
}

async function fetchUsIndexesStooqSnapshot() {
  const res = await fetch("https://stooq.com/q/l/?s=%5Espx,%5Eixic&i=d", {
    cache: "no-store"
  });

  if (!res.ok) {
    throw new Error(`Stooq index request failed: ${res.status}`);
  }

  const csv = await res.text();
  const lines = csv.trim().split("\n").slice(1);
  const parsed = lines.map((line) => line.split(","));
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

    return {
      symbol: label,
      price: valid ? close : null,
      changePercent: valid && Number.isFinite(open) && open > 0 ? ((close - open) / open) * 100 : null,
      volume: Number.isFinite(volume) ? volume : null,
      currency: "USD"
    };
  };

  return [toRow("S&P 500", spx), toRow("NASDAQ", ixic)];
}

async function fetchUsIndexesSnapshot() {
  try {
    return await fetchUsIndexesYahooSnapshot();
  } catch {
    return await fetchUsIndexesStooqSnapshot();
  }
}

async function fetchKoreanLeadersSnapshot() {
  const rows = await Promise.all(
    KR_LEADERS.map(async (code) => {
      const res = await fetch(`https://m.stock.naver.com/api/stock/${code}/basic`, {
        cache: "no-store"
      });

      if (!res.ok) {
        throw new Error(`Naver stock request failed for ${code}: ${res.status}`);
      }

      const json = await res.json();
      return {
        symbol: code,
        changePercent: toNumber(json?.fluctuationsRatio),
        tradedValue: toNumber(json?.accumulatedTradingValueRaw)
      };
    })
  );

  return rows;
}

async function fetchUsLeadersSnapshot() {
  const res = await fetch(`https://stooq.com/q/l/?s=${US_LEADERS.join(",")}&i=d`, {
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

      return {
        symbol,
        changePercent: valid && Number.isFinite(open) && open > 0 ? ((close - open) / open) * 100 : null
      };
    })
    .filter((item) => item.symbol);
}

function deriveSentiment(items: Array<{ changePercent: number | null }>) {
  const changes = items
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
    classification: classifySentiment(score)
  };
}

export async function GET() {
  const settled = await Promise.allSettled([
    fetchKoreanIndexesSnapshot(),
    fetchUsIndexesSnapshot(),
    fetchKoreanLeadersSnapshot(),
    fetchUsLeadersSnapshot()
  ]);

  const warnings: string[] = [];

  const koreaAssets = settled[0].status === "fulfilled" ? settled[0].value : TRACKED.slice(0, 2);
  if (settled[0].status === "rejected") warnings.push("korea_index_unavailable");

  const usAssets = settled[1].status === "fulfilled" ? settled[1].value : TRACKED.slice(2);
  if (settled[1].status === "rejected") warnings.push("us_index_unavailable");

  const koreanLeaders = settled[2].status === "fulfilled" ? settled[2].value : [];
  if (settled[2].status === "rejected") warnings.push("korea_leaders_unavailable");

  const usLeaders = settled[3].status === "fulfilled" ? settled[3].value : [];
  if (settled[3].status === "rejected") warnings.push("us_leaders_unavailable");

  const assets = [...koreaAssets, ...usAssets];
  const koreanStockFearGreed = deriveSentiment([...koreaAssets, ...koreanLeaders]);
  const usStockFearGreed = deriveSentiment([...usAssets, ...usLeaders]);
  const koreanTradingValue =
    koreanLeaders.reduce((sum, item) => sum + (item.tradedValue || 0), 0) || null;

  return NextResponse.json({
    assets,
    fearGreed: koreanStockFearGreed,
    cryptoFearGreed: koreanStockFearGreed,
    stockFearGreed: usStockFearGreed,
    cryptoVolumeUsd: koreanTradingValue,
    warnings,
    updatedAt: new Date().toISOString()
  });
}
