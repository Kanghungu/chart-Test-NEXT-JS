/**
 * CoinGecko 섹터 코인 목록 서버 프록시
 * 브라우저에서 직접 호출 시 CORS 차단 → Vercel 서버에서 대신 fetch
 */
import { NextResponse } from "next/server";

export const revalidate = 120; // 2분 캐시

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  if (!category) {
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  }

  try {
    const url =
      `https://api.coingecko.com/api/v3/coins/markets` +
      `?category=${encodeURIComponent(category)}` +
      `&vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false`;

    const res = await fetch(url, {
      cache: "no-store",
      headers: { "accept": "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `CoinGecko returned ${res.status}` },
        { status: res.status },
      );
    }

    const data = await res.json();

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "s-maxage=120, stale-while-revalidate=60",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch sector coins" },
      { status: 502 },
    );
  }
}
