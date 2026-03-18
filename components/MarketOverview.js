"use client";

import React, { useState, useEffect } from "react";

export default function MarketStatus() {
    const [markets, setMarkets] = useState([]);

    useEffect(() => {
        async function fetchMarkets() {
            try {
                const res = await fetch("/api/market");
                const json = await res.json();
                setMarkets(Array.isArray(json) ? json : []);
            } catch (err) {
                console.error("Market fetch error:", err);
            }
        }
        fetchMarkets();
        const interval = setInterval(fetchMarkets, 60000); // 1분마다 갱신
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-wrap justify-center gap-4">
            {markets.map((m) => (
                <div
                    key={m.symbol}
                    className="bg-gray-900/80 border border-gray-700 rounded-xl px-5 py-3 shadow text-center min-w-[120px] flex flex-col items-center hover:scale-105 transition-all"
                >
                    <span className="text-base font-semibold text-gray-200">{m.name}</span>
                    <span className="text-lg font-bold text-blue-400 mt-1">
                        {m.current ? `$${m.current.toLocaleString()}` : "-"}
                    </span>
                </div>
            ))}
        </div>
    );
}
