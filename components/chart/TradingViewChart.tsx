"use client";

import { useEffect, useId } from "react";
import "./TradingViewChart.css";

interface TradingViewChartProps {
  symbol: string;
  interval?: string;
}

export default function TradingViewChart({ symbol, interval = "60" }: TradingViewChartProps) {
  const chartId = useId();

  useEffect(() => {
    if (!document.getElementById("tradingview-script")) {
      const script = document.createElement("script");
      script.id = "tradingview-script";
      script.src = "https://s3.tradingview.com/tv.js";
      script.async = true;
      document.body.appendChild(script);
    }

    const timer = setInterval(() => {
      // @ts-ignore
      if (window.TradingView) {
        const container = document.getElementById(chartId);

        if (!container) {
          clearInterval(timer);
          return;
        }

        container.innerHTML = "";

        // @ts-ignore
        new window.TradingView.widget({
          width: "100%",
          height: 400,
          symbol,
          interval,
          studies: ["BB@tv-basicstudies"],
          timezone: "Etc/UTC",
          theme: "dark",
          style: "1",
          locale: "ko",
          container_id: chartId
        });
        clearInterval(timer);
      }
    }, 300);

    return () => clearInterval(timer);
  }, [symbol, interval, chartId]);

  return <div id={chartId} className="tv-chart-container" />;
}
