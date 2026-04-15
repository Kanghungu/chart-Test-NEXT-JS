export type NewsType = "korea" | "stock";
export type FilterType = "all" | NewsType;
export type SortType = "latest" | "impact";

export interface NewsItem {
  id?: string | number;
  slug?: string;
  title?: string;
  title_ko?: string;
  description?: string;
  summary?: string;
  summary_ko?: string;
  publisher?: string;
  published_at?: string;
  created_at?: string;
  content_url?: string;
  votes?: {
    positive?: number;
    negative?: number;
  };
  [key: string]: any;
}

/** 주요 뉴스 API 응답용: 한국/미국 구분 */
export type MajorNewsRegion = "korea" | "us";

export type MajorNewsItem = NewsItem & { region: MajorNewsRegion };
