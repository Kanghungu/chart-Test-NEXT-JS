"use client";

import NewsFeedPage from "@/components/news/NewsFeedPage";

export default function StockNewsPage() {
  return (
    <NewsFeedPage
      title="전체 주식 뉴스"
      intro="미국 주식 시장에서 지금 많이 언급되는 헤드라인을 모아서 보고, 핵심 뉴스만 빠르게 훑을 수 있게 정리했습니다."
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
