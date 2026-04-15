import { formatDateTime } from "@/lib/formatters";
import { NewsItem, NewsType, SortType } from "./newsTypes";
import { Language } from "@/components/i18n/LanguageProvider";

const IMPACT_KEYWORDS = [
  "etf",
  "fed",
  "fomc",
  "earnings",
  "guidance",
  "downgrade",
  "upgrade",
  "반도체",
  "코스피",
  "코스닥",
  "삼성전자",
  "하이닉스",
  "foreign",
  "외국인"
];

export function decodeHtmlEntities(value: string) {
  if (!value || typeof document === "undefined") return value || "";

  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

export function getTitle(item: NewsItem, language: Language = "ko") {
  const preferred = language === "ko" ? item.title_ko || item.title : item.title || item.title_ko;
  return decodeHtmlEntities(preferred || "Untitled");
}

export function getSummary(item: NewsItem, language: Language = "ko") {
  const preferred =
    language === "ko"
      ? item.summary_ko || item.summary || item.description
      : item.summary || item.description || item.summary_ko;

  return decodeHtmlEntities(preferred || "");
}

export function getPublishedAt(item: NewsItem) {
  return item.published_at || item.created_at || "";
}

export function getPublishedLabel(item: NewsItem, language: Language = "ko") {
  return formatDateTime(getPublishedAt(item), language === "ko" ? "ko-KR" : "en-US");
}

export function getPublisher(item: NewsItem, language: Language = "ko") {
  return item.publisher || (language === "ko" ? "출처 미상" : "Unknown source");
}

export function getLink(item: NewsItem, type: NewsType) {
  if (type === "crypto" && item.content_url) {
    return item.content_url;
  }

  if (type === "crypto" && item.slug) {
    return `https://cryptopanic.com/news/${item.slug}`;
  }

  return item.content_url || "#";
}

export function getImpactScore(item: NewsItem, type: NewsType) {
  const sourceText = `${item.title_ko || ""} ${item.title || ""} ${item.summary_ko || ""} ${item.summary || ""} ${item.description || ""}`.toLowerCase();

  let score = 0;

  for (const keyword of IMPACT_KEYWORDS) {
    if (sourceText.includes(keyword)) score += 2;
  }

  if (type === "stock" && sourceText.includes("nvidia")) score += 1;
  if (type === "crypto" && (sourceText.includes("코스피") || sourceText.includes("삼성전자"))) score += 1;

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
  sort: SortType,
  language: Language
) {
  const query = keyword.trim().toLowerCase();

  const filtered = items.filter((item) => {
    if (!query) return true;

    const title = getTitle(item, language).toLowerCase();
    const summary = getSummary(item, language).toLowerCase();
    const publisher = getPublisher(item, language).toLowerCase();

    return title.includes(query) || summary.includes(query) || publisher.includes(query);
  });

  return sortItems(filtered, type, sort);
}

export function buildNewsSignals(cryptoItems: NewsItem[], stockItems: NewsItem[], language: Language) {
  const candidates: { title: string; score: number; type: NewsType }[] = [];

  cryptoItems.slice(0, 20).forEach((item) => {
    const score = getImpactScore(item, "crypto");
    if (score >= 5) candidates.push({ title: getTitle(item, language), score, type: "crypto" });
  });

  stockItems.slice(0, 20).forEach((item) => {
    const score = getImpactScore(item, "stock");
    if (score >= 5) candidates.push({ title: getTitle(item, language), score, type: "stock" });
  });

  candidates.sort((a, b) => b.score - a.score);

  if (!candidates.length) {
    return [
      language === "ko"
        ? "아직 강한 뉴스 시그널이 없습니다. 헤드라인 흐름을 계속 추적하고 있습니다."
        : "No strong news signal yet. We are still tracking the headline flow."
    ];
  }

  return candidates.slice(0, 3).map((item) =>
    language === "ko"
      ? `${item.type === "crypto" ? "한국주식" : "미국주식"} 시그널 · ${item.title}`
      : `${item.type === "crypto" ? "Korean stock" : "US stock"} signal · ${item.title}`
  );
}
