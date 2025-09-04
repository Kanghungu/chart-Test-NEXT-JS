"use client";
import React from "react";


export default function NewsList() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="p-6 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-bold text-black">Crypto News</h2>
                    <a
                        href="/crypto-news" // 전체 리스트 페이지 경로
                        className="text-sm text-blue-600 hover:underline"
                    >
                        더보기
                    </a>
                </div>
            </section>

            <section className="p-6 bg-gray-50 rounded-lg ">
                <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-bold text-black">
                        Stock News
                    </h2>
                    <a
                        href="/stock-news" // 전체 리스트 페이지 경로
                        className="text-sm text-blue-600 hover:underline"
                    >
                        더보기
                    </a>
                </div>
            </section>
        </div>
    );
}