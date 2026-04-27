import { NextResponse } from "next/server";
import { scanFunding, type FundingRow } from "@/lib/fundingSignals";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export type CryptoFundingResponse = {
  rows: FundingRow[];
  fetchedAt: string;
};

export async function GET() {
  try {
    const rows = await scanFunding();

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
