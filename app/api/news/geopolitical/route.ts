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
    keywords: ["taiwan", "대만", "taiwan strait", "대만 해협", "tsmc", "chip war", "반도체 전쟁", "pla", "china military", "중국 군"],
    assets: [
      { symbol: "NVDA",   nameKo: "NVDA",       nameEn: "NVDA",       dir: "down" },
      { symbol: "TSM",    nameKo: "TSMC",       nameEn: "TSMC",       dir: "down" },
      { symbol: "KOSPI",  nameKo: "KOSPI",      nameEn: "KOSPI",      dir: "down" },
      { symbol: "USD",    nameKo: "달러",       nameEn: "Dollar",     dir: "up"   },
      { symbol: "000660", nameKo: "SK하이닉스", nameEn: "SK Hynix",   dir: "down" },
    ],
    impact: "HIGH" as const,
  },
  {
    id: "russia_ukraine",
    regionKo: "러시아/우크라이나",
    regionEn: "Russia/Ukraine",
    keywords: ["russia", "러시아", "ukraine", "우크라이나", "putin", "푸틴", "nato", "nafo", "war escalation", "전쟁 확전", "젤렌스키", "zelensky"],
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
    keywords: ["china tariff", "중국 관세", "trade war", "무역전쟁", "chip ban", "반도체 수출 규제", "decoupling", "디커플링", "export control", "미중", "관세 전쟁"],
    assets: [
      { symbol: "000660", nameKo: "SK하이닉스", nameEn: "SK Hynix", dir: "down" },
      { symbol: "005930", nameKo: "삼성전자",   nameEn: "Samsung",  dir: "down" },
      { symbol: "NVDA",   nameKo: "NVDA",       nameEn: "NVDA",     dir: "down" },
      { symbol: "USD",    nameKo: "달러",       nameEn: "Dollar",   dir: "up"   },
    ],
    impact: "MEDIUM" as const,
  },
  {
    id: "oil_opec",
    regionKo: "유가/OPEC",
    regionEn: "Oil/OPEC",
    keywords: ["opec", "oil price", "유가", "crude oil", "원유", "production cut", "감산", "brent", "wti spike", "산유국"],
    assets: [
      { symbol: "OIL",   nameKo: "WTI 유가", nameEn: "WTI Oil", dir: "up"   },
      { symbol: "KRW",   nameKo: "원화",     nameEn: "KRW",     dir: "down" },
      { symbol: "KOSPI", nameKo: "KOSPI",    nameEn: "KOSPI",   dir: "down" },
    ],
    impact: "MEDIUM" as const,
  },
];

type RssItem = {
  title: string;
  description: string;
  pubDate: string;
  link: string;
  lang: "ko" | "en";
};

function parseRSS(xml: string, lang: "ko" | "en"): RssItem[] {
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
      lang,
    });
  }
  return items;
}

const RSS_FEEDS: Array<{ url: string; lang: "ko" | "en" }> = [
  // 영문 소스
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml",               lang: "en" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml",    lang: "en" },
  // 한국어 소스
  { url: "https://www.yna.co.kr/rss/news.xml",                        lang: "ko" }, // 연합뉴스
  { url: "https://www.hankyung.com/feed/international-news",           lang: "ko" }, // 한국경제 국제
];

async function fetchRSS(url: string, lang: "ko" | "en"): Promise<RssItem[]> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; MarketPulseBot/1.0)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSS(xml, lang);
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
  lang: "ko" | "en";
  regionKo: string;
  regionEn: string;
  impact: "HIGH" | "MEDIUM" | "LOW";
  assets: Array<{ symbol: string; nameKo: string; nameEn: string; dir: "up" | "down" }>;
  score: number;
};

export async function GET() {
  try {
    const allItems = (
      await Promise.all(RSS_FEEDS.map(({ url, lang }) => fetchRSS(url, lang)))
    ).flat();

    // 언어별 중복 제거 (제목 기준)
    const seenKo = new Set<string>();
    const seenEn = new Set<string>();
    const unique = allItems.filter((item) => {
      const key = item.title.slice(0, 60).toLowerCase();
      const seen = item.lang === "ko" ? seenKo : seenEn;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const sortFn = (a: GeoNewsItem, b: GeoNewsItem) => {
      const impactOrder = { HIGH: 2, MEDIUM: 1, LOW: 0 };
      const impactDiff = impactOrder[b.impact] - impactOrder[a.impact];
      if (impactDiff !== 0) return impactDiff;
      if (b.score !== a.score) return b.score - a.score;
      return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
    };

    // 언어별로 스코어링 후 각 8개씩 유지
    const scoreItems = (items: RssItem[]): GeoNewsItem[] =>
      items
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
        .sort(sortFn)
        .slice(0, 8);

    const koItems = scoreItems(unique.filter((i) => i.lang === "ko"));
    const enItems = scoreItems(unique.filter((i) => i.lang === "en"));

    // overallRisk는 두 소스 중 더 높은 것 기준
    const combined = [...koItems, ...enItems];
    const overallRisk: "HIGH" | "MEDIUM" | "LOW" | "CLEAR" =
      combined.some((i) => i.impact === "HIGH")
        ? "HIGH"
        : combined.some((i) => i.impact === "MEDIUM")
          ? "MEDIUM"
          : combined.length > 0
            ? "LOW"
            : "CLEAR";

    return NextResponse.json({
      itemsKo: koItems,
      itemsEn: enItems,
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
