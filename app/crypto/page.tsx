"use client";

import { useEffect, useState, useMemo } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { CryptoSignal, CryptoSignalsResponse, TF } from "@/app/api/signals/crypto/route";
import styles from "./page.module.css";

// ── Filter types ──────────────────────────────────────────────────────────
type SignalType = "ALL" | "HARMONIC" | "DIVERGENCE" | "ZONE_BREAK";
type Direction  = "ALL" | "BULLISH" | "BEARISH";
type SymFilter  = "ALL" | "BTC" | "ETH" | "SOL" | "XRP" | "BNB" | "ADA" | "DOGE";

// ── Helpers ───────────────────────────────────────────────────────────────
function fmtPrice(n: number): string {
  if (n >= 10000) return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (n >= 1)     return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  return n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

function fmtTime(iso: string, lang: "ko" | "en"): string {
  const d = new Date(iso);
  return d.toLocaleTimeString(lang === "ko" ? "ko-KR" : "en-US", { hour: "2-digit", minute: "2-digit" });
}

// ── Signal card ───────────────────────────────────────────────────────────
function SignalCard({ sig, lang }: { sig: CryptoSignal; lang: "ko" | "en" }) {
  const tfClass   = sig.timeframe === "15m" ? styles.tf15m  : sig.timeframe === "1h" ? styles.tf1h  : styles.tf4h;
  const typeClass = sig.type === "HARMONIC"  ? styles.typeHarmonic
                  : sig.type === "DIVERGENCE" ? styles.typeDivergence : styles.typeZone;
  const dirClass  = sig.direction === "BULLISH" ? styles.dirBull : styles.dirBear;
  const cardCls   = sig.direction === "BULLISH" ? styles.cardBull : styles.cardBear;
  const strClass  = sig.strength  === "STRONG"  ? styles.strengthStrong : styles.strengthMedium;

  const typeLabel: Record<CryptoSignal["type"], { ko: string; en: string }> = {
    HARMONIC:   { ko: "하모닉",  en: "Harmonic"  },
    DIVERGENCE: { ko: "다이버전스", en: "Divergence" },
    ZONE_BREAK: { ko: "매물대돌파", en: "Zone Break" },
  };
  const dirLabel  = sig.direction === "BULLISH"
    ? (lang === "ko" ? "상승" : "Bull")
    : (lang === "ko" ? "하락" : "Bear");
  const strLabel  = sig.strength === "STRONG"
    ? (lang === "ko" ? "강함" : "Strong")
    : (lang === "ko" ? "중간" : "Medium");

  return (
    <div className={`${styles.card} ${cardCls}`}>
      {/* Top row */}
      <div className={styles.cardTop}>
        <span className={styles.coinName}>{sig.base}/USDT</span>
        <div className={styles.badges}>
          <span className={`${styles.badge} ${tfClass}`}>{sig.timeframe}</span>
          <span className={`${styles.badge} ${typeClass}`}>
            {sig.patternName ? `${typeLabel[sig.type][lang]} · ${sig.patternName}` : typeLabel[sig.type][lang]}
          </span>
          <span className={`${styles.badge} ${dirClass}`}>{dirLabel}</span>
          <span className={`${styles.badge} ${strClass}`}>{strLabel}</span>
        </div>
      </div>

      {/* Description */}
      <p className={styles.desc}>
        {lang === "ko" ? sig.descriptionKo : sig.descriptionEn}
      </p>

      {/* PRZ (harmonic only) */}
      {sig.przMin !== undefined && sig.przMax !== undefined && (
        <div className={styles.prz}>
          <span className={styles.przLabel}>PRZ</span>
          <span className={styles.przRange}>
            {fmtPrice(sig.przMin)} – {fmtPrice(sig.przMax)}
          </span>
        </div>
      )}

      {/* Price */}
      <div className={styles.priceRow}>
        <span>{lang === "ko" ? "현재가" : "Price"}</span>
        <span className={styles.priceVal}>${fmtPrice(sig.currentPrice)}</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function CryptoPage() {
  const { language } = useLanguage();
  const [data, setData]       = useState<CryptoSignalsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [symFilter,  setSymFilter]  = useState<SymFilter>("ALL");
  const [tfFilter,   setTfFilter]   = useState<TF | "ALL">("ALL");
  const [typeFilter, setTypeFilter] = useState<SignalType>("ALL");
  const [dirFilter,  setDirFilter]  = useState<Direction>("ALL");

  const load = async () => {
    setLoading(true);
    try {
      const res  = await fetch("/api/signals/crypto", { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch { /* keep previous */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60 * 1000);
    return () => clearInterval(t);
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.signals.filter((s) => {
      if (symFilter  !== "ALL" && s.base      !== symFilter)  return false;
      if (tfFilter   !== "ALL" && s.timeframe !== tfFilter)   return false;
      if (typeFilter !== "ALL" && s.type      !== typeFilter) return false;
      if (dirFilter  !== "ALL" && s.direction !== dirFilter)  return false;
      return true;
    });
  }, [data, symFilter, tfFilter, typeFilter, dirFilter]);

  const bulls = filtered.filter((s) => s.direction === "BULLISH").length;
  const bears = filtered.filter((s) => s.direction === "BEARISH").length;
  const strongs = filtered.filter((s) => s.strength === "STRONG").length;

  const COPY = {
    ko: {
      eyebrow: "CRYPTO SIGNALS",
      title: "암호화폐 차트 시그널",
      subtitle: "하모닉 패턴 · RSI 다이버전스 · 매물대 돌파 — Binance 실시간",
      refresh: "새로고침",
      all: "전체",
      sym: "코인",
      tf: "타임프레임",
      type: "시그널 유형",
      dir: "방향",
      harmonic: "하모닉",
      divergence: "다이버전스",
      zone: "매물대돌파",
      bull: "상승",
      bear: "하락",
      totalLabel: "총 시그널",
      bullLabel: "상승 시그널",
      bearLabel: "하락 시그널",
      strongLabel: "강한 시그널",
      empty: "해당 조건의 시그널이 없습니다",
      updated: "업데이트",
    },
    en: {
      eyebrow: "CRYPTO SIGNALS",
      title: "Crypto Chart Signals",
      subtitle: "Harmonic Patterns · RSI Divergence · Zone Breakouts — Binance live",
      refresh: "Refresh",
      all: "All",
      sym: "Coin",
      tf: "Timeframe",
      type: "Signal Type",
      dir: "Direction",
      harmonic: "Harmonic",
      divergence: "Divergence",
      zone: "Zone Break",
      bull: "Bullish",
      bear: "Bearish",
      totalLabel: "Total",
      bullLabel: "Bullish",
      bearLabel: "Bearish",
      strongLabel: "Strong",
      empty: "No signals match the current filters",
      updated: "Updated",
    },
  };
  const c = COPY[language];

  const SYMS: SymFilter[] = ["ALL", "BTC", "ETH", "SOL", "XRP", "BNB", "ADA", "DOGE"];
  const TFS: (TF | "ALL")[] = ["ALL", "15m", "1h", "4h"];

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        {/* ── Header ── */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <p className={styles.eyebrow}>{c.eyebrow}</p>
            <h1 className={styles.title}>{c.title}</h1>
            <p className={styles.subtitle}>{c.subtitle}</p>
          </div>
          <div className={styles.headerRight}>
            {data && (
              <span className={styles.lastUpdate}>
                {c.updated}: {fmtTime(data.fetchedAt, language)}
              </span>
            )}
            <button className={styles.refreshBtn} onClick={load} disabled={loading}>
              {loading ? "…" : c.refresh}
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className={styles.filters}>
          {/* Coin */}
          <div className={styles.filterGroup}>
            {SYMS.map((s) => (
              <button
                key={s}
                className={`${styles.filterBtn} ${symFilter === s ? styles.filterBtnActive : ""}`}
                onClick={() => setSymFilter(s)}
              >
                {s === "ALL" ? c.all : s}
              </button>
            ))}
          </div>

          {/* Timeframe */}
          <div className={styles.filterGroup}>
            {TFS.map((tf) => (
              <button
                key={tf}
                className={`${styles.filterBtn} ${tfFilter === tf ? styles.filterBtnActive : ""}`}
                onClick={() => setTfFilter(tf)}
              >
                {tf === "ALL" ? c.all : tf}
              </button>
            ))}
          </div>

          {/* Type */}
          <div className={styles.filterGroup}>
            {(["ALL", "HARMONIC", "DIVERGENCE", "ZONE_BREAK"] as SignalType[]).map((t) => (
              <button
                key={t}
                className={`${styles.filterBtn} ${typeFilter === t ? styles.filterBtnActive : ""}`}
                onClick={() => setTypeFilter(t)}
              >
                {t === "ALL" ? c.all : t === "HARMONIC" ? c.harmonic : t === "DIVERGENCE" ? c.divergence : c.zone}
              </button>
            ))}
          </div>

          {/* Direction */}
          <div className={styles.filterGroup}>
            {(["ALL", "BULLISH", "BEARISH"] as Direction[]).map((d) => (
              <button
                key={d}
                className={`${styles.filterBtn} ${dirFilter === d ? styles.filterBtnActive : ""}`}
                onClick={() => setDirFilter(d)}
              >
                {d === "ALL" ? c.all : d === "BULLISH" ? c.bull : c.bear}
              </button>
            ))}
          </div>
        </div>

        {/* ── Summary ── */}
        {!loading && data && (
          <div className={styles.summary}>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>{c.totalLabel}</span>
              <span className={styles.summaryValue}>{filtered.length}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>{c.bullLabel}</span>
              <span className={`${styles.summaryValue} ${styles.summaryBull}`}>{bulls}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>{c.bearLabel}</span>
              <span className={`${styles.summaryValue} ${styles.summaryBear}`}>{bears}</span>
            </div>
            <div className={styles.summaryCard}>
              <span className={styles.summaryLabel}>{c.strongLabel}</span>
              <span className={styles.summaryValue} style={{ color: "#fbbf24" }}>{strongs}</span>
            </div>
          </div>
        )}

        {/* ── Signal grid ── */}
        {loading ? (
          <div className={styles.skeletonGrid}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.skeleton} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className={styles.empty}>{c.empty}</p>
        ) : (
          <div className={styles.grid}>
            {filtered.map((sig) => (
              <SignalCard key={sig.id} sig={sig} lang={language} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
