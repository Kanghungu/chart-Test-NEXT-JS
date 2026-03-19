"use client";

import NewsFeedPage from "@/components/news/NewsFeedPage";

export default function StockNewsPage() {
  return (
    <NewsFeedPage
      title="전체 주식 뉴스"
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
