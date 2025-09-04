"use client";
import React from "react";
import { useEffect, useState } from "react";

interface NewsItem {
    publisher: any;
    summary_ko: any;
    title_ko: any;
    content_url: any;
    description: any;
    slug: string | undefined;
    id: any;
    title: string;
    url: string;
    source_name?: string;
    published_at: string;
}

export default function NewsList() {
    const [cryptoNews, setCryptoNews] = useState<NewsItem[]>([]);
    const [stockNews, setStockNews] = useState<NewsItem[]>([]);

    useEffect(() => {
        // 암호화폐 뉴스
        fetch("/api/news/crypto")
            .then((res) => res.json())
            .then((data) => setCryptoNews(data.results || [])); // ✅ results로 수정

        // 주식 뉴스
        fetch("/api/news/stock")
            .then((res) => res.json())
            .then((json) => setStockNews(json.data || []));
    }, []);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Crypto News 섹션 */}
            <section className="p-6 bg-gray-50 rounded-lg shadow-md max-h-[600px] overflow-y-auto">
                {/*<h2 className="text-3xl font-bold mb-4 border-b-2 border-gray-300 pb-2 text-black">
                    Crypto News
                </h2>*/}
                <ul className="divide-y divide-gray-200">
                    {cryptoNews.map((n) => (
                        <li
                            key={n.id}
                            className="py-3 flex flex-col hover:bg-gray-100 transition-colors duration-200"
                        >
                            <a
                                href={`https://cryptopanic.com/news/${n.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 font-medium hover:underline truncate"
                                title={n.title}
                            >
                                {n.title}
                            </a>
                            <div className="text-gray-500 text-sm mt-1">
                                {n.description ? n.description.slice(0, 80) + "..." : ""}
                            </div>
                            <div className="text-gray-400 text-xs mt-1">
                                {n.published_at
                                    ? new Date(n.published_at).toLocaleString()
                                    : "날짜 없음"}
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            {/* Stock News 섹션 */}
            <section className="p-6 bg-gray-50 rounded-lg shadow-md max-h-[600px] overflow-y-auto">
                {/*<h2 className="text-3xl font-bold mb-4 border-b-2 border-gray-300 pb-2 text-black">
                    Stock News
                </h2>*/}
                <ul className="list-disc pl-5">
                    {stockNews.map((n) => (
                        <li key={n.id} className="mb-4">
                            <a
                                href={n.content_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline font-medium"
                            >
                                {n.title_ko}
                            </a>
                            <div className="text-gray-500 text-sm mt-1">
                                {n.summary_ko.slice(0, 100)}...
                            </div>
                            <div className="text-gray-400 text-xs mt-1">
                                출처: {n.publisher}
                            </div>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
