import { NewsItem, NewsType, SortType } from "./newsTypes";

const IMPACT_KEYWORDS = [
  "etf",
  "sec",
  "fed",
  "fomc",
  "lawsuit",
  "regulation",
  "bankruptcy",
  "hack",
  "liquidation",
  "upgrade",
  "earnings",
  "guidance",
  "downgrade"
];

export function decodeHtmlEntities(str: string) {
  if (!str) return "";

  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
}

export function getTitle(item: NewsItem) {
  return decodeHtmlEntities(item.title_ko || item.title || "Untitled");
}

export function getPublishedAt(item: NewsItem) {
  return item.published_at || item.created_at || "";
}

export function getLink(item: NewsItem, type: NewsType) {
  if (type === "crypto" && item.slug) {
    return `https://cryptopanic.com/news/${item.slug}`;
  }

  return item.content_url || "#";
}

export function getImpactScore(item: NewsItem, type: NewsType) {
  const sourceText = `${item.title_ko || ""} ${item.title || ""} ${item.summary_ko || ""} ${item.description || ""}`.toLowerCase();

  let score = 0;

  for (const keyword of IMPACT_KEYWORDS) {
    if (sourceText.includes(keyword)) {
      score += 2;
    }
  }

  if (type === "crypto" && item.votes) {
    const positive = Number(item.votes.positive || 0);
    const negative = Number(item.votes.negative || 0);

    if (Math.abs(positive - negative) >= 5) {
      score += 2;
    }
  }

  const published = getPublishedAt(item);
  if (published) {
    const ageHours = (Date.now() - new Date(published).getTime()) / 1000 / 60 / 60;

    if (ageHours <= 6) score += 2;
    else if (ageHours <= 24) score += 1;
  }

  return score;
}

export function sortItems(items: NewsItem[], type: NewsType, sort: SortType) {
  const copied = [...items];

  if (sort === "impact") {
    copied.sort((a, b) => {
      const scoreDiff = getImpactScore(b, type) - getImpactScore(a, type);
      if (scoreDiff !== 0) return scoreDiff;

      return new Date(getPublishedAt(b)).getTime() - new Date(getPublishedAt(a)).getTime();
    });

    return copied;
  }

  copied.sort((a, b) => new Date(getPublishedAt(b)).getTime() - new Date(getPublishedAt(a)).getTime());
  return copied;
}

export function filterAndSortNews(
  items: NewsItem[],
  type: NewsType,
  keyword: string,
  bodySelector: (item: NewsItem) => string,
  sort: SortType
) {
  const query = keyword.trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (!query) return true;

    const title = getTitle(item).toLowerCase();
    const body = decodeHtmlEntities(bodySelector(item)).toLowerCase();
    return title.includes(query) || body.includes(query);
  });

  return sortItems(filtered, type, sort);
}

export function buildNewsSignals(cryptoItems: NewsItem[], stockItems: NewsItem[]) {
  const candidates: { title: string; score: number; type: NewsType }[] = [];

  cryptoItems.slice(0, 20).forEach((item) => {
    const score = getImpactScore(item, "crypto");
    if (score >= 5) {
      candidates.push({ title: getTitle(item), score, type: "crypto" });
    }
  });

  stockItems.slice(0, 20).forEach((item) => {
    const score = getImpactScore(item, "stock");
    if (score >= 5) {
      candidates.push({ title: getTitle(item), score, type: "stock" });
    }
  });

  candidates.sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    return ["현재 강한 뉴스 시그널은 없습니다. 실시간 헤드라인을 추적 중입니다."];
  }

  return candidates
    .slice(0, 3)
    .map((item) => `${item.type === "crypto" ? "코인" : "주식"} 시그널: ${item.title}`);
}
