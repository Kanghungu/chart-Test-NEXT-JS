import { NextResponse } from "next/server";
import { fetchKoreaStockNewsFromNaver } from "@/lib/koreaNaverNews";

export async function GET() {
  try {
    const results = await fetchKoreaStockNewsFromNaver();
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Server error", results: [] }, { status: 500 });
  }
}
