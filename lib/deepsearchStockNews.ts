import type { NewsItem } from "@/components/news/newsTypes";

/** DeepSearch 글로벌 기사 (환경 변수로 키 덮어쓰기 가능) */
export const DEEPSEARCH_STOCK_NEWS_URL =
  process.env.DEEPSEARCH_NEWS_URL ||
  "https://api-v2.deepsearch.com/v1/global-articles?api_key=bec00d2364fa444b9cdb342e731f73d8";

/** API 한 행 → NewsItem (필드명 버전 차이 흡수) */
export function adaptDeepsearchArticle(raw: Record<string, unknown>): NewsItem {
  return {
    id: (raw.id ?? raw.uuid ?? raw.article_id) as string | number | undefined,
    title: String(raw.title || raw.headline || ""),
    title_ko: String(raw.title || raw.headline || ""),
    summary: String(raw.summary || raw.description || raw.body || ""),
    summary_ko: String(raw.summary || raw.description || raw.body || ""),
    description: String(raw.description || raw.summary || ""),
    publisher: String(raw.source_name || raw.publisher || raw.site_name || raw.source || "Global"),
    published_at: String(raw.published_at || raw.datetime || raw.created_at || ""),
    created_at: String(raw.created_at || raw.published_at || raw.datetime || ""),
    content_url: String(raw.url || raw.article_url || raw.link || raw.content_url || "#")
  };
}

export async function fetchDeepsearchStockNews(): Promise<NewsItem[]> {
  const res = await fetch(DEEPSEARCH_STOCK_NEWS_URL, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`DeepSearch news failed: ${res.status}`);
  }

  const json = (await res.json()) as { data?: unknown[] };
  const rows = Array.isArray(json?.data) ? json.data : [];

  return rows
    .filter((row): row is Record<string, unknown> => row !== null && typeof row === "object")
    .map((row) => adaptDeepsearchArticle(row));
}
