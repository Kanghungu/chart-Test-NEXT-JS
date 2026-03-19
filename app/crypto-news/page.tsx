"use client";

import NewsFeedPage from "@/components/news/NewsFeedPage";

export default function CryptoNewsPage() {
  return (
    <NewsFeedPage
      title="\uC804\uCCB4 \uCF54\uC778 \uB274\uC2A4"
      intro="\uBE44\uD2B8\uCF54\uC778, \uC774\uB354\uB9AC\uC6C0, \uC54C\uD2B8 \uC21C\uD658 \uD750\uB984\uC744 \uD55C \uBC88\uC5D0 \uBCFC \uC218 \uC788\uB3C4\uB85D \uC2E4\uC2DC\uAC04 \uD5E4\uB4DC\uB77C\uC778\uACFC \uD575\uC2EC \uC694\uC57D\uC744 \uBAA8\uC544\uB1A8\uC2B5\uB2C8\uB2E4."
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
