/**
 * 서버사이드 매크로 지표 프록시
 * - Stooq, Binance spot 등 브라우저 CORS 차단 소스를 서버에서 대신 fetch
 * - DXY · USD/KRW · 금(XAU) · WTI 원유 · 미국채 10년
 */
import { NextResponse } from "next/server";

export const revalidate = 60; // 60초 캐시

type Quote = { price: number | null; changePercent: number | null };
const empty: Quote = { price: null, changePercent: null };

async function fromStooq(sym: string): Promise<Quote> {
  try {
    const res = await fetch(
      `https://stooq.com/q/l/?s=${sym}&f=sd2t2ohlcv&h&e=csv`,
      { cache: "no-store" }
    );
    if (!res.ok) return empty;
    const text = await res.text();
    const cols  = text.trim().split("\n")[1]?.split(",") ?? [];
    const close = parseFloat(cols[6]);
    const open  = parseFloat(cols[3]);
    if (!isFinite(close)) return empty;
    return {
      price:         close,
      changePercent: isFinite(open) && open > 0
        ? ((close - open) / open) * 100
        : null,
    };
  } catch { return empty; }
}

async function fromBinance24hr(symbol: string): Promise<Quote> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
      { cache: "no-store" }
    );
    if (!res.ok) return empty;
    const d = await res.json();
    return {
      price:         parseFloat(d.lastPrice),
      changePercent: parseFloat(d.priceChangePercent),
    };
  } catch { return empty; }
}

export async function GET() {
  const [dxy, usdkrw, gold, oil, us10y] = await Promise.all([
    fromStooq("dxy.f"),     // 달러인덱스
    fromStooq("usdkrw"),    // 원/달러 환율
    fromBinance24hr("XAUUSDT"), // 금 (Binance spot — 서버에서는 CORS 없음)
    fromStooq("cl.f"),      // WTI 원유 선물
    fromStooq("10ustby.b"), // 미국채 10년 수익률
  ]);

  return NextResponse.json(
    { dxy, usdkrw, gold, oil, us10y, fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=30" } }
  );
}
