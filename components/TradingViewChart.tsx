"use client";
import { useEffect, useId } from "react";
import "./TradingViewChart.css";

export default function TradingViewChart({ symbol }: { symbol: string }) {
  const chartId = useId();

  useEffect(() => {
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
          symbol,
          interval: "60",
          studies: ["BB@tv-basicstudies"],
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "ko",
          container_id: chartId
        });
        clearInterval(interval);
      }
    }, 300);

    return () => clearInterval(interval);
  }, [symbol, chartId]);

  return <div id={chartId} className="tv-chart-container" />;
}

