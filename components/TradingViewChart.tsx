"use client";
import { useEffect, useId } from "react";
import * as React from "react";

export default function TradingViewChart({ symbol }: { symbol: string }) {
    const chartId = useId(); // React 18에서 제공하는 유니크 ID

    useEffect(() => {
        // 이미 tv.js가 로드되어 있는지 확인
        if (!document.getElementById("tradingview-script")) {
            const script = document.createElement("script");
            script.id = "tradingview-script";
            script.src = "https://s3.tradingview.com/tv.js";
            script.async = true;
            document.body.appendChild(script);
        }

        const interval = setInterval(() => {
            // @ts-ignore
            if (window.TradingView) {
                // @ts-ignore
                new window.TradingView.widget({
                    width: "100%",
                    height: 400,
                    symbol: symbol,
                    interval: "60",          // 1시간봉
                    studies: ["BB@tv-basicstudies"], // 볼린저밴드
                    timezone: "Etc/UTC",
                    theme: "dark",
                    style: "1",
                    locale: "ko",
                    container_id: chartId,
                });
                clearInterval(interval);
            }
        }, 300);

        return () => clearInterval(interval);
    }, [symbol, chartId]);

    return <div id={chartId} />;
}