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
      title: "전체 코인 뉴스",
      intro: "비트코인, 이더리움, ETF, 규제 이슈까지 주요 코인 뉴스를 한 화면에서 정리해 보여드립니다.",
      badge: "코인 스트림",
      quickFilters: ["Bitcoin", "Ethereum", "ETF", "SEC", "Layer2", "Solana"]
    },
    en: {
      title: "All crypto news",
      intro: "Review Bitcoin, Ethereum, ETF, and regulation headlines in one stream.",
      badge: "CRYPTO STREAM",
      quickFilters: ["Bitcoin", "Ethereum", "ETF", "SEC", "Layer2", "Solana"]
    }
  },
  stock: {
    ko: {
      title: "전체 주식 뉴스",
      intro: "미국 주식 시장에서 지금 주목받는 헤드라인과 요약을 한 번에 확인해보세요.",
      badge: "주식 흐름",
      quickFilters: ["ETF", "Fed", "AI", "Tesla", "NVIDIA", "Earnings"]
    },
    en: {
      title: "All stock news",
      intro: "See the stock headlines and summaries drawing the most attention right now.",
      badge: "US STOCK FLOW",
      quickFilters: ["ETF", "Fed", "AI", "Tesla", "NVIDIA", "Earnings"]
    }
  }
};

export function getNewsPageConfig(variant: NewsPageVariant, language: Language) {
  return NEWS_PAGE_COPY[variant][language];
}
