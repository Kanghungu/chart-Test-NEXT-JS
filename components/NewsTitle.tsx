"use client";
import React from "react";


export default function NewsTitle() {
    return (
        <div className="flex flex-col md:flex-row gap-6 mb-4">
            <div className="flex-1 flex items-center justify-between bg-gray-900/80 rounded-xl px-6 py-4 shadow border-b-4 border-blue-500">
                <h2 className="text-2xl md:text-3xl font-extrabold text-blue-300 tracking-tight">Crypto News</h2>
                <a
                    href="/crypto-news"
                    className="text-sm text-blue-200 hover:underline hover:text-blue-400 transition"
                >
                    더보기
                </a>
            </div>
            <div className="flex-1 flex items-center justify-between bg-gray-900/80 rounded-xl px-6 py-4 shadow border-b-4 border-green-500">
                <h2 className="text-2xl md:text-3xl font-extrabold text-green-300 tracking-tight">Stock News</h2>
                <a
                    href="/stock-news"
                    className="text-sm text-green-200 hover:underline hover:text-green-400 transition"
                >
                    더보기
                </a>
            </div>
        </div>
    );
}