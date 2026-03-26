"use client";

import NewsFeedPage from "@/components/news/NewsFeedPage";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { getNewsPageConfig } from "@/components/news/newsPageConfig";

export default function CryptoNewsPage() {
  const { language } = useLanguage();
  const config = getNewsPageConfig("crypto", language);

  return (
    <NewsFeedPage
      title={config.title}
      intro={config.intro}
      badge={config.badge}
      variant="crypto"
      quickFilters={config.quickFilters}
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
