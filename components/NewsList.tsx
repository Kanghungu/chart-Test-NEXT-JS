"use client";
import React, { useEffect, useState } from "react";
import "./NewsList.css";

interface NewsItem {
    id?: string | number;
    slug?: string;
    title: string;
    title_ko: string;
    description?: string;
    summary_ko?: string;
    publisher?: string;
    published_at?: string;
    content_url?: string;
}
function decodeHtmlEntities(str: string) {
    if (!str) return "";
    const txt = document.createElement("textarea");
    txt.innerHTML = str;
    return txt.value;
}
export default function NewsList() {
    const [cryptoNews, setCryptoNews] = useState<NewsItem[]>([]);
    const [stockNews, setStockNews] = useState<NewsItem[]>([]);

    useEffect(() => {
        // ✅ 암호화폐 뉴스 가져오기
        fetch("/api/news/crypto")
            .then((res) => res.json())
            .then((data) => setCryptoNews(data.results || []));

        // ✅ 주식 뉴스 가져오기
        fetch("/api/news/stock")
            .then((res) => res.json())
            .then((json) => setStockNews(json.data || []));
    }, []);

    return (
        <div className="news-container">
            {/* Crypto News 섹션 */}
            <section className="bg-gray-900/80 rounded-2xl shadow-lg p-4 border border-gray-700 flex flex-col">
                <h3 className="text-xl font-bold text-blue-400 mb-3 flex items-center gap-2">
                    <span>🪙</span> Crypto News
                </h3>
                <ul className="space-y-4">
                    {cryptoNews.map((n) => (
                        <li key={n.id} className="bg-gray-800 rounded-xl p-4 shadow hover:shadow-xl border border-gray-700 transition-all group">
                            <a
                                href={`https://cryptopanic.com/news/${n.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-lg font-semibold text-gray-100 group-hover:text-blue-300 truncate"
                                title={decodeHtmlEntities(n.title)}
                            >
                                {decodeHtmlEntities(n.title_ko || n.title)}
                            </a>
                            <div className="flex justify-between text-xs text-gray-400 mt-2">
                                <span>{n.publisher}</span>
                                <span>{n.published_at}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            {/* Stock News 섹션 */}
            <section className="bg-gray-900/80 rounded-2xl shadow-lg p-4 border border-gray-700 flex flex-col">
                <h3 className="text-xl font-bold text-green-400 mb-3 flex items-center gap-2">
                    <span>📈</span> Stock News
                </h3>
                <ul className="space-y-4">
                    {stockNews.map((n) => (
                        <li key={n.id} className="bg-gray-800 rounded-xl p-4 shadow hover:shadow-xl border border-gray-700 transition-all group">
                            <a
                                href={`https://cryptopanic.com/news/${n.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block text-lg font-semibold text-gray-100 group-hover:text-green-300 truncate"
                                title={decodeHtmlEntities(n.title)}
                            >
                                {decodeHtmlEntities(n.title_ko || n.title)}
                            </a>
                            <div className="flex justify-between text-xs text-gray-400 mt-2">
                                <span>{n.publisher}</span>
                                <span>{n.published_at}</span>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
