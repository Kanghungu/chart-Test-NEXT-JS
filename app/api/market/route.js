// app/api/market/route.js
import { NextResponse } from "next/server";

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

export async function GET() {
    try {
        const assets = [
            { symbol: "BTCUSD", name: "Bitcoin", type: "crypto" },
            { symbol: "ETHUSD", name: "Ethereum", type: "crypto" },
            { symbol: "SOLUSD", name: "Solana", type: "crypto" },
            { symbol: "DOGEUSD", name: "DogeCoin", type: "crypto" },
            { symbol: "TSLA", name: "TESLA Inc", type: "index" },
            { symbol: "AAPL", name: "APPLE Inc", type: "index" },
            { symbol: "NVDA", name: "NVIDIA Inc", type: "index" },
        ];

        const results = await Promise.all(
            assets.map(async (asset) => {
                let url;
                if (asset.type === "crypto") {
                    url = `https://api.finage.co.uk/last/crypto/${asset.symbol}?apikey=${FINNHUB_API_KEY}`;
                } else {
                    url = `https://api.finage.co.uk/last/stock/${asset.symbol}?apikey=${FINNHUB_API_KEY}`;
                }

                const res = await fetch(url);
                const data = await res.json();

                console.log(res.url)
                // price만 가져오기 (실시간)
                if (asset.type === "crypto") {
                    return {
                        name: asset.name,
                        symbol: asset.symbol,
                        current: data.price,
                    };
                } else {
                    return {
                        name: asset.name,
                        symbol: asset.symbol,
                        current: data.ask,
                    };
                }

            })
        );

        return NextResponse.json(results); // 배열 그대로 반환
    } catch (err) {
        console.error("Market API Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
