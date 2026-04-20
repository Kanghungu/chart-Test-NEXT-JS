import { NextResponse } from "next/server";

export const revalidate = 300; // 5분 캐시

// 지정학 리스크 패턴 - 키워드 → 영향 자산 매핑
const RISK_PATTERNS = [
  {
    id: "iran",
    regionKo: "중동/이란",
    regionEn: "Middle East/Iran",
    keywords: ["iran", "이란", "hormuz", "호르무즈", "tehran", "테헤란", "persian gulf", "strait of hormuz", "irgc", "sanctions iran"],
    assets: [
      { symbol: "OIL",   nameKo: "WTI 유가",  nameEn: "WTI Oil",   dir: "up"   },
      { symbol: "XAU",   nameKo: "금",         nameEn: "Gold",       dir: "up"   },
      { symbol: "KRW",   nameKo: "원화",       nameEn: "KRW",        dir: "down" },
      { symbol: "KOSPI", nameKo: "KOSPI",      nameEn: "KOSPI",      dir: "down" },
      { symbol: "DEF",   nameKo: "방산주",     nameEn: "Defense",    dir: "up"   },
    ],
    impact: "HIGH" as const,
  },
  {
    id: "northkorea",
    regionKo: "북한",
    regionEn: "North Korea",
    keywords: ["north korea", "북한", "김정은", "kim jong", "pyongyang", "평양", "missile launch", "미사일", "nuclear", "핵실험", "dprk"],
    assets: [
      { symbol: "KOSPI", nameKo: "KOSPI",   nameEn: "KOSPI",   dir: "down" },
      { symbol: "KRW",   nameKo: "원화",    nameEn: "KRW",     dir: "down" },
      { symbol: "DEF",   nameKo: "방산주",  nameEn: "Defense", dir: "up"   },
      { symbol: "JPY",   nameKo: "엔화",    nameEn: "JPY",     dir: "up"   },
    ],
    impact: "HIGH" as const,
  },
  {
    id: "taiwan",
    regionKo: "대만",
    regionEn: "Taiwan",
    keywords: ["taiwan", "대만", "taiwan strait", "대만 해협", "tsmc", "chip war", "반도체 전쟁", "pla", "china military"],
    assets: [
      { symbol: "NVDA",  nameKo: "NVDA",        nameEn: "NVDA",        dir: "down" },
      { symbol: "TSM",   nameKo: "TSMC",        nameEn: "TSMC",        dir: "down" },
      { symbol: "KOSPI", nameKo: "KOSPI",       nameEn: "KOSPI",       dir: "down" },
      { symbol: "USD",   nameKo: "달러",        nameEn: "Dollar",      dir: "up"   },
      { symbol: "000660",nameKo: "SK하이닉스",  nameEn: "SK Hynix",    dir: "down" },
    ],
    impact: "HIGH" as const,
  },
  {
    id: "russia_ukraine",
    regionKo: "러시아/우크라이나",
    regionEn: "Russia/Ukraine",
    keywords: ["russia", "러시아", "ukraine", "우크라이나", "putin", "푸틴", "nato", "nafo", "war escalation", "전쟁 확전"],
    assets: [
      { symbol: "XAU",   nameKo: "금",      nameEn: "Gold",    dir: "up"   },
      { symbol: "OIL",   nameKo: "WTI",     nameEn: "WTI",     dir: "up"   },
      { symbol: "KOSPI", nameKo: "KOSPI",   nameEn: "KOSPI",   dir: "down" },
      { symbol: "EUR",   nameKo: "유로화",  nameEn: "EUR",     dir: "down" },
    ],
    impact: "MEDIUM" as const,
  },
  {
    id: "china_us",
    regionKo: "미중 갈등",
    regionEn: "US-China",
    keywords: ["china tariff", "중국 관세", "trade war", "무역전쟁", "chip ban", "반도체 수출 규제", "decoupling", "디커플링", "export control"],
    assets: [
      { symbol: "000660", nameKo: "SK하이닉스",  nameEn: "SK Hynix",  dir: "down" },
      { symbol: "005930", nameKo: "삼성전자",    nameEn: "Samsung",   dir: "down" },
      { symbol: "NVDA",   nameKo: "NVDA",        nameEn: "NVDA",      dir: "down" },
      { symbol: "USD",    nameKo: "달러",        nameEn: "Dollar",    dir: "up"   },
    ],
    impact: "MEDIUM" as const,
  },
  {
    id: "oil_opec",
    regionKo: "유가/OPEC",
    regionEn: "Oil/OPEC",
    keywords: ["opec", "oil price", "유가", "crude oil", "원유", "production cut", "감산", "brent", "wti spike"],
    assets: [
      { symbol: "OIL",   nameKo: "WTI 유가",  nameEn: "WTI Oil",   dir: "up"   },
      { symbol: "KRW",   nameKo: "원화",      nameEn: "KRW",        dir: "down" },
      { symbol: "KOSPI", nameKo: "KOSPI",     nameEn: "KOSPI",      dir: "down" },
    ],
    impact: "MEDIUM" as const,
  },
];

type RssItem = {
  title: string;
  description: string;
  pubDate: string;
  link: string;
};

function parseRSS(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];

    const extractText = (tag: string): string => {
      const cdataMatch = block.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"));
      if (cdataMatch) return cdataMatch[1].trim();
      const plainMatch = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return plainMatch ? plainMatch[1].replace(/<[^>]+>/g, "").trim() : "";
    };

    items.push({
      title: extractText("title"),
      description: extractText("description"),
      pubDate: extractText("pubDate"),
      link: extractText("link"),
    });
  }
  return items;
}

const RSS_FEEDS = [
  "https://feeds.bbci.co.uk/news/world/rss.xml",
  "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",
];

async function fetchRSS(url: string): Promise<RssItem[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketPulseBot/1.0)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSS(xml);
  } catch {
    return [];
  }
}

function scoreItem(item: RssItem) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  let bestPattern: (typeof RISK_PATTERNS)[0] | null = null;
  let bestScore = 0;

  for (const pattern of RISK_PATTERNS) {
    let score = 0;
    for (const kw of pattern.keywords) {
      if (text.includes(kw.toLowerCase())) {
        score += kw.split(" ").length; // 복합어에 가중치
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestPattern = pattern;
    }
  }

  return bestScore >= 1 ? { pattern: bestPattern!, score: bestScore } : null;
}

export type GeoNewsItem = {
  title: string;
  description: string;
  pubDate: string;
  link: string;
  regionKo: string;
  regionEn: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  assets: Array<{ symbol: string; nameKo: string; nameEn: string; dir: "up" | "down" }>;
  score: number;
};

export async function GET() {
  try {
    const allItems = (await Promise.all(RSS_FEEDS.map(fetchRSS))).flat();

    // 중복 제거 (제목 기준)
    const seen = new Set<string>();
    const unique = allItems.filter((item) => {
      const key = item.title.slice(0, 60).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const scored: GeoNewsItem[] = unique
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
      .filter((x): x is GeoNewsItem => x !== null)
      .sort((a, b) => {
        // HIGH 우선, 같으면 score, 같으면 최신순
        const impactOrder = { HIGH: 2, MEDIUM: 1, LOW: 0 };
        const impactDiff = impactOrder[b.impact] - impactOrder[a.impact];
        if (impactDiff !== 0) return impactDiff;
        if (b.score !== a.score) return b.score - a.score;
        return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
      })
      .slice(0, 8);

    // 전체 위험 수준: HIGH 항목이 있으면 HIGH, MEDIUM만 있으면 MEDIUM
    const overallRisk: "HIGH" | "MEDIUM" | "LOW" | "CLEAR" =
      scored.some((i) => i.impact === "HIGH")
        ? "HIGH"
        : scored.some((i) => i.impact === "MEDIUM")
          ? "MEDIUM"
          : scored.length > 0
            ? "LOW"
            : "CLEAR";

    return NextResponse.json({ items: scored, overallRisk, fetchedAt: new Date().toISOString() });
  } catch {
    return NextResponse.json({ items: [], overallRisk: "CLEAR", fetchedAt: new Date().toISOString() });
  }
}
