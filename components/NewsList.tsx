"use client";
import React from "react";
import { useEffect, useState } from "react";

interface NewsItem {
    title: string;
    url: string;
    source_name?: string;
    publishedAt: string;
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
            .then((data) => setStockNews(data.results || [])); // API 구조 확인 필요
    }, []);

    return (
        <div className="space-y-8">
            <section>
                <h2 className="text-xl font-bold mb-2">Crypto News</h2>
                <ul className="list-disc pl-5">
                    {cryptoNews.map((n, idx) => (
                        <li key={idx}>
                            <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {n.title}
                            </a>{" "}
                            <span className="text-sm text-gray-500">({new Date(n.publishedAt).toLocaleString()})</span>
                        </li>
                    ))}
                </ul>
            </section>
            <section>
                <h2 className="text-xl font-bold mb-2">Stock News</h2>
                <ul className="list-disc pl-5">
                    {stockNews.map((n, idx) => (
                        <li key={idx}>
                            <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                {n.title}
                            </a>{" "}
                            <span className="text-sm text-gray-500">({new Date(n.publishedAt).toLocaleString()})</span>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
