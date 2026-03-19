"use client";

import NewsFeedPage from "@/components/news/NewsFeedPage";

export default function StockNewsPage() {
  return (
    <NewsFeedPage
      title="전체 주식 뉴스"
      intro="미국 주식 흐름을 크게 바꿀 수 있는 핵심 헤드라인을 정렬하고, 즐겨찾기와 필터로 매일 보기 좋게 정리했습니다."
      badge="US STOCK FLOW"
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
