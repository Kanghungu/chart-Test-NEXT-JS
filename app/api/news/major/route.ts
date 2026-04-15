import { NextResponse } from "next/server";
import { fetchDeepsearchStockNews } from "@/lib/deepsearchStockNews";
import { fetchKoreaStockNewsFromNaver } from "@/lib/koreaNaverNews";
import { isLikelyRumorOrTabloidNews } from "@/lib/newsMajorFilter";
import type { MajorNewsItem, NewsItem } from "@/components/news/newsTypes";

function buildScanText(item: NewsItem) {
  return `${item.title || ""} ${item.title_ko || ""} ${item.summary || ""} ${item.summary_ko || ""} ${item.description || ""}`;
}

/**
 * 한·미 주요 뉴스 (카더라·루머 패턴 제외 후 최신순)
 */
export async function GET() {
  try {
    const [koreaResult, stockResult] = await Promise.allSettled([
      fetchKoreaStockNewsFromNaver(),
      fetchDeepsearchStockNews()
    ]);

    const koreaItems = koreaResult.status === "fulfilled" ? koreaResult.value : [];
    const stockItems = stockResult.status === "fulfilled" ? stockResult.value : [];

    const merged: MajorNewsItem[] = [
      ...koreaItems.map((item) => ({ ...item, region: "korea" as const })),
      ...stockItems.map((item) => ({ ...item, region: "us" as const }))
    ].filter((item) => {
      const publisher = String(item.publisher || "");
      const scanText = buildScanText(item);
      return !isLikelyRumorOrTabloidNews(scanText, publisher);
    });

    merged.sort((a, b) => {
      const timeA = new Date(a.published_at || a.created_at || 0).getTime();
      const timeB = new Date(b.published_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });

    return NextResponse.json({
      items: merged.slice(0, 12),
      warnings: [
        ...(koreaResult.status === "rejected" ? ["korea_news_unavailable"] : []),
        ...(stockResult.status === "rejected" ? ["us_news_unavailable"] : [])
      ]
    });
  } catch (error) {
    return NextResponse.json(
      {
        items: [],
        warnings: ["major_news_failed"],
        error: error instanceof Error ? error.message : "unknown"
      },
      { status: 500 }
    );
  }
}
