"use client";

import NewsFeedPage from "@/components/news/NewsFeedPage";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { getNewsPageConfig } from "@/components/news/newsPageConfig";

export default function KoreaStockNewsPage() {
  const { language } = useLanguage();
  const config = getNewsPageConfig("korea", language);

  return (
    <NewsFeedPage
      title={config.title}
      intro={config.intro}
      badge={config.badge}
      variant="korea"
      quickFilters={config.quickFilters}
      fetchUrl="/api/news/korea"
      getItems={(json) => json.results || []}
      getItemKey={(item, index) => item.id || `${item.content_url}-${index}`}
      getItemLink={(item) => item.content_url}
      getItemTitle={(item, currentLanguage) =>
        currentLanguage === "ko"
          ? item.title_ko || item.title || "제목 없음"
          : item.title || item.title_ko || "Untitled"
      }
      getItemSummary={(item, currentLanguage) =>
        currentLanguage === "ko"
          ? item.summary_ko || item.description || item.summary || ""
          : item.summary || item.description || item.summary_ko || ""
      }
      getDetailLink={(item) => item.content_url}
    />
  );
}
