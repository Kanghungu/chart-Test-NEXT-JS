"use client";

import { useEffect, useRef } from "react";

export default function SideEvents() {
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
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
    script.async = true;
    script.text = JSON.stringify({
      colorTheme: "dark",
      isTransparent: true,
      width: "100%",
      height: 420,
      locale: "en",
      importanceFilter: "-1,0,1",
      countryFilter: "us,eu,jp,cn,kr"
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
      <h3 className="text-sm font-semibold text-slate-200 mb-2">경제 일정</h3>
      <div ref={containerRef} className="w-full min-h-[420px]" />
    </section>
  );
}
