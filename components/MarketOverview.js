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
            setFetchError("일부 데이터 소스가 일시적으로 불안정합니다.");
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
          setFetchError("시장 요약 데이터를 불러오는 중 네트워크 오류가 발생했습니다.");
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
          list.push(`${asset.symbol} 상승 모멘텀: ${formatPercent(asset.changePercent)}`);
        } else if (asset.changePercent <= -3) {
          list.push(`${asset.symbol} 급락 신호: ${formatPercent(asset.changePercent)}`);
        }
      }
    });

    if (snapshot.fearGreed?.value >= 75) {
      list.push(`공포·탐욕 지수 과열 (${snapshot.fearGreed.value}) - 단기 과열 가능성`);
    }
    if (snapshot.fearGreed?.value <= 25) {
      list.push(`공포·탐욕 지수 공포 구간 (${snapshot.fearGreed.value}) - 변동성 주의`);
    }

    if (!list.length) {
      list.push("강한 시그널은 아직 없습니다. 실시간 변동을 모니터링 중입니다.");
    }

    return list.slice(0, 4);
  }, [snapshot]);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-5 shadow-2xl">
      <div className="pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full bg-blue-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />

      <div className="relative z-10 space-y-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl md:text-2xl font-bold text-white">실시간 시장 요약</h2>
          <p className="text-sm text-slate-300">오늘 핵심 지표, 시그널, 실시간 티커를 한눈에 확인하세요.</p>
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
                <p className="mt-1 text-sm font-bold text-white">{formatMoney(asset.price, asset.currency || "USD")}</p>
                <p className={`mt-1 text-xs ${hasChange ? (up ? "text-emerald-400" : "text-rose-400") : "text-slate-400"}`}>
                  {formatPercent(asset.changePercent)}
                </p>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-xs text-slate-400">공포·탐욕 지수</p>
            <p className="mt-1 text-lg font-bold text-white">
              {snapshot?.fearGreed ? `${snapshot.fearGreed.value} (${snapshot.fearGreed.classification})` : "-"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-xs text-slate-400">24시간 코인 거래대금</p>
            <p className="mt-1 text-lg font-bold text-white">{formatMoney(snapshot?.cryptoVolumeUsd || null, "USD")}</p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="mb-2 text-xs font-semibold text-amber-300">알림 시그널</p>
          <ul className="space-y-1">
            {signals.map((signal, idx) => (
              <li key={`${signal}-${idx}`} className="text-sm text-amber-100">
                {signal}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-sky-400/25 bg-gradient-to-r from-sky-500/10 via-cyan-500/5 to-indigo-500/10 p-2 shadow-[0_0_25px_rgba(56,189,248,0.12)]">
          <div className="mb-2 flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <span className="relative inline-flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              </span>
              <p className="text-xs font-semibold tracking-wide text-sky-200">실시간 변동 티커</p>
            </div>
            <span className="rounded-full border border-sky-300/30 bg-sky-500/10 px-2 py-0.5 text-[10px] text-sky-200">
              LIVE
            </span>
          </div>

          <div className="rounded-lg border border-slate-700/70 bg-black/35 p-1.5">
            <div ref={containerRef} className="w-full min-h-[72px]" />
          </div>

          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-slate-900/90 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-900/90 to-transparent" />
        </div>

        <p className="text-[11px] text-slate-500">
          업데이트: {snapshot?.updatedAt ? new Date(snapshot.updatedAt).toLocaleTimeString() : "-"}
        </p>
      </div>
    </section>
  );
}
