import { Language } from "@/components/i18n/LanguageProvider";

type NewsPageVariant = "crypto" | "stock";

type NewsPageConfig = {
  title: string;
  intro: string;
  badge: string;
  quickFilters: string[];
};

const NEWS_PAGE_COPY: Record<NewsPageVariant, Record<Language, NewsPageConfig>> = {
  crypto: {
    ko: {
      title: "전체 한국주식 뉴스",
      intro: "코스피, 코스닥, 반도체, 대형주 흐름을 한국주식 관점에서 한 번에 살펴볼 수 있습니다.",
      badge: "KOREA STOCK FLOW",
      quickFilters: ["코스피", "코스닥", "삼성전자", "SK하이닉스", "반도체", "외국인"]
    },
    en: {
      title: "All Korean stock news",
      intro: "Track Korea market headlines, semiconductors, and major local equities in one stream.",
      badge: "KOREA STOCK FLOW",
      quickFilters: ["KOSPI", "KOSDAQ", "Samsung", "SK hynix", "Semiconductor", "Foreign flows"]
    }
  },
  stock: {
    ko: {
      title: "전체 미국주식 뉴스",
      intro: "미국주식 시장에서 지금 주목받는 헤드라인과 요약을 한 번에 확인해보세요.",
      badge: "US STOCK FLOW",
      quickFilters: ["ETF", "Fed", "AI", "Tesla", "NVIDIA", "Earnings"]
    },
    en: {
      title: "All US stock news",
      intro: "See the US stock headlines and summaries drawing the most attention right now.",
      badge: "US STOCK FLOW",
      quickFilters: ["ETF", "Fed", "AI", "Tesla", "NVIDIA", "Earnings"]
    }
  }
};

export function getNewsPageConfig(variant: NewsPageVariant, language: Language) {
  return NEWS_PAGE_COPY[variant][language];
}
