"use client";
import React, { useEffect, useMemo, useState } from "react";
import "./NewsList.css";

type NewsType = "crypto" | "stock";
type FilterType = "all" | NewsType;
type SortType = "latest" | "impact";

interface NewsItem {
  id?: string | number;
  slug?: string;
  title?: string;
  title_ko?: string;
  description?: string;
  summary_ko?: string;
  publisher?: string;
  published_at?: string;
  created_at?: string;
  content_url?: string;
  [key: string]: any;
}

const IMPACT_KEYWORDS = [
  "etf",
  "sec",
  "fed",
  "fomc",
  "lawsuit",
  "regulation",
  "bankruptcy",
  "hack",
  "liquidation",
  "upgrade",
  "earnings",
  "guidance",
  "downgrade",
  "upgrade"
];

function decodeHtmlEntities(str: string) {
  if (!str) return "";
  const txt = document.createElement("textarea");
  txt.innerHTML = str;
  return txt.value;
}

function getTitle(item: NewsItem) {
  return decodeHtmlEntities(item.title_ko || item.title || "Untitled");
}

function getPublishedAt(item: NewsItem) {
  return item.published_at || item.created_at || "";
}

function getLink(item: NewsItem, type: NewsType) {
  if (type === "crypto" && item.slug) {
    return `https://cryptopanic.com/news/${item.slug}`;
  }
  return item.content_url || "#";
}

function getImpactScore(item: NewsItem, type: NewsType) {
  const title = `${item.title_ko || ""} ${item.title || ""} ${item.summary_ko || ""} ${item.description || ""}`.toLowerCase();

  let score = 0;
  for (const keyword of IMPACT_KEYWORDS) {
    if (title.includes(keyword)) {
      score += 2;
    }
  }

  if (type === "crypto" && item?.votes) {
    const positive = Number(item.votes.positive || 0);
    const negative = Number(item.votes.negative || 0);
    if (Math.abs(positive - negative) >= 5) {
      score += 2;
    }
  }

  const published = getPublishedAt(item);
  if (published) {
    const ageHours = (Date.now() - new Date(published).getTime()) / 1000 / 60 / 60;
    if (ageHours <= 6) score += 2;
    else if (ageHours <= 24) score += 1;
  }

  return score;
}

function sortItems(items: NewsItem[], type: NewsType, sort: SortType) {
  const copied = [...items];

  if (sort === "impact") {
    copied.sort((a, b) => {
      const scoreDiff = getImpactScore(b, type) - getImpactScore(a, type);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(getPublishedAt(b)).getTime() - new Date(getPublishedAt(a)).getTime();
    });
    return copied;
  }

  copied.sort((a, b) => new Date(getPublishedAt(b)).getTime() - new Date(getPublishedAt(a)).getTime());
  return copied;
}

export default function NewsList() {
  const [cryptoNews, setCryptoNews] = useState<NewsItem[]>([]);
  const [stockNews, setStockNews] = useState<NewsItem[]>([]);
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [sortType, setSortType] = useState<SortType>("latest");
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    fetch("/api/news/crypto")
      .then((res) => res.json())
      .then((data) => setCryptoNews(data.results || []));

    fetch("/api/news/stock")
      .then((res) => res.json())
      .then((json) => setStockNews(json.data || []));
  }, []);

  const preparedCryptoNews = useMemo(() => {
    const filtered = cryptoNews.filter((item) => {
      const title = getTitle(item).toLowerCase();
      const body = decodeHtmlEntities(item.description || "").toLowerCase();
      const query = keyword.trim().toLowerCase();
      if (!query) return true;
      return title.includes(query) || body.includes(query);
    });
    return sortItems(filtered, "crypto", sortType);
  }, [cryptoNews, keyword, sortType]);

  const preparedStockNews = useMemo(() => {
    const filtered = stockNews.filter((item) => {
      const title = getTitle(item).toLowerCase();
      const body = decodeHtmlEntities(item.summary_ko || "").toLowerCase();
      const query = keyword.trim().toLowerCase();
      if (!query) return true;
      return title.includes(query) || body.includes(query);
    });
    return sortItems(filtered, "stock", sortType);
  }, [stockNews, keyword, sortType]);

  const newsSignals = useMemo(() => {
    const list: { title: string; score: number; type: NewsType }[] = [];

    preparedCryptoNews.slice(0, 20).forEach((item) => {
      const score = getImpactScore(item, "crypto");
      if (score >= 5) {
        list.push({ title: getTitle(item), score, type: "crypto" });
      }
    });

    preparedStockNews.slice(0, 20).forEach((item) => {
      const score = getImpactScore(item, "stock");
      if (score >= 5) {
        list.push({ title: getTitle(item), score, type: "stock" });
      }
    });

    list.sort((a, b) => b.score - a.score);

    if (!list.length) {
      return ["현재 강한 뉴스 시그널은 없습니다. 실시간 헤드라인을 추적 중입니다."];
    }

    return list.slice(0, 3).map((item) => `${item.type === "crypto" ? "코인" : "주식"} 시그널: ${item.title}`);
  }, [preparedCryptoNews, preparedStockNews]);

  const showCrypto = filterType === "all" || filterType === "crypto";
  const showStock = filterType === "all" || filterType === "stock";

  return (
    <div className="w-full space-y-4">
      <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {(["all", "crypto", "stock"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                filterType === type ? "bg-blue-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {type === "all" ? "전체" : type === "crypto" ? "코인" : "주식"}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="키워드 검색 (ETF, 금리, 테슬라...)"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
          />

          <select
            value={sortType}
            onChange={(e) => setSortType(e.target.value as SortType)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
          >
            <option value="latest">최신순</option>
            <option value="impact">영향도순</option>
          </select>

          <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300 flex items-center">
            코인 {preparedCryptoNews.length} | 주식 {preparedStockNews.length}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
        <p className="text-xs font-semibold text-amber-300 mb-2">뉴스 시그널</p>
        <ul className="space-y-1">
          {newsSignals.map((signal, idx) => (
            <li key={`${signal}-${idx}`} className="text-sm text-amber-100">
              {signal}
            </li>
          ))}
        </ul>
      </div>

      <div className="news-container w-full">
        {showCrypto && (
          <section className={`w-full min-w-0 overflow-hidden bg-gray-900/80 rounded-2xl shadow-lg p-4 border border-gray-700 flex flex-col max-h-[620px] ${showCrypto && !showStock ? "md:col-span-2" : ""}`}>
            <h3 className="text-xl font-bold text-blue-400 mb-3 flex items-center gap-2">
              <span>코인</span> 뉴스
            </h3>
            <ul className="space-y-4 overflow-y-auto pr-1 max-h-[540px]">
              {preparedCryptoNews.map((n, idx) => (
                <li key={n.id || `${n.slug}-${idx}`} className="bg-gray-800 rounded-xl p-4 shadow hover:shadow-xl border border-gray-700 transition-all group">
                  <a
                    href={getLink(n, "crypto")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-lg font-semibold text-gray-100 group-hover:text-blue-300 truncate"
                    title={getTitle(n)}
                  >
                    {getTitle(n)}
                  </a>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mt-2">
                    <span className="truncate">{n.publisher || "출처 미상"}</span>
                    <span className="truncate text-right">{getPublishedAt(n) || "-"}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {showStock && (
          <section className={`w-full min-w-0 overflow-hidden bg-gray-900/80 rounded-2xl shadow-lg p-4 border border-gray-700 flex flex-col max-h-[620px] ${showStock && !showCrypto ? "md:col-span-2" : ""}`}>
            <h3 className="text-xl font-bold text-green-400 mb-3 flex items-center gap-2">
              <span>주식</span> 뉴스
            </h3>
            <ul className="space-y-4 overflow-y-auto pr-1 max-h-[540px]">
              {preparedStockNews.map((n, idx) => (
                <li key={n.id || `${n.content_url}-${idx}`} className="bg-gray-800 rounded-xl p-4 shadow hover:shadow-xl border border-gray-700 transition-all group">
                  <a
                    href={getLink(n, "stock")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-lg font-semibold text-gray-100 group-hover:text-green-300 truncate"
                    title={getTitle(n)}
                  >
                    {getTitle(n)}
                  </a>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mt-2">
                    <span className="truncate">{n.publisher || "출처 미상"}</span>
                    <span className="truncate text-right">{getPublishedAt(n) || "-"}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
