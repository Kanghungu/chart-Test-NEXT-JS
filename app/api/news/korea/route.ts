import { NextResponse } from "next/server";

const NAVER_KOREA_STOCK_NEWS_URL = "https://m.stock.naver.com/api/news/stock/005930?pageSize=30";

function normalizeDateTime(value?: string) {
  if (!value || value.length !== 12) return "";

  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  const hour = value.slice(8, 10);
  const minute = value.slice(10, 12);

  return `${year}-${month}-${day}T${hour}:${minute}:00+09:00`;
}

export async function GET() {
  try {
    const res = await fetch(NAVER_KOREA_STOCK_NEWS_URL, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to load Korean stock news", results: [] }, { status: res.status });
    }

    const json = await res.json();
    const groups = Array.isArray(json) ? json : [];

    const results = groups
      .flatMap((group) => (Array.isArray(group?.items) ? group.items : []))
      .map((item: any) => ({
        id: item.id,
        title: item.titleFull || item.title || "Untitled",
        title_ko: item.titleFull || item.title || "제목 없음",
        description: item.body || "",
        summary: item.body || "",
        summary_ko: item.body || "",
        publisher: item.officeName || "네이버 증권",
        published_at: normalizeDateTime(item.datetime),
        created_at: normalizeDateTime(item.datetime),
        content_url: item.mobileNewsUrl || ""
      }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ error: "Server error", results: [] }, { status: 500 });
  }
}
