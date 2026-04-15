import { NextResponse } from "next/server";
import type { MacroQuotePayload, SessionRiskPayload } from "@/lib/macroQuotes";

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

  const res = await fetch("https://query1.finance.yahoo.com/v7/finance/quote?symbols=%5EGSPC,%5EIXIC", {
    cache: "no-store",
    headers: {
      "User-Agent": "MarketPulseKorea/1.0"
    }
  });

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
  const cellKey = (cols: string[]) => (cols[0] || "").toUpperCase().trim();
  const spx = parsed.find((cols) => {
    const key = cellKey(cols);
    return key === "^SPX" || key === "^GSPC" || key.endsWith("SPX");
  });
  const ixic = parsed.find((cols) => {
    const key = cellKey(cols);
    return key === "^IXIC" || key === "^NDX" || key.endsWith("IXIC");
  });

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

/** 야후 v8 chart: quote가 비었을 때 meta로 종가·전일대비 보강 */
async function fetchYahooIndexChartFill(yahooSymbol: string) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      yahooSymbol
    )}?interval=1d&range=5d`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "MarketPulseKorea/1.0" }
    });

    if (!res.ok) {
      return { price: null as number | null, changePercent: null as number | null };
    }

    const json = await res.json();
    const meta = json?.chart?.result?.[0]?.meta as
      | { regularMarketPrice?: number; chartPreviousClose?: number }
      | undefined;

    const price =
      typeof meta?.regularMarketPrice === "number" && Number.isFinite(meta.regularMarketPrice)
        ? meta.regularMarketPrice
        : null;
    const prevClose =
      typeof meta?.chartPreviousClose === "number" && meta.chartPreviousClose > 0
        ? meta.chartPreviousClose
        : null;
    const changePercent =
      price != null && prevClose != null ? ((price - prevClose) / prevClose) * 100 : null;

    return { price, changePercent };
  } catch {
    return { price: null, changePercent: null };
  }
}

async function fetchUsIndexesSnapshot() {
  let yahooRows: Awaited<ReturnType<typeof fetchUsIndexesYahooSnapshot>>;

  try {
    yahooRows = await fetchUsIndexesYahooSnapshot();
  } catch {
    try {
      return await fetchUsIndexesStooqSnapshot();
    } catch {
      return TRACKED.slice(2);
    }
  }

  // 야후 quote가 null이면 Stooq → 그래도 null이면 v8 chart 순으로 보강
  const needsFill = yahooRows.some((row) => row.price == null || row.changePercent == null);

  if (!needsFill) {
    return yahooRows;
  }

  let merged = [...yahooRows];

  try {
    const stooqRows = await fetchUsIndexesStooqSnapshot();
    merged = merged.map((row, index) => {
      const fallbackRow = stooqRows[index];
      if (!fallbackRow) return row;

      return {
        symbol: row.symbol,
        price: row.price ?? fallbackRow.price,
        changePercent: row.changePercent ?? fallbackRow.changePercent,
        volume: row.volume ?? fallbackRow.volume ?? null,
        currency: "USD"
      };
    });
  } catch {
    // Stooq 실패 시 merged 유지
  }

  const chartSymbols = ["^GSPC", "^IXIC"] as const;
  for (let i = 0; i < merged.length; i++) {
    if (merged[i].price != null && merged[i].changePercent != null) continue;

    const chartFill = await fetchYahooIndexChartFill(chartSymbols[i]);
    merged[i] = {
      symbol: merged[i].symbol,
      price: merged[i].price ?? chartFill.price,
      changePercent: merged[i].changePercent ?? chartFill.changePercent,
      volume: merged[i].volume,
      currency: "USD"
    };
  }

  // 지수 심볼이 막혀도 대형 ETF 등락률로 방향만 보강 (가격은 지수와 다를 수 있음)
  const stillMissingPct = merged.some((row) => row.changePercent == null);
  if (stillMissingPct) {
    try {
      const etfRes = await fetch("https://query1.finance.yahoo.com/v7/finance/quote?symbols=SPY,QQQ", {
        cache: "no-store",
        headers: { "User-Agent": "MarketPulseKorea/1.0" }
      });

      if (etfRes.ok) {
        const etfJson = await etfRes.json();
        const etfRows = etfJson?.quoteResponse?.result as
          | Array<{ symbol?: string; regularMarketChangePercent?: number }>
          | undefined;

        if (Array.isArray(etfRows)) {
          const spyRow = etfRows.find((row) => row?.symbol === "SPY");
          const qqqRow = etfRows.find((row) => row?.symbol === "QQQ");
          const etfLegs = [
            typeof spyRow?.regularMarketChangePercent === "number"
              ? spyRow.regularMarketChangePercent
              : null,
            typeof qqqRow?.regularMarketChangePercent === "number"
              ? qqqRow.regularMarketChangePercent
              : null
          ];

          merged = merged.map((row, index) => {
            if (row.changePercent != null) return row;
            const pct = etfLegs[index];
            if (typeof pct !== "number") return row;

            return { ...row, changePercent: pct };
          });
        }
      }
    } catch {
      // ETF 보강 실패 시 무시
    }
  }

  return merged;
}

async function fetchKoreanLeadersSnapshot() {
  const settledList = await Promise.allSettled(
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

  const rows = settledList.map((entry, index) => {
    if (entry.status === "fulfilled") {
      return entry.value;
    }

    return {
      symbol: KR_LEADERS[index],
      changePercent: null,
      tradedValue: null
    };
  });

  const successCount = settledList.filter((entry) => entry.status === "fulfilled").length;
  if (successCount === 0) {
    throw new Error("korea_leaders_all_failed");
  }

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

type YahooQuoteRow = {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
};

function yahooRowToValues(row?: YahooQuoteRow) {
  return {
    price: typeof row?.regularMarketPrice === "number" ? row.regularMarketPrice : null,
    changePercent:
      typeof row?.regularMarketChangePercent === "number" ? row.regularMarketChangePercent : null
  };
}

/** 야후 Finance 배치 호용: 거시(원달러·DXY·국채) + VIX·선물 */
async function fetchYahooMacroVolFutures(): Promise<Map<string, YahooQuoteRow>> {
  const symbols = ["KRW=X", "DX-Y.NYB", "^TNX", "^VIX", "ES=F", "NQ=F"];
  const encoded = symbols.map(encodeURIComponent).join(",");
  const res = await fetch(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encoded}`, {
    cache: "no-store",
    headers: {
      "User-Agent": "MarketPulseKorea/1.0 (+https://github.com/)"
    }
  });

  if (!res.ok) {
    throw new Error(`Yahoo macro/vol quote failed: ${res.status}`);
  }

  const json = await res.json();
  const rows = json?.quoteResponse?.result as YahooQuoteRow[] | undefined;

  if (!Array.isArray(rows)) {
    throw new Error("Yahoo macro/vol payload malformed");
  }

  const bySymbol = new Map<string, YahooQuoteRow>();
  rows.forEach((row) => {
    if (row?.symbol) {
      bySymbol.set(row.symbol, row);
    }
  });

  return bySymbol;
}

/** 스투크 한국 10년 국채 금리(심볼 실패 시 null) */
async function fetchKorea10YFromStooq(): Promise<{ price: number | null; changePercent: number | null }> {
  try {
    const res = await fetch("https://stooq.com/q/l/?s=10ykr.y&i=d", {
      cache: "no-store",
      headers: { "User-Agent": "MarketPulseKorea/1.0" }
    });

    if (!res.ok) {
      return { price: null, changePercent: null };
    }

    const csv = await res.text();
    const lines = csv.trim().split("\n").slice(1);
    const row = lines.map((line) => line.split(",")).find((cols) => /10ykr/i.test(cols[0] || ""));

    if (!row || row.length < 7) {
      return { price: null, changePercent: null };
    }

    const open = Number(row[3]);
    const close = Number(row[6]);
    const valid = Number.isFinite(close) && close > 0;

    return {
      price: valid ? close : null,
      changePercent: valid && Number.isFinite(open) && open > 0 ? ((close - open) / open) * 100 : null
    };
  } catch {
    return { price: null, changePercent: null };
  }
}

function buildMacroAndRiskFromYahoo(
  bySymbol: Map<string, YahooQuoteRow>,
  korea10y: { price: number | null; changePercent: number | null }
): { macroRail: MacroQuotePayload[]; sessionRisk: SessionRiskPayload } {
  const usdKrw = yahooRowToValues(bySymbol.get("KRW=X"));
  const dxy = yahooRowToValues(bySymbol.get("DX-Y.NYB"));
  const us10y = yahooRowToValues(bySymbol.get("^TNX"));
  const vix = yahooRowToValues(bySymbol.get("^VIX"));
  const es = yahooRowToValues(bySymbol.get("ES=F"));
  const nq = yahooRowToValues(bySymbol.get("NQ=F"));

  const macroRail: MacroQuotePayload[] = [
    { id: "usdkrw", ...usdKrw, displayUnit: "pair" },
    { id: "dxy", ...dxy, displayUnit: "index" },
    { id: "us10y", ...us10y, displayUnit: "yield" },
    {
      id: "kr10y",
      price: korea10y.price,
      changePercent: korea10y.changePercent,
      displayUnit: "yield"
    }
  ];

  const sessionRisk: SessionRiskPayload = {
    vix,
    esFuture: es,
    nqFuture: nq
  };

  return { macroRail, sessionRisk };
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
    fetchUsLeadersSnapshot(),
    fetchYahooMacroVolFutures(),
    fetchKorea10YFromStooq()
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

  let macroRail: MacroQuotePayload[] = [];
  let sessionRisk: SessionRiskPayload = {
    vix: { price: null, changePercent: null },
    esFuture: { price: null, changePercent: null },
    nqFuture: { price: null, changePercent: null }
  };

  if (settled[4].status === "fulfilled") {
    const korea10y = settled[5].status === "fulfilled" ? settled[5].value : { price: null, changePercent: null };
    if (settled[5].status === "rejected" || korea10y.price == null) {
      warnings.push("kr10y_unavailable");
    }

    const built = buildMacroAndRiskFromYahoo(settled[4].value, korea10y);
    macroRail = built.macroRail;
    sessionRisk = built.sessionRisk;
  } else {
    warnings.push("macro_vol_unavailable");
  }

  const assets = [...koreaAssets, ...usAssets];
  const koreanStockFearGreed = deriveSentiment([...koreaAssets, ...koreanLeaders]);
  const usStockFearGreed = deriveSentiment([...usAssets, ...usLeaders]);
  const koreanTradingValue = koreanLeaders.reduce((sum, item) => sum + (item.tradedValue || 0), 0) || null;

  return NextResponse.json({
    assets,
    fearGreed: koreanStockFearGreed,
    koreaFearGreed: koreanStockFearGreed,
    stockFearGreed: usStockFearGreed,
    koreaTradingValue: koreanTradingValue,
    macroRail,
    sessionRisk,
    warnings,
    updatedAt: new Date().toISOString()
  });
}
