"use client";

import NewsFeedPage from "@/components/news/NewsFeedPage";

export default function CryptoNewsPage() {
  return (
    <NewsFeedPage
      title="전체 코인 뉴스"
      fetchUrl="/api/news/crypto"
      getItems={(json) => json.results || []}
      getItemKey={(item, index) => item.id || `${item.slug}-${index}`}
      getItemLink={(item) => `https://cryptopanic.com/news/${item.slug}`}
      getItemTitle={(item) => item.title || "Untitled"}
      getItemSummary={(item) => item.description || ""}
      getDetailLink={(item) => item.content_url || `https://cryptopanic.com/news/${item.slug}`}
    />
  );
}
