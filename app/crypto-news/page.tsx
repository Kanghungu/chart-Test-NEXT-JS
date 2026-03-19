"use client";

import NewsFeedPage from "@/components/news/NewsFeedPage";

export default function CryptoNewsPage() {
  return (
    <NewsFeedPage
      title="전체 코인 뉴스"
      intro="비트코인, 이더리움, 알트 순환 흐름을 한 번에 볼 수 있도록 실시간 헤드라인과 핵심 요약을 모아놨습니다."
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
