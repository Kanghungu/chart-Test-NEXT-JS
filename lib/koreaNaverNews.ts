import type { NewsItem } from "@/components/news/newsTypes";

const NAVER_KOREA_STOCK_NEWS_URL = "https://m.stock.naver.com/api/news/stock/005930?pageSize=30";

function normalizeDateTime(value?: string) {
  if (!value || value.length !== 12) return "";

  const year = value.slice(0, 4);
  const month = value.slice(4, 6);
  const day = value.slice(6, 8);
  const hour = value.slice(8, 10);
  const minute = value.slice(10, 12);

  return `${year}-${month}-${day}T${hour}:${minute}:00+09:00`;
}

/** 네이버 증권 삼성 뉴스 피드 → 공통 NewsItem[] */
export async function fetchKoreaStockNewsFromNaver(): Promise<NewsItem[]> {
  const res = await fetch(NAVER_KOREA_STOCK_NEWS_URL, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Naver news failed: ${res.status}`);
  }

  const json = await res.json();
  const groups = Array.isArray(json) ? json : [];

  return groups
    .flatMap((group) => (Array.isArray(group?.items) ? group.items : []))
    .map((item: Record<string, unknown>) => ({
      id: item.id as string | number | undefined,
      title: (item.titleFull || item.title || "Untitled") as string,
      title_ko: (item.titleFull || item.title || "제목 없음") as string,
      description: (item.body || "") as string,
      summary: (item.body || "") as string,
      summary_ko: (item.body || "") as string,
      publisher: (item.officeName || "네이버 증권") as string,
      published_at: normalizeDateTime(item.datetime as string | undefined),
      created_at: normalizeDateTime(item.datetime as string | undefined),
      content_url: (item.mobileNewsUrl || "") as string
    }));
}
