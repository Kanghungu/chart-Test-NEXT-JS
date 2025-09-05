"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function StockNewsPage() {
    const [stockNews, setStockNews] = useState([]);
    const [openItems, setOpenItems] = useState({});

    useEffect(() => {
        fetch("/api/news/stock")
            .then((res) => res.json())
            .then((json) => setStockNews(json.data || []));
    }, []);

    const toggleItem = (id: string) => {
        setOpenItems((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    return (
        <section className="p-6 max-w-4xl bg-gray-300 mx-auto">
            <h1 className="text-4xl font-bold mb-6 text-black">전체 Stock News</h1>
            <ul className="divide-y divide-gray-200">
                {stockNews.map((n: any) => (
                    <li key={n.id} className="py-4">
                        <div className="flex justify-between items-center">
                            <a
                                href={n.content_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 font-medium hover:underline"
                            >
                                {n.title_ko}
                            </a>
                            <button
                                onClick={() => toggleItem(n.id)}
                                className="text-gray-500 text-sm ml-2"
                            >
                                {openItems[n.id] ? "▲ 접기" : "▼ 더보기"}
                            </button>
                        </div>

                        {/* ✅ 접혀있을 때만 요약 보여주기 */}
                        {!openItems[n.id] && (
                            <div className="text-gray-500 text-sm mt-1">
                                {n.summary_ko.slice(0, 100)}...
                            </div>
                        )}

                        <div className="flex justify-between text-gray-400 text-xs mt-1">
                            <span>
                                {n.published_at ? new Date(n.published_at).toLocaleString() : "날짜 없음"}
                            </span>
                            <span>출처: {n.publisher}</span>
                        </div>

                        {/* ✅ 펼쳤을 때 전체 내용 + 애니메이션 */}
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
                                        <p>{n.summary_ko}</p>
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
                ))}
            </ul>
        </section>
    );
}
