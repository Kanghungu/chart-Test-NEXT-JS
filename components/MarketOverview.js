"use client";

import { useEffect, useRef } from "react";

export default function MarketOverview() {
  const containerRef = useRef(null);
  const symbols = ["BTC", "ETH", "SOL", "DOGE", "TSLA", "AAPL", "NVDA"];

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
      ],
      displayMode: "adaptive"
    });

    widgetContainer.appendChild(widget);
    widgetContainer.appendChild(copyright);
    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, []);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-5 shadow-2xl">
      <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />

      <div className="relative z-10 space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl md:text-2xl font-bold text-white">Live Market Pulse</h2>
          <p className="text-sm text-slate-300">Real-time price changes for crypto and US stocks.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {symbols.map((symbol) => (
            <span
              key={symbol}
              className="rounded-full border border-slate-600 bg-slate-800/70 px-3 py-1 text-xs font-semibold text-slate-200"
            >
              {symbol}
            </span>
          ))}
        </div>

        <div className="rounded-xl border border-slate-700/80 bg-black/30 p-2">
          <div ref={containerRef} className="w-full min-h-[72px]" />
        </div>
      </div>
    </section>
  );
}
