import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { aggregateKeywordBuckets } from "@/lib/newsKeywordAggregate";

/**
 * DB 뉴스 또는 외부 헤드라인에서 키워드·카테고리 건수 집계 (홈 퀵 펄스용)
 */
export async function GET() {
  try {
    const articles = await prisma.newsArticle.findMany({
      orderBy: { publishedAt: "desc" },
      take: 120,
      select: { title: true, summary: true, category: true }
    });

    const texts = articles.map((article) => `${article.title} ${article.summary || ""}`);
    const keywords = aggregateKeywordBuckets(texts);

    const categoryCounts = articles.reduce<Record<string, number>>((acc, article) => {
      acc[article.category] = (acc[article.category] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      source: "db",
      scanned: articles.length,
      keywords,
      categoryCounts
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "aggregate_failed";
    return NextResponse.json(
      { source: "none", scanned: 0, keywords: [], categoryCounts: {}, error: message },
      { status: 200 }
    );
  }
}
