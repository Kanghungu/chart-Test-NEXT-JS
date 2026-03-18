"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_ASSETS = [
  { symbol: "BTC", price: null, changePercent: null, currency: "USD" },
  { symbol: "ETH", price: null, changePercent: null, currency: "USD" },
  { symbol: "S&P 500", price: null, changePercent: null, currency: "USD" },
  { symbol: "NASDAQ", price: null, changePercent: null, currency: "USD" }
];

function formatMoney(value, currency = "USD") {
  if (typeof value !== "number") return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value >= 1000 ? 0 : 2
  }).format(value);
}

function formatPercent(value) {
  if (typeof value !== "number") return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export default function MarketOverview() {
  const containerRef = useRef(null);
  const [snapshot, setSnapshot] = useState({
    assets: DEFAULT_ASSETS,
    fearGreed: null,
    cryptoVolumeUsd: null,
    warnings: [],
    updatedAt: null
  });
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = "";

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container";

    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";

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
    widgetContainer.appendChild(script);
    containerRef.current.appendChild(widgetContainer);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadSnapshot = async () => {
      try {
        const res = await fetch("/api/market/snapshot", { cache: "no-store" });
        const json = await res.json();
        if (mounted) {
          if (json.error) {
            setFetchError("Some sources are temporarily unavailable.");
          } else {
            setFetchError("");
          }

          setSnapshot((prev) => ({
            assets: json.assets?.length ? json.assets : prev.assets,
            fearGreed: json.fearGreed ?? null,
            cryptoVolumeUsd: json.cryptoVolumeUsd ?? null,
            warnings: json.warnings || [],
            updatedAt: json.updatedAt || prev.updatedAt
          }));
        }
      } catch (_error) {
        if (mounted) {
          setFetchError("Network issue while loading market snapshot.");
        }
      }
    };

    loadSnapshot();
    const timer = setInterval(loadSnapshot, 60000);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  const signals = useMemo(() => {
    if (!snapshot?.assets) return [];

    const list = [];

    snapshot.assets.forEach((asset) => {
      if (typeof asset.changePercent === "number") {
        if (asset.changePercent >= 3) {
          list.push(`${asset.symbol} bullish momentum: ${formatPercent(asset.changePercent)}`);
        } else if (asset.changePercent <= -3) {
          list.push(`${asset.symbol} sharp pullback: ${formatPercent(asset.changePercent)}`);
        }
      }
    });

    if (snapshot.fearGreed?.value >= 75) {
      list.push(`Fear & Greed is high (${snapshot.fearGreed.value}) - market may be overheated.`);
    }
    if (snapshot.fearGreed?.value <= 25) {
      list.push(`Fear & Greed is low (${snapshot.fearGreed.value}) - panic zone detected.`);
    }

    if (!list.length) {
      list.push("No strong market signal yet. Monitoring live changes.");
    }

    return list.slice(0, 4);
  }, [snapshot]);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-5 shadow-2xl">
      <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />

      <div className="relative z-10 space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl md:text-2xl font-bold text-white">Live Market Pulse</h2>
          <p className="text-sm text-slate-300">Today summary, filters-ready signals, and real-time tape.</p>
        </div>

        {fetchError ? (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            {fetchError}
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {(snapshot?.assets || DEFAULT_ASSETS).map((asset) => {
            const hasChange = typeof asset.changePercent === "number";
            const up = hasChange && asset.changePercent >= 0;
            return (
              <div key={asset.symbol} className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
                <p className="text-xs text-slate-400">{asset.symbol}</p>
                <p className="text-sm font-bold text-white mt-1">{formatMoney(asset.price, asset.currency || "USD")}</p>
                <p className={`text-xs mt-1 ${hasChange ? (up ? "text-emerald-400" : "text-rose-400") : "text-slate-400"}`}>
                  {formatPercent(asset.changePercent)}
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-xs text-slate-400">Fear &amp; Greed</p>
            <p className="text-lg font-bold text-white mt-1">
              {snapshot?.fearGreed ? `${snapshot.fearGreed.value} (${snapshot.fearGreed.classification})` : "-"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-xs text-slate-400">24h Crypto Volume</p>
            <p className="text-lg font-bold text-white mt-1">{formatMoney(snapshot?.cryptoVolumeUsd || null, "USD")}</p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="text-xs font-semibold text-amber-300 mb-2">Signal Feed</p>
          <ul className="space-y-1">
            {signals.map((signal, idx) => (
              <li key={`${signal}-${idx}`} className="text-sm text-amber-100">
                {signal}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-700/80 bg-black/30 p-2">
          <div ref={containerRef} className="w-full min-h-[72px]" />
        </div>

        <p className="text-[11px] text-slate-500">
          Updated: {snapshot?.updatedAt ? new Date(snapshot.updatedAt).toLocaleTimeString() : "-"}
        </p>
      </div>
    </section>
  );
}
