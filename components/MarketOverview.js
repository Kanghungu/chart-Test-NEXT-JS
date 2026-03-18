"use client";

import { useEffect, useRef } from "react";

export default function MarketOverview() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = "";

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";

    const copyright = document.createElement("div");
    copyright.className = "tradingview-widget-copyright";
    copyright.innerHTML =
      '<a href="https://www.tradingview.com/" rel="noopener nofollow" target="_blank"><span class="blue-text">Track all markets on TradingView</span></a>';

    const script = document.createElement("script");
    script.type = "text/javascript";
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.async = true;
    script.text = JSON.stringify({
      colorTheme: "dark",
      locale: "en",
      isTransparent: true,
      showSymbolLogo: true,
      width: "100%",
      symbols: [
        { proName: "BINANCE:BTCUSDT", title: "Bitcoin" },
        { proName: "BINANCE:ETHUSDT", title: "Ethereum" },
        { proName: "BINANCE:SOLUSDT", title: "Solana" },
        { proName: "BINANCE:DOGEUSDT", title: "Dogecoin" },
        { proName: "NASDAQ:TSLA", title: "Tesla" },
        { proName: "NASDAQ:AAPL", title: "Apple" },
        { proName: "NASDAQ:NVDA", title: "NVIDIA" }
      ]
    });

    widgetContainer.appendChild(widget);
    widgetContainer.appendChild(copyright);
    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);
  }, []);

  return <div ref={containerRef} className="w-full" />;
}
