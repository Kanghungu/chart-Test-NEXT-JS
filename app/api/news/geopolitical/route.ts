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
  lang: "ko" | "en";
};

export type GeoNewsItem = {
  title: string;
  description: string;
  pubDate: string;
  link: string;
  lang: "ko" | "en";
  regionKo: string;
  regionEn: string;
  impact: RiskImpact;
  assets: GeoAsset[];
  score: number;
};

// RSS 소스 - 영문 + 한국어 (Google News 검색 RSS - Vercel에서 안정적으로 접근 가능)
const RSS_FEEDS: Array<{ url: string; lang: "ko" | "en" }> = [
  // 영문 소스
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml",            lang: "en" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", lang: "en" },
  // 한국어 소스 - Google News RSS (패턴별 한국어 검색)
  { url: "https://news.google.com/rss/search?q=이란+중동+호르무즈&hl=ko&gl=KR&ceid=KR:ko",    lang: "ko" },
  { url: "https://news.google.com/rss/search?q=북한+미사일+핵실험&hl=ko&gl=KR&ceid=KR:ko",    lang: "ko" },
  { url: "https://news.google.com/rss/search?q=대만+해협+미중반도체&hl=ko&gl=KR&ceid=KR:ko",  lang: "ko" },
  { url: "https://news.google.com/rss/search?q=러시아+우크라이나+전쟁&hl=ko&gl=KR&ceid=KR:ko", lang: "ko" },
  { url: "https://news.google.com/rss/search?q=미중+무역전쟁+관세&hl=ko&gl=KR&ceid=KR:ko",    lang: "ko" },
  { url: "https://news.google.com/rss/search?q=유가+원유+OPEC+감산&hl=ko&gl=KR&ceid=KR:ko",   lang: "ko" },
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

function parseRSS(xml: string, lang: "ko" | "en"): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item\b[\s\S]*?>([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    items.push({
      title: extractTag(block, "title"),
      description: extractTag(block, "description"),
      pubDate: extractTag(block, "pubDate"),
      link: extractTag(block, "link"),
      lang,
    });
  }

  return items.filter((item) => item.title && item.link);
}

async function fetchRSS(url: string, lang: "ko" | "en"): Promise<RssItem[]> {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketPulseBot/1.0)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return [];
    return parseRSS(await response.text(), lang);
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

const sortByImpact = (left: GeoNewsItem, right: GeoNewsItem) => {
  const impactOrder: Record<RiskImpact, number> = { HIGH: 2, MEDIUM: 1, LOW: 0 };
  const impactDiff = impactOrder[right.impact] - impactOrder[left.impact];
  if (impactDiff !== 0) return impactDiff;
  if (right.score !== left.score) return right.score - left.score;
  return new Date(right.pubDate).getTime() - new Date(left.pubDate).getTime();
};

export async function GET() {
  try {
    const allItems = (
      await Promise.all(RSS_FEEDS.map(({ url, lang }) => fetchRSS(url, lang)))
    ).flat();

    // 언어별 중복 제거
    const seenKo = new Set<string>();
    const seenEn = new Set<string>();
    const unique = allItems.filter((item) => {
      const key = `${item.title.slice(0, 80)}|${item.link}`.toLowerCase();
      const seen = item.lang === "ko" ? seenKo : seenEn;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 7일 이내 기사만 유효
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const isRecent = (item: RssItem) => {
      if (!item.pubDate) return false;
      const t = new Date(item.pubDate).getTime();
      return !isNaN(t) && t >= cutoff;
    };

    const scoreAndSort = (items: RssItem[]): GeoNewsItem[] =>
      items
        .filter(isRecent)
        .map((item) => {
          const result = scoreItem(item);
          if (!result) return null;
          return {
            ...item,
            regionKo: result.pattern.regionKo,
            regionEn: result.pattern.regionEn,
            impact: result.pattern.impact,
            assets: result.pattern.assets,
            score: result.score,
          };
        })
        .filter((item): item is GeoNewsItem => item !== null)
        .sort(sortByImpact)
        .slice(0, 8);

    const itemsKo = scoreAndSort(unique.filter((i) => i.lang === "ko"));
    const itemsEn = scoreAndSort(unique.filter((i) => i.lang === "en"));

    const combined = [...itemsKo, ...itemsEn];
    const overallRisk: "HIGH" | "MEDIUM" | "LOW" | "CLEAR" =
      combined.some((i) => i.impact === "HIGH")
        ? "HIGH"
        : combined.some((i) => i.impact === "MEDIUM")
          ? "MEDIUM"
          : combined.length > 0
            ? "LOW"
            : "CLEAR";

    return NextResponse.json({
      itemsKo,
      itemsEn,
      overallRisk,
      fetchedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      itemsKo: [],
      itemsEn: [],
      overallRisk: "CLEAR",
      fetchedAt: new Date().toISOString(),
    });
  }
}
