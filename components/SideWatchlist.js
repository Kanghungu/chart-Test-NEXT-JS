"use client";

import { useEffect, useRef } from "react";

export default function SideWatchlist() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = "";

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js";
    script.async = true;
    script.text = JSON.stringify({
      width: "100%",
      height: 420,
      symbolsGroups: [
        {
          name: "Crypto",
          symbols: [
            { name: "BINANCE:BTCUSDT", displayName: "BTC" },
            { name: "BINANCE:ETHUSDT", displayName: "ETH" },
            { name: "BINANCE:SOLUSDT", displayName: "SOL" },
            { name: "BINANCE:DOGEUSDT", displayName: "DOGE" }
          ]
        },
        {
          name: "US Stocks",
          symbols: [
            { name: "NASDAQ:NVDA", displayName: "NVIDIA" },
            { name: "NASDAQ:AAPL", displayName: "Apple" },
            { name: "NASDAQ:TSLA", displayName: "Tesla" },
            { name: "NASDAQ:MSFT", displayName: "Microsoft" }
          ]
        }
      ],
      showSymbolLogo: true,
      colorTheme: "dark",
      isTransparent: true,
      locale: "en"
    });

    widgetContainer.appendChild(widget);
    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, []);

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-3 shadow-xl">
      <h3 className="text-sm font-semibold text-slate-200 mb-2">관심 자산</h3>
      <div ref={containerRef} className="w-full min-h-[420px]" />
    </section>
  );
}
