"use client";

import NewsFeedPage from "@/components/news/NewsFeedPage";

export default function CryptoNewsPage() {
  return (
    <NewsFeedPage
      title="전체 코인 뉴스"
      intro="비트코인, 이더리움, 규제, ETF 이슈처럼 시장 방향에 영향을 주는 코인 뉴스를 한 화면에서 정리해 보여줍니다."
      badge="CRYPTO STREAM"
      variant="crypto"
      quickFilters={["Bitcoin", "Ethereum", "ETF", "SEC", "Layer2", "Solana"]}
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
