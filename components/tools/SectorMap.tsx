"use client";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import s from "./tools.module.css";

type Sector = {
  id: string;
  name: string;
  market_cap_change_24h: number | null;
  volume_24h: number | null;
  market_cap: number | null;
  top_3_coins: string[];
};

const COPY = {
  ko: {
    title: "크립토 섹터 히트맵", kicker: "SECTOR HEATMAP · 섹터별 성과",
    hint: "DeFi·Layer 1/2·AI·Meme 등 섹터별 24시간 등락 — CoinGecko 실시간",
    loading: "섹터 데이터 로딩 중...", error: "데이터 로드 실패",
    change24h: "24H 변화", volume: "거래량", cap: "시총",
    refresh: "새로고침",
  },
  en: {
    title: "Crypto Sector Heatmap", kicker: "SECTOR HEATMAP · Sector Performance",
    hint: "DeFi · Layer 1/2 · AI · Meme and more — 24H performance via CoinGecko",
    loading: "Loading sector data...", error: "Failed to load",
    change24h: "24H Change", volume: "Volume", cap: "Market Cap",
    refresh: "Refresh",
  },
} as const;

function changeColor(v: number | null): { bg: string; text: string } {
  if (v === null) return { bg: "rgba(51,65,85,0.3)", text: "#94a3b8" };
  const abs = Math.abs(v);
  if (v > 5)  return { bg: "rgba(16,185,129,0.4)",  text: "#10b981" };
  if (v > 2)  return { bg: "rgba(16,185,129,0.25)", text: "#6ee7b7" };
  if (v > 0)  return { bg: "rgba(16,185,129,0.12)", text: "#a7f3d0" };
  if (v > -2) return { bg: "rgba(239,68,68,0.12)",  text: "#fca5a5" };
  if (v > -5) return { bg: "rgba(239,68,68,0.25)",  text: "#f87171" };
  return              { bg: "rgba(239,68,68,0.4)",   text: "#ef4444" };
}

function fmtNum(n: number | null): string {
  if (!n) return "—";
  if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n/1e6).toFixed(1)}M`;
  return `$${n.toFixed(0)}`;
}

async function fetchSectors(): Promise<Sector[]> {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/categories?order=market_cap_change_24h_desc",
      { cache: "no-store" }
    );
    if (!res.ok) throw new Error();
    const data = await res.json();
    return (data as Sector[]).slice(0, 30);
  } catch { return []; }
}

export default function SectorMap() {
  const { language } = useLanguage();
  const C = COPY[language];
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading]  = useState(true);
  const [error, setError]      = useState(false);
  const [selected, setSelected] = useState<Sector | null>(null);
  const [view, setView]         = useState<"heatmap"|"list">("heatmap");

  const load = useCallback(async () => {
    setLoading(true); setError(false);
    const data = await fetchSectors();
    if (!data.length) setError(true);
    setSectors(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // 시총 기준 박스 크기 결정
  const maxCap = Math.max(...sectors.map(s => s.market_cap ?? 0), 1);

  return (
    <div className={s.card}>
      <div className={s.cardHeader}>
        <div>
          <p className={s.kicker}>{C.kicker}</p>
          <h2 className={s.title}>{C.title}</h2>
          <p className={s.hint}>{C.hint}</p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button className={`${s.viewBtn} ${view === "heatmap" ? s.viewBtnActive : ""}`}
            onClick={() => setView("heatmap")}>⬛ 히트맵</button>
          <button className={`${s.viewBtn} ${view === "list" ? s.viewBtnActive : ""}`}
            onClick={() => setView("list")}>☰ 리스트</button>
          <button className={s.refreshBtn} onClick={load} disabled={loading}>↻</button>
        </div>
      </div>

      {loading && <div className={s.loadingBox}><span className={s.spinner} />{C.loading}</div>}
      {!loading && error && <div className={s.loadingBox} style={{ color: "#f87171" }}>{C.error}</div>}

      {!loading && !error && view === "heatmap" && (
        <div className={s.heatmapGrid}>
          {sectors.map(sec => {
            const { bg, text } = changeColor(sec.market_cap_change_24h);
            const size = sec.market_cap ? Math.max(0.5, (sec.market_cap / maxCap) * 3) : 1;
            return (
              <div
                key={sec.id}
                className={`${s.heatCell} ${selected?.id === sec.id ? s.heatCellActive : ""}`}
                style={{
                  background: bg,
                  gridColumn: `span ${Math.round(size * 2)}`,
                  minHeight: `${Math.max(60, size * 50)}px`,
                }}
                onClick={() => setSelected(selected?.id === sec.id ? null : sec)}
              >
                <span className={s.heatName}>{sec.name}</span>
                <span className={s.heatPct} style={{ color: text }}>
                  {sec.market_cap_change_24h !== null
                    ? `${sec.market_cap_change_24h >= 0 ? "+" : ""}${sec.market_cap_change_24h.toFixed(2)}%`
                    : "—"}
                </span>
                {sec.top_3_coins?.slice(0,2).map(url => (
                  <img key={url} src={url} alt="" className={s.heatCoin} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && view === "list" && (
        <div className={`${s.tableWrap} holo-table`}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>섹터</th>
                <th>{C.change24h}</th>
                <th className={s.hideSmall}>{C.cap}</th>
                <th className={s.hideSmall}>{C.volume}</th>
              </tr>
            </thead>
            <tbody>
              {sectors.map(sec => {
                const { text } = changeColor(sec.market_cap_change_24h);
                return (
                  <tr key={sec.id}>
                    <td className={s.sectorName}>{sec.name}</td>
                    <td style={{ color: text, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                      {sec.market_cap_change_24h !== null
                        ? `${sec.market_cap_change_24h >= 0 ? "+" : ""}${sec.market_cap_change_24h.toFixed(2)}%`
                        : "—"}
                    </td>
                    <td className={s.hideSmall}>{fmtNum(sec.market_cap)}</td>
                    <td className={s.hideSmall}>{fmtNum(sec.volume_24h)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className={s.sectorDetail}>
          <strong>{selected.name}</strong>
          <span>24H: {selected.market_cap_change_24h?.toFixed(2)}%</span>
          <span>시총: {fmtNum(selected.market_cap)}</span>
          <span>거래량: {fmtNum(selected.volume_24h)}</span>
        </div>
      )}
    </div>
  );
}
