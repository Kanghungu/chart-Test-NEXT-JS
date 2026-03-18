"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

function decodeHtmlEntities(text: string): string {
    if (!text) return "";
    const textarea = document.createElement("textarea");
    textarea.innerHTML = text;
    return textarea.value;
}

export default function CryptoNewsPage() {
    const [cryptoNews, setCryptoNews] = useState<any[]>([]);
    const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

    useEffect(() => {
        fetch("/api/news/crypto")
            .then((res) => res.json())
            .then((data) => setCryptoNews(data.results || []));
    }, []);

    const toggleItem = (id: string) => {
        setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <section className="p-6 max-w-4xl bg-gray-300 mx-auto">
            <h1 className="text-4xl font-bold mb-6 text-black">전체 Crypto News</h1>

            <ul className="divide-y divide-gray-200">
                {cryptoNews.map((n) => {
                    const cleanDesc = decodeHtmlEntities(n.description || "");

                    return (
                        <li key={n.id} className="py-4">
                            <div className="flex justify-between items-center">
                                <a
                                    href={`https://cryptopanic.com/news/${n.slug}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 font-medium hover:underline truncate"
                                    title={n.title}
                                >
                                    {n.title}
                                </a>
                                <button
                                    onClick={() => toggleItem(n.id)}
                                    className="text-gray-500 text-sm ml-2"
                                >
                                    {openItems[n.id] ? "▲ 접기" : "▼ 더보기"}
                                </button>
                            </div>

                            {/* ✅ 접혀 있을 때 요약 */}
                            {!openItems[n.id] && (
                                <div className="text-gray-500 text-sm mt-1">
                                    {cleanDesc.slice(0, 100)}...
                                </div>
                            )}

                            <div className="flex justify-between text-gray-400 text-xs mt-1">
                                <span>
                                    {n.published_at
                                        ? new Date(n.published_at).toLocaleString()
                                        : "날짜 없음"}
                                </span>
                                <span>출처: {n.publisher}</span>
                            </div>

                            {/* ✅ 펼쳤을 때 전체 내용 */}
                            <AnimatePresence>
                                {openItems[n.id] && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: "auto", opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className="mt-3 overflow-hidden"
                                    >
                                        <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-700">
                                            <p>{cleanDesc}</p>
                                            <p className="mt-2">
                                                원문 보기:{" "}
                                                <a
                                                    href={n.content_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 underline"
                                                >
                                                    {n.publisher}
                                                </a>
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </li>
                    );
                })}
            </ul>
            <div className="text-center">
                <Link href="/">
                    <button className="px-6 py-3 bg-blue-500 text-white rounded-xl shadow hover:bg-blue-600 transition">
                        첫 화면으로
                    </button>
                </Link>
            </div>
        </section>
    );
}
