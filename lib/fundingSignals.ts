/**
 * Funding Rate & Open Interest scanner.
 * Uses Binance Futures public API — no API key required.
 *
 * FR interpretation is CONTRARIAN:
 *   FR > 0  (longs pay shorts) → overcrowded long  → bearish contrarian signal
 *   FR < 0  (shorts pay longs) → overcrowded short → bullish contrarian signal
 */

export type FundingRow = {
  symbol: string;
  base: string;
  fundingRate: number;       // raw float  e.g. 0.0001 = 0.01%
  markPrice: number;
  nextFundingTime: number;   // ms timestamp
  oiUSD: number;             // current OI in USD (NaN if unavailable)
  oiChange1hPct: number;     // % change vs 1h ago (NaN if unavailable)
  // Derived
  frLevel:
    | "EXTREME_BULL"   // FR ≤ -0.10%  shorts paying heavily → strong long signal
    | "HIGH_BULL"      // FR ≤ -0.05%
    | "NEUTRAL"
    | "HIGH_BEAR"      // FR ≥ +0.05%
    | "EXTREME_BEAR";  // FR ≥ +0.10%  longs paying heavily → strong short signal
  oiTrend:
    | "RISING_FAST"   // > +5% 1h
    | "RISING"        // > +2%
    | "FLAT"
    | "FALLING"       // < -2%
    | "FALLING_FAST"; // < -5%
};

// All 14 symbols in the main scanner — not every one has perpetual futures.
// fetchFundingRow silently returns null for symbols without futures.
const FUTURES_SYMBOLS = [
  "BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT",
  "ADAUSDT", "DOGEUSDT", "LTCUSDT", "TAOUSDT", "WLDUSDT",
  "ENAUSDT", "MAGICUSDT", "VIRTUALUSDT", "TURBOUSDT",
];

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json() as Promise<T>;
  } catch {
    return null;
  }
}

function toFRLevel(fr: number): FundingRow["frLevel"] {
  if (fr >=  0.001)  return "EXTREME_BEAR";
  if (fr >=  0.0005) return "HIGH_BEAR";
  if (fr <= -0.001)  return "EXTREME_BULL";
  if (fr <= -0.0005) return "HIGH_BULL";
  return "NEUTRAL";
}

function toOITrend(changePct: number): FundingRow["oiTrend"] {
  if (isNaN(changePct)) return "FLAT";
  if (changePct >=  5)  return "RISING_FAST";
  if (changePct >=  2)  return "RISING";
  if (changePct <= -5)  return "FALLING_FAST";
  if (changePct <= -2)  return "FALLING";
  return "FLAT";
}

async function fetchFundingRow(symbol: string): Promise<FundingRow | null> {
  const base = symbol.replace("USDT", "");

  const [premium, oiHist] = await Promise.all([
    fetchJSON<{
      lastFundingRate: string;
      markPrice: string;
      nextFundingTime: number;
    }>(`https://fapi.binance.com/fapi/v1/premiumIndex?symbol=${symbol}`),
    fetchJSON<Array<{
      sumOpenInterest: string;
      sumOpenInterestValue: string;
      timestamp: number;
    }>>(`https://fapi.binance.com/futures/data/openInterestHist?symbol=${symbol}&period=1h&limit=2`),
  ]);

  if (!premium || !("lastFundingRate" in premium)) return null;

  const fr        = parseFloat(premium.lastFundingRate);
  const markPrice = parseFloat(premium.markPrice);

  let oiUSD = NaN;
  let oiChange1hPct = NaN;

  if (oiHist && oiHist.length >= 2) {
    const [prev, curr] = oiHist;
    oiUSD = parseFloat(curr.sumOpenInterestValue);
    const prevVal = parseFloat(prev.sumOpenInterestValue);
    if (prevVal > 0) oiChange1hPct = (oiUSD - prevVal) / prevVal * 100;
  } else if (oiHist && oiHist.length === 1) {
    oiUSD = parseFloat(oiHist[0].sumOpenInterestValue);
  }

  return {
    symbol,
    base,
    fundingRate: fr,
    markPrice,
    nextFundingTime: premium.nextFundingTime,
    oiUSD,
    oiChange1hPct,
    frLevel:  toFRLevel(fr),
    oiTrend:  toOITrend(oiChange1hPct),
  };
}

/** Fetch all rows; sort by |fundingRate| descending so extremes appear first. */
export async function scanFunding(
  symbols: string[] = FUTURES_SYMBOLS,
): Promise<FundingRow[]> {
  const results = await Promise.all(symbols.map(fetchFundingRow));
  return results
    .filter((r): r is FundingRow => r !== null)
    .sort((a, b) => Math.abs(b.fundingRate) - Math.abs(a.fundingRate));
}

// ── Formatters ────────────────────────────────────────────────────────────

export function formatFR(fr: number): string {
  return (fr * 100).toFixed(4) + "%";
}

export function formatOI(usd: number): string {
  if (isNaN(usd)) return "N/A";
  if (usd >= 1e9) return (usd / 1e9).toFixed(2) + "B";
  if (usd >= 1e6) return (usd / 1e6).toFixed(1) + "M";
  return usd.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function formatPrice(p: number): string {
  if (p >= 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (p >= 1)    return p.toFixed(3);
  if (p >= 0.01) return p.toFixed(4);
  return p.toFixed(6);
}
