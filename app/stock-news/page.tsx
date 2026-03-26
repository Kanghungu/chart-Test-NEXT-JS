"use client";

import NewsFeedPage from "@/components/news/NewsFeedPage";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export default function StockNewsPage() {
  const { language } = useLanguage();

  return (
    <NewsFeedPage
      title={language === "ko" ? "전체 주식 뉴스" : "All stock news"}
      intro={
        language === "ko"
          ? "미국 주식 시장에서 지금 주목받는 헤드라인과 요약을 한 번에 확인해 보세요."
          : "See the stock headlines and summaries drawing the most attention right now."
      }
      badge={language === "ko" ? "주식 흐름" : "US STOCK FLOW"}
      variant="stock"
      quickFilters={["ETF", "Fed", "AI", "Tesla", "NVIDIA", "Earnings"]}
      fetchUrl="/api/news/stock"
      getItems={(json) => json.data || []}
      getItemKey={(item, index) => item.id || `${item.content_url}-${index}`}
      getItemLink={(item) => item.content_url}
      getItemTitle={(item) => item.title_ko || item.title || "Untitled"}
      getItemSummary={(item) => item.summary_ko || ""}
      getDetailLink={(item) => item.content_url}
    />
  );
}
