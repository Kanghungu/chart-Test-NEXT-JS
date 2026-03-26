import { NextResponse } from "next/server";

const STOCK_NEWS_URL = "https://api-v2.deepsearch.com/v1/global-articles?api_key=bec00d2364fa444b9cdb342e731f73d8";

export async function GET() {
  try {
    const res = await fetch(STOCK_NEWS_URL, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to load stock news", data: [] }, { status: res.status });
    }

    const json = await res.json();
    return NextResponse.json(json);
  } catch {
    return NextResponse.json({ error: "Server error", data: [] }, { status: 500 });
  }
}
