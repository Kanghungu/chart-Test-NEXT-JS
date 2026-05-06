import { NextResponse } from "next/server";
import { scanFunding, SERVER_ONLY_EXCHANGES, type FundingRow } from "@/lib/fundingSignals";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export type CryptoFundingResponse = {
  rows: FundingRow[];
  fetchedAt: string;
};

export async function GET() {
  try {
    // Vercel 서버에서는 Binance/Bybit IP 차단됨 → CORS 허용 거래소만 처리
    const rows = await scanFunding(undefined, SERVER_ONLY_EXCHANGES);

    return NextResponse.json(
      { rows, fetchedAt: new Date().toISOString() } satisfies CryptoFundingResponse,
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=30",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load funding data";

    return NextResponse.json(
      {
        error: message,
        rows: [],
        fetchedAt: new Date().toISOString(),
      },
      { status: 502 },
    );
  }
}
