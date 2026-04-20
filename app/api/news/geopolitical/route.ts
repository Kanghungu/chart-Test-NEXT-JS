import { NextResponse } from "next/server";

export const revalidate = 300;

type RiskImpact = "HIGH" | "MEDIUM" | "LOW";
type AssetDirection = "up" | "down";

type GeoAsset = {
  symbol: string;
  nameKo: string;
  nameEn: string;
  dir: AssetDirection;
};

type RiskPattern = {
  id: string;
  regionKo: string;
  regionEn: string;
  keywords: string[];
  impact: RiskImpact;
  assets: GeoAsset[];
};

type RssItem = {
  title: string;
  description: string;
  pubDate: string;
  link: string;
};

export type GeoNewsItem = {
  title: string;
  description: string;
  pubDate: string;
  link: string;
  regionKo: string;
  regionEn: string;
  impact: RiskImpact;
  assets: GeoAsset[];
  score: number;
};

const RSS_FEEDS = [
  "https://feeds.bbci.co.uk/news/world/rss.xml",
  "https://rss.nytimes.com/services/xml/rss/nyt/World.xml"
];

const RISK_PATTERNS: RiskPattern[] = [
  {
    id: "iran",
    regionKo: "중동/이란",
    regionEn: "Middle East/Iran",
    keywords: ["iran", "tehran", "hormuz", "persian gulf", "irgc", "iran sanctions", "이란", "호르무즈"],
    impact: "HIGH",
    assets: [
      { symbol: "OIL", nameKo: "WTI 원유", nameEn: "WTI Oil", dir: "up" },
      { symbol: "XAU", nameKo: "금", nameEn: "Gold", dir: "up" },
      { symbol: "KRW", nameKo: "원화", nameEn: "KRW", dir: "down" },
      { symbol: "KOSPI", nameKo: "코스피", nameEn: "KOSPI", dir: "down" },
      { symbol: "DEF", nameKo: "방산주", nameEn: "Defense", dir: "up" }
    ]
  },
  {
    id: "north_korea",
    regionKo: "북한",
    regionEn: "North Korea",
    keywords: ["north korea", "pyongyang", "missile launch", "nuclear test", "dprk", "북한", "평양", "미사일"],
    impact: "HIGH",
    assets: [
      { symbol: "KOSPI", nameKo: "코스피", nameEn: "KOSPI", dir: "down" },
      { symbol: "KRW", nameKo: "원화", nameEn: "KRW", dir: "down" },
      { symbol: "DEF", nameKo: "방산주", nameEn: "Defense", dir: "up" },
      { symbol: "JPY", nameKo: "엔화", nameEn: "JPY", dir: "up" }
    ]
  },
  {
    id: "taiwan",
    regionKo: "대만",
    regionEn: "Taiwan",
    keywords: ["taiwan", "taiwan strait", "tsmc", "chip war", "china military", "대만", "대만해협", "반도체"],
    impact: "HIGH",
    assets: [
      { symbol: "NVDA", nameKo: "엔비디아", nameEn: "NVIDIA", dir: "down" },
      { symbol: "TSM", nameKo: "TSMC", nameEn: "TSMC", dir: "down" },
      { symbol: "KOSPI", nameKo: "코스피", nameEn: "KOSPI", dir: "down" },
      { symbol: "USD", nameKo: "달러", nameEn: "Dollar", dir: "up" },
      { symbol: "000660", nameKo: "SK하이닉스", nameEn: "SK Hynix", dir: "down" }
    ]
  },
  {
    id: "russia_ukraine",
    regionKo: "러시아/우크라이나",
    regionEn: "Russia/Ukraine",
    keywords: ["russia", "ukraine", "putin", "nato", "war escalation", "러시아", "우크라이나", "전쟁"],
    impact: "MEDIUM",
    assets: [
      { symbol: "XAU", nameKo: "금", nameEn: "Gold", dir: "up" },
      { symbol: "OIL", nameKo: "WTI 원유", nameEn: "WTI Oil", dir: "up" },
      { symbol: "KOSPI", nameKo: "코스피", nameEn: "KOSPI", dir: "down" },
      { symbol: "EUR", nameKo: "유로", nameEn: "EUR", dir: "down" }
    ]
  },
  {
    id: "us_china",
    regionKo: "미중 갈등",
    regionEn: "US-China",
    keywords: ["china tariff", "trade war", "chip ban", "export control", "decoupling", "미중", "관세", "수출 통제"],
    impact: "MEDIUM",
    assets: [
      { symbol: "000660", nameKo: "SK하이닉스", nameEn: "SK Hynix", dir: "down" },
      { symbol: "005930", nameKo: "삼성전자", nameEn: "Samsung Electronics", dir: "down" },
      { symbol: "NVDA", nameKo: "엔비디아", nameEn: "NVIDIA", dir: "down" },
      { symbol: "USD", nameKo: "달러", nameEn: "Dollar", dir: "up" }
    ]
  },
  {
    id: "oil_opec",
    regionKo: "원유/OPEC",
    regionEn: "Oil/OPEC",
    keywords: ["opec", "oil price", "crude oil", "production cut", "brent", "wti", "원유", "감산"],
    impact: "MEDIUM",
    assets: [
      { symbol: "OIL", nameKo: "WTI 원유", nameEn: "WTI Oil", dir: "up" },
      { symbol: "KRW", nameKo: "원화", nameEn: "KRW", dir: "down" },
      { symbol: "KOSPI", nameKo: "코스피", nameEn: "KOSPI", dir: "down" }
    ]
  }
];

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function stripTags(value: string) {
  return decodeEntities(value.replace(/<[^>]+>/g, " "));
}

function extractTag(block: string, tag: string) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? stripTags(match[1]) : "";
}

function parseRSS(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item\b[\s\S]*?>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      title: extractTag(block, "title"),
      description: extractTag(block, "description"),
      pubDate: extractTag(block, "pubDate"),
      link: extractTag(block, "link")
    });
  }

  return items.filter((item) => item.title && item.link);
}

async function fetchRSS(url: string): Promise<RssItem[]> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketPulseBot/1.0)" },
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) return [];
    return parseRSS(await response.text());
  } catch {
    return [];
  }
}

function scoreItem(item: RssItem) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  let bestPattern: RiskPattern | null = null;
  let bestScore = 0;

  for (const pattern of RISK_PATTERNS) {
    let score = 0;

    for (const keyword of pattern.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        score += keyword.split(/\s+/).length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestPattern = pattern;
    }
  }

  return bestPattern && bestScore > 0 ? { pattern: bestPattern, score: bestScore } : null;
}

export async function GET() {
  try {
    const allItems = (await Promise.all(RSS_FEEDS.map(fetchRSS))).flat();
    const seen = new Set<string>();

    const uniqueItems = allItems.filter((item) => {
      const key = `${item.title.slice(0, 80)}|${item.link}`.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const items: GeoNewsItem[] = uniqueItems
      .map((item) => {
        const result = scoreItem(item);
        if (!result) return null;

        return {
          ...item,
          regionKo: result.pattern.regionKo,
          regionEn: result.pattern.regionEn,
          impact: result.pattern.impact,
          assets: result.pattern.assets,
          score: result.score
        };
      })
      .filter((item): item is GeoNewsItem => item !== null)
      .sort((left, right) => {
        const impactOrder: Record<RiskImpact, number> = { HIGH: 2, MEDIUM: 1, LOW: 0 };
        const impactDiff = impactOrder[right.impact] - impactOrder[left.impact];
        if (impactDiff !== 0) return impactDiff;
        if (right.score !== left.score) return right.score - left.score;
        return new Date(right.pubDate).getTime() - new Date(left.pubDate).getTime();
      })
      .slice(0, 8);

    const overallRisk: "HIGH" | "MEDIUM" | "LOW" | "CLEAR" = items.some((item) => item.impact === "HIGH")
      ? "HIGH"
      : items.some((item) => item.impact === "MEDIUM")
        ? "MEDIUM"
        : items.length
          ? "LOW"
          : "CLEAR";

    return NextResponse.json({
      items,
      overallRisk,
      fetchedAt: new Date().toISOString()
    });
  } catch {
    return NextResponse.json({
      items: [],
      overallRisk: "CLEAR",
      fetchedAt: new Date().toISOString()
    });
  }
}
