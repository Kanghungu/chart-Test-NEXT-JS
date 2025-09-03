"use client";
import TradingViewChart from "@/components/TradingViewChart";

export default function ChartsPage() {
    const symbols = ["BINANCE:BTCUSDT", "BINANCE:ETHUSDT", "BINANCE:XRPUSDT"];

    return (
        <div style={{ padding: "2rem" }}>
            <h2 style={{ marginBottom: "1rem" }}>📊 가로 3개 차트</h2>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)", // 가로 3개
                    gap: "1rem", // 차트 사이 간격
                }}
            >
                {symbols.map((s) => (
                    <TradingViewChart key={s} symbol={s} />
                ))}
            </div>
        </div>
    );
}
