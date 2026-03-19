"use client";

import NewsFeedPage from "@/components/news/NewsFeedPage";

export default function StockNewsPage() {
  return (
    <NewsFeedPage
      title="\uC804\uCCB4 \uC8FC\uC2DD \uB274\uC2A4"
      intro="\uBBF8\uAD6D \uC8FC\uC2DD \uD750\uB984\uC744 \uD06C\uAC8C \uBC14\uAFC0 \uC218 \uC788\uB294 \uD575\uC2EC \uD5E4\uB4DC\uB77C\uC778\uC744 \uC815\uB82C\uD558\uACE0, \uC990\uACA8\uCC3E\uAE30\uC640 \uD544\uD130\uB85C \uB9E4\uC77C \uBCF4\uAE30 \uC88B\uAC8C \uC815\uB9AC\uD588\uC2B5\uB2C8\uB2E4."
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
