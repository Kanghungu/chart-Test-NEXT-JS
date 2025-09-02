"use client";
import { useEffect, useState } from "react";
import TradingViewChart from "@/components/TradingViewChart";

export default function Home() {
    const [trades, setTrades] = useState([]);
    const symbols = ["BINANCE:BTCUSDT", "BINANCE:ETHUSDT", "NASDAQ:AAPL"];

    useEffect(() => {
        fetch("/api/trades")
            .then((res) => res.json())
            .then((data) => setTrades(data));
    }, []);

    return (
        <div style={{ padding: "2rem" }}>
            <h1>📈 나만의 거래소 블로그</h1>

            {/* 여러 차트 */}
            <h2>실시간 차트</h2>
            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "20px",
                    marginBottom: "2rem",
                }}
            >
                {symbols.map((symbol) => (
                    <div
                        key={symbol}
                        style={{
                            border: "1px solid #ddd",
                            borderRadius: "10px",
                            padding: "1rem",
                            background: "#000000",
                        }}
                    >
                        <h3>{symbol}</h3>
                        <TradingViewChart symbol={symbol} />
                    </div>
                ))}
            </div>

            {/* 거래 내역 */}
            <h2>최근 거래 내역</h2>
            <table
                style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    marginTop: "1rem",
                }}
            >
                <thead>
                <tr style={{ background: "#f0f0f0" }}>
                    <th style={{ border: "1px solid #ddd", padding: "8px" }}>Symbol</th>
                    <th style={{ border: "1px solid #ddd", padding: "8px" }}>Price</th>
                    <th style={{ border: "1px solid #ddd", padding: "8px" }}>Volume</th>
                    <th style={{ border: "1px solid #ddd", padding: "8px" }}>Time</th>
                </tr>
                </thead>
                <tbody>
                {trades.map((t) => (
                    <tr key={t.id}>
                        <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                            {t.symbol}
                        </td>
                        <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                            {t.price}
                        </td>
                        <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                            {t.volume}
                        </td>
                        <td style={{ border: "1px solid #ddd", padding: "8px" }}>
                            {new Date(t.createdAt).toLocaleString()}
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
        </div>
    );
}
