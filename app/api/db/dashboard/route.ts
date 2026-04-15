import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function toNumber(value: unknown) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    const decimal = value as { toNumber: () => number };
    return decimal.toNumber();
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET() {
  try {
    const [watchlistEntries, latestSnapshot, news, events, signals, briefings] = await Promise.all([
      prisma.watchlistEntry.findMany({
        orderBy: [{ groupLabel: "asc" }, { sortOrder: "asc" }, { asset: { symbol: "asc" } }],
        include: { asset: true }
      }),
      prisma.marketSnapshot.findFirst({
        orderBy: { capturedAt: "desc" },
        include: {
          items: {
            orderBy: { asset: { symbol: "asc" } },
            include: { asset: true }
          }
        }
      }),
      prisma.newsArticle.findMany({
        orderBy: { publishedAt: "desc" },
        take: 10
      }),
      prisma.economicEvent.findMany({
        orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
        take: 10
      }),
      prisma.marketSignal.findMany({
        orderBy: [{ signalDate: "desc" }, { createdAt: "desc" }],
        take: 10
      }),
      prisma.briefing.findMany({
        orderBy: { publishedAt: "desc" },
        take: 5
      })
    ]);

    return NextResponse.json({
      watchlist: watchlistEntries.map((entry) => ({
        id: entry.id,
        groupLabel: entry.groupLabel,
        sortOrder: entry.sortOrder,
        isPinned: entry.isPinned,
        note: entry.note,
        asset: {
          symbol: entry.asset.symbol,
          name: entry.asset.name,
          type: entry.asset.type,
          market: entry.asset.market,
          currency: entry.asset.currency
        }
      })),
      latestSnapshot: latestSnapshot
        ? {
            id: latestSnapshot.id,
            label: latestSnapshot.label,
            capturedAt: latestSnapshot.capturedAt,
            fearGreedValue: latestSnapshot.fearGreedValue,
            fearGreedClassification: latestSnapshot.fearGreedClassification,
            koreaTradingValue: toNumber(latestSnapshot.koreaTradingValue),
            warnings: latestSnapshot.warnings,
            assets: latestSnapshot.items.map((item) => ({
              symbol: item.asset.symbol,
              name: item.asset.name,
              type: item.asset.type,
              price: toNumber(item.price),
              changePercent: toNumber(item.changePercent),
              volume: toNumber(item.volume),
              currency: item.asset.currency
            }))
          }
        : null,
      news: news.map((item) => ({
        id: item.id,
        category: item.category,
        source: item.source,
        title: item.title,
        summary: item.summary,
        url: item.url,
        imageUrl: item.imageUrl,
        publishedAt: item.publishedAt
      })),
      events: events.map((item) => ({
        id: item.id,
        title: item.title,
        country: item.country,
        countryCode: item.countryCode,
        impact: item.impact,
        startsAt: item.startsAt,
        displayTime: item.displayTime,
        source: item.source
      })),
      signals: signals.map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        tone: item.tone,
        source: item.source,
        signalDate: item.signalDate
      })),
      briefings: briefings.map((item) => ({
        id: item.id,
        title: item.title,
        prompt: item.prompt,
        summary: item.summary,
        marketView: item.marketView,
        publishedAt: item.publishedAt
      }))
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to read dashboard data from DB."
      },
      { status: 500 }
    );
  }
}
