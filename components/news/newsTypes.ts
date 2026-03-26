export type NewsType = "crypto" | "stock";
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
