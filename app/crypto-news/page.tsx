"use client";

import NewsFeedPage from "@/components/news/NewsFeedPage";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export default function CryptoNewsPage() {
  const { language } = useLanguage();

  return (
    <NewsFeedPage
      title={language === "ko" ? "전체 코인 뉴스" : "All crypto news"}
      intro={
        language === "ko"
          ? "비트코인, 이더리움, ETF, 규제 이슈까지 주요 코인 뉴스를 한 화면에서 정리해 보여드립니다."
          : "Review Bitcoin, Ethereum, ETF, and regulation headlines in one stream."
      }
      badge={language === "ko" ? "코인 스트림" : "CRYPTO STREAM"}
      variant="crypto"
      quickFilters={["Bitcoin", "Ethereum", "ETF", "SEC", "Layer2", "Solana"]}
      fetchUrl="/api/news/crypto"
      getItems={(json) => json.results || []}
      getItemKey={(item, index) => item.id || `${item.slug}-${index}`}
      getItemLink={(item) => `https://cryptopanic.com/news/${item.slug}`}
      getItemTitle={(item, currentLanguage) =>
        currentLanguage === "ko" ? item.title_ko || item.title || "Untitled" : item.title || item.title_ko || "Untitled"
      }
      getItemSummary={(item, currentLanguage) =>
        currentLanguage === "ko"
          ? item.summary_ko || item.description || item.summary || ""
          : item.summary || item.description || item.summary_ko || ""
      }
      getDetailLink={(item) => item.content_url || `https://cryptopanic.com/news/${item.slug}`}
    />
  );
}
