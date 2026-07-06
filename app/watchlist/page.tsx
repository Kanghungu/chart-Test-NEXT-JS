"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/components/discover/DiscoverPage.module.css";
import wStyles from "./watchlist.module.css";
import { formatCurrency, formatPercent } from "@/lib/formatters";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { getLocalizedAssetName } from "@/lib/marketLocalization";
import {
  loadAlertRules,
  saveAlertRules,
  ensureNotificationPermission,
  fireNotification,
  makeAlertId,
  type PriceAlertRule,
} from "@/lib/alerts";

type WatchGroup = "korea" | "stock";

type WatchItem = {
  symbol: string;
  name: string;
  nameKo?: string;
  nameEn?: string;
  group: WatchGroup;
  price: number | null;
  changePercent: number | null;
};

type TechData = {
  rsi: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  week52High: number | null;
  week52Low: number | null;
  volRatio: number | null; // 오늘 거래량 / 20일 평균
};

const COPY = {
  ko: {
    eyebrow: "WATCHLIST HUB",
    title: "미국주식 / 한국주식 보드",
    description: "미국주식과 한국주식을 같은 화면에서 비교하고, 변동폭 기준으로 빠르게 훑어봅니다.",
    totalAssets: "총 자산", totalAssetsHint: "한국주식 + 미국주식",
    strongest: "가장 강한 자산", weakest: "가장 약한 자산",
    assetGroup: "자산 그룹", quickFilter: "빠른 필터",
    all: "전체", korea: "한국주식", stock: "미국주식",
    moveRanking: "변동폭 기준 정렬", comparePairs: "오늘 보기 좋은 비교",
    quickPairs: "빠른 비교", empty: "표시할 자산이 없습니다.",
    allAssets: "전체 자산", koreaType: "한국주식", stockType: "미국주식",
    techSignal: "기술 신호", loading: "지표 로딩 중...",
    emaAlign: "EMA 배열", week52: "52주 위치", volRatio: "거래량 배율",
    bullAlign: "정배열", bearAlign: "역배열", mixAlign: "혼합",
    overbought: "과매수", oversold: "과매도",
    alertAdd: "알림 추가", alertAbove: "이상", alertBelow: "이하",
    alertPricePlaceholder: "목표가", alertSave: "저장", alertCancel: "취소",
    alertDone: "발동됨",
  },
  en: {
    eyebrow: "WATCHLIST HUB",
    title: "US / Korea stock board",
    description: "Compare US and Korean stocks on one screen and sort them by the biggest moves.",
    totalAssets: "Total assets", totalAssetsHint: "Korean + US stocks",
    strongest: "Strongest asset", weakest: "Weakest asset",
    assetGroup: "Asset group", quickFilter: "Quick filter",
    all: "All", korea: "Korean stocks", stock: "US stocks",
    moveRanking: "Move ranking", comparePairs: "Useful pairs today",
    quickPairs: "Quick pairs", empty: "No watchlist assets to display.",
    allAssets: "All assets", koreaType: "Korean stock", stockType: "US stock",
    techSignal: "Tech signal", loading: "Loading indicators...",
    emaAlign: "EMA align", week52: "52-wk pos", volRatio: "Vol ratio",
    bullAlign: "Bull", bearAlign: "Bear", mixAlign: "Mixed",
    overbought: "Overbought", oversold: "Oversold",
    alertAdd: "Add alert", alertAbove: "above", alertBelow: "below",
    alertPricePlaceholder: "Target price", alertSave: "Save", alertCancel: "Cancel",
    alertDone: "Triggered",
  }
} as const;

const PAIRS = {
  ko: [
    ["삼성전자 vs SK하이닉스", "국내 반도체 주도주 비교"],
    ["NAVER vs 현대차", "성장주와 경기민감주 톤 비교"],
    ["NVDA vs TSLA", "미국 성장주 위험선호 체크"],
    ["AAPL vs MSFT", "미국 메가캡 안정감 비교"],
  ],
  en: [
    ["Samsung vs SK hynix", "Compare Korean semiconductor leadership"],
    ["NAVER vs Hyundai", "Check growth vs cyclical tone in Korea"],
    ["NVDA vs TSLA", "Read risk appetite inside US leaders"],
    ["AAPL vs MSFT", "Compare defensive mega-cap rotation"],
  ],
} as const;

// ── RSI / EMA 계산 ──────────────────────────────────────────────────────────
function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return NaN;
  let avgG = 0, avgL = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    avgG += Math.max(0, d); avgL += Math.max(0, -d);
  }
  avgG /= period; avgL /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + Math.max(0, d)) / period;
    avgL = (avgL * (period - 1) + Math.max(0, -d)) / period;
  }
  return 100 - 100 / (1 + (avgL === 0 ? Infinity : avgG / avgL));
}

function calcEMA(closes: number[], period: number): number {
  if (closes.length < period) return NaN;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < closes.length; i++) ema = closes[i] * k + ema * (1 - k);
  return ema;
}

function calcVolMA(volumes: number[], period = 20): number {
  const slice = volumes.slice(-period).filter(v => v > 0);
  return slice.length ? slice.reduce((s, v) => s + v, 0) / slice.length : NaN;
}

// ── Fetch 기술 지표 (Binance Futures for crypto, Yahoo proxy for stocks) ──
async function fetchTechData(symbol: string, isKorea: boolean): Promise<TechData> {
  const empty: TechData = { rsi: null, ema20: null, ema50: null, ema200: null, week52High: null, week52Low: null, volRatio: null };
  try {
    // 한국/미국 주식: Yahoo Finance 비공개 API 프록시 사용 불가 → 키워드 매핑으로 Binance crypto 심볼 활용
    // 주식은 TradingView 위젯 대신 OHLCV가 공개 API로 없으므로 Binance 선물로 근사 (BTC, ETH 등)
    // 여기서는 가능한 경우에만 계산 (미국주식 심볼 → 스킵, 한국주식 → 스킵)
    // 실제로는 /api/market/watchlist 확장이 필요하나, 현재는 브라우저 직접 접근 가능한 소스로 제한

    // Binance 선물 klines로 기술 지표 계산 (crypto에만 적용)
    const btcMap: Record<string, string> = {
      BTC: "BTCUSDT", ETH: "ETHUSDT", SOL: "SOLUSDT", XRP: "XRPUSDT", BNB: "BNBUSDT",
    };
    const binSym = btcMap[symbol.toUpperCase()];
    if (!binSym) return empty;

    const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${binSym}&interval=1d&limit=220`;
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return empty;
    const raw = await res.json() as Array<(string | number)[]>;
    if (!raw.length) return empty;

    const closes  = raw.map(k => parseFloat(k[4] as string));
    const highs   = raw.map(k => parseFloat(k[2] as string));
    const lows    = raw.map(k => parseFloat(k[3] as string));
    const volumes = raw.map(k => parseFloat(k[5] as string));
    const todayVol = volumes.at(-1) ?? 0;
    const volMA    = calcVolMA(volumes.slice(0, -1), 20);

    return {
      rsi:       calcRSI(closes, 14),
      ema20:     calcEMA(closes, 20),
      ema50:     calcEMA(closes, 50),
      ema200:    calcEMA(closes, 200),
      week52High: Math.max(...highs.slice(-52)),
      week52Low:  Math.min(...lows.slice(-52)),
      volRatio:   isFinite(volMA) && volMA > 0 ? todayVol / volMA : null,
    };
  } catch { return empty; }
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────
export default function WatchlistPage() {
  const { language } = useLanguage();
  const copy = COPY[language];
  const [items, setItems] = useState<WatchItem[]>([]);
  const [techMap, setTechMap] = useState<Record<string, TechData>>({});
  const [group, setGroup] = useState<"all" | WatchGroup>("all");
  const [techLoading, setTechLoading] = useState(true);
  const [rules, setRules] = useState<PriceAlertRule[]>([]);
  const [openAlertFor, setOpenAlertFor] = useState<string | null>(null);
  const [alertDirection, setAlertDirection] = useState<"above" | "below">("above");
  const [alertPrice, setAlertPrice] = useState("");

  // 가격 데이터 로드 + 가격 알림 체크
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/market/watchlist", { cache: "no-store" });
        const json = await res.json();
        const nextItems: WatchItem[] = Array.isArray(json?.items) ? json.items : [];
        if (mounted) setItems(nextItems);

        const allRules = loadAlertRules();
        const priceRules = allRules.filter((r): r is PriceAlertRule => r.kind === "price");
        let changed = false;
        for (const rule of priceRules) {
          if (!rule.enabled) continue;
          const item = nextItems.find((i) => i.symbol === rule.symbol);
          if (!item || item.price == null) continue;
          const hit = rule.direction === "above"
            ? item.price >= rule.targetPrice
            : item.price <= rule.targetPrice;
          if (hit) {
            fireNotification(
              `${rule.label}`,
              rule.direction === "above"
                ? `목표가 ${rule.targetPrice} 이상 도달 (현재 ${item.price})`
                : `목표가 ${rule.targetPrice} 이하 도달 (현재 ${item.price})`,
            );
            rule.enabled = false;
            rule.triggeredAt = Date.now();
            changed = true;
          }
        }
        if (changed) {
          const others = allRules.filter((r) => r.kind !== "price");
          saveAlertRules([...others, ...priceRules]);
        }
        if (mounted) setRules(priceRules);
      } catch { if (mounted) setItems([]); }
    };
    load();
    const timer = setInterval(load, 60000);
    return () => { mounted = false; clearInterval(timer); };
  }, []);

  function persistPriceRules(next: PriceAlertRule[]) {
    const others = loadAlertRules().filter((r) => r.kind !== "price");
    saveAlertRules([...others, ...next]);
    setRules(next);
  }

  async function addAlertRule(item: WatchItem) {
    const price = parseFloat(alertPrice);
    if (!isFinite(price) || price <= 0) return;
    await ensureNotificationPermission();
    const newRule: PriceAlertRule = {
      id: makeAlertId(),
      kind: "price",
      symbol: item.symbol,
      label: getLocalizedAssetName(item, language),
      direction: alertDirection,
      targetPrice: price,
      enabled: true,
    };
    persistPriceRules([...rules, newRule]);
    setOpenAlertFor(null);
    setAlertPrice("");
  }

  function removeAlertRule(id: string) {
    persistPriceRules(rules.filter((r) => r.id !== id));
  }

  // 기술 지표 로드 (심볼별 병렬)
  useEffect(() => {
    if (!items.length) return;
    let mounted = true;
    setTechLoading(true);
    Promise.all(
      items.map(async (item) => {
        const data = await fetchTechData(item.symbol, item.group === "korea");
        return [item.symbol, data] as [string, TechData];
      })
    ).then((results) => {
      if (!mounted) return;
      setTechMap(Object.fromEntries(results));
      setTechLoading(false);
    });
    return () => { mounted = false; };
  }, [items]);

  const visible = useMemo(() => {
    const filtered = group === "all" ? items : items.filter((i) => i.group === group);
    return [...filtered].sort((a, b) => Math.abs(b.changePercent || 0) - Math.abs(a.changePercent || 0));
  }, [group, items]);

  const topWinner = [...items].filter(i => typeof i.changePercent === "number")
    .sort((a, b) => (b.changePercent || 0) - (a.changePercent || 0))[0];
  const topLoser = [...items].filter(i => typeof i.changePercent === "number")
    .sort((a, b) => (a.changePercent || 0) - (b.changePercent || 0))[0];

  function getEMASignal(tech: TechData, price: number | null): "bull" | "bear" | "mixed" | null {
    if (!price || !tech.ema20 || !tech.ema50) return null;
    const above20 = price > tech.ema20;
    const above50 = price > tech.ema50;
    const ema20AboveEma50 = tech.ema20 > tech.ema50;
    if (above20 && above50 && ema20AboveEma50) return "bull";
    if (!above20 && !above50 && !ema20AboveEma50) return "bear";
    return "mixed";
  }

  function get52wkPct(tech: TechData, price: number | null): number | null {
    if (!price || !tech.week52High || !tech.week52Low) return null;
    const range = tech.week52High - tech.week52Low;
    if (range <= 0) return null;
    return ((price - tech.week52Low) / range) * 100;
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        {/* Hero */}
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>{copy.eyebrow}</p>
            <h1 className={styles.title}>{copy.title}</h1>
            <p className={styles.description}>{copy.description}</p>
          </div>
          <div className={styles.heroStats}>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.totalAssets}</p>
              <p className={styles.statValue}>{items.length}</p>
              <p className={styles.statHint}>{copy.totalAssetsHint}</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.strongest}</p>
              <p className={styles.statValue}>{topWinner?.symbol || "-"}</p>
              <p className={styles.statHint}>{formatPercent(topWinner?.changePercent ?? null)}</p>
            </article>
            <article className={styles.statCard}>
              <p className={styles.statLabel}>{copy.weakest}</p>
              <p className={styles.statValue}>{topLoser?.symbol || "-"}</p>
              <p className={styles.statHint}>{formatPercent(topLoser?.changePercent ?? null)}</p>
            </article>
          </div>
        </section>

        {/* 필터 */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2 className={styles.panelTitle}>{copy.assetGroup}</h2>
            <span className={styles.panelCaption}>{copy.quickFilter}</span>
          </div>
          <div className={styles.chipRow}>
            {[{ id: "all", label: copy.all }, { id: "korea", label: copy.korea }, { id: "stock", label: copy.stock }]
              .map((item) => (
                <button key={item.id}
                  className={group === item.id ? styles.chipActive : styles.chip}
                  onClick={() => setGroup(item.id as "all" | WatchGroup)}>
                  {item.label}
                </button>
              ))}
          </div>
        </section>

        {/* 메인 그리드 */}
        <section className={styles.grid2}>
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{copy.moveRanking}</h2>
              <span className={styles.pill}>
                {group === "all" ? copy.allAssets : group === "korea" ? copy.korea : copy.stock}
              </span>
            </div>
            <div className={styles.stack}>
              {visible.map((item) => {
                const up   = typeof item.changePercent === "number" && item.changePercent >= 0;
                const tech = techMap[item.symbol];
                const ema  = tech ? getEMASignal(tech, item.price) : null;
                const wk52 = tech ? get52wkPct(tech, item.price) : null;
                const rsi  = tech?.rsi ?? null;
                const vol  = tech?.volRatio ?? null;

                return (
                  <div key={item.symbol} className={wStyles.card}>
                    {/* 기존 가격 행 */}
                    <div className={styles.itemRow}>
                      <div>
                        <p className={styles.itemTitle}>{getLocalizedAssetName(item, language)}</p>
                        <p className={styles.itemSub}>{item.symbol}</p>
                        <p className={styles.itemMeta}>
                          {item.group === "korea" ? copy.koreaType : copy.stockType}
                        </p>
                      </div>
                      <div className={styles.itemValue}>
                        <p className={styles.price}>{formatCurrency(item.price, item.group === "korea" ? "KRW" : "USD")}</p>
                        <p className={up ? styles.up : styles.down}>{formatPercent(item.changePercent)}</p>
                      </div>
                    </div>

                    {/* 기술 지표 배지 행 */}
                    {tech && !techLoading && (
                      <div className={wStyles.techRow}>
                        {/* RSI */}
                        {isFinite(rsi ?? NaN) && (
                          <span className={`${wStyles.badge} ${
                            (rsi ?? 0) > 70 ? wStyles.badgeRed :
                            (rsi ?? 0) < 30 ? wStyles.badgeGreen :
                            wStyles.badgeNeutral
                          }`}>
                            RSI {(rsi ?? 0).toFixed(0)}
                            {(rsi ?? 0) > 70 ? ` (${copy.overbought})` : (rsi ?? 0) < 30 ? ` (${copy.oversold})` : ""}
                          </span>
                        )}

                        {/* EMA 배열 */}
                        {ema && (
                          <span className={`${wStyles.badge} ${
                            ema === "bull" ? wStyles.badgeGreen :
                            ema === "bear" ? wStyles.badgeRed :
                            wStyles.badgeNeutral
                          }`}>
                            {ema === "bull" ? `▲ ${copy.bullAlign}` : ema === "bear" ? `▼ ${copy.bearAlign}` : `⇄ ${copy.mixAlign}`}
                          </span>
                        )}

                        {/* 52주 위치 바 */}
                        {wk52 !== null && (
                          <span className={wStyles.wk52Wrap} title={`${copy.week52}: ${wk52.toFixed(0)}%`}>
                            <span className={wStyles.wk52Label}>{copy.week52}</span>
                            <span className={wStyles.wk52Bar}>
                              <span className={wStyles.wk52Fill} style={{ width: `${wk52.toFixed(0)}%` }} />
                              <span className={wStyles.wk52Marker} style={{ left: `${wk52.toFixed(0)}%` }} />
                            </span>
                            <span className={wStyles.wk52Pct}>{wk52.toFixed(0)}%</span>
                          </span>
                        )}

                        {/* 거래량 배율 */}
                        {vol !== null && isFinite(vol) && (
                          <span className={`${wStyles.badge} ${
                            vol >= 2.0 ? wStyles.badgeRed :
                            vol >= 1.5 ? wStyles.badgeAmber :
                            wStyles.badgeNeutral
                          }`}>
                            {copy.volRatio} {vol.toFixed(1)}×
                          </span>
                        )}
                      </div>
                    )}

                    {/* 가격 알림 */}
                    <div className={wStyles.alertRow}>
                      {rules.filter((r) => r.symbol === item.symbol).map((r) => (
                        <span key={r.id} className={`${wStyles.alertChip} ${!r.enabled ? wStyles.alertChipDone : ""}`}>
                          {r.direction === "above" ? "≥" : "≤"} {r.targetPrice}
                          {!r.enabled && ` · ${copy.alertDone}`}
                          <button type="button" onClick={() => removeAlertRule(r.id)} aria-label="remove alert">×</button>
                        </span>
                      ))}
                      {openAlertFor === item.symbol ? (
                        <span className={wStyles.alertForm}>
                          <select
                            className={wStyles.alertSelect}
                            value={alertDirection}
                            onChange={(e) => setAlertDirection(e.target.value as "above" | "below")}
                          >
                            <option value="above">{copy.alertAbove}</option>
                            <option value="below">{copy.alertBelow}</option>
                          </select>
                          <input
                            className={wStyles.alertInput}
                            type="number"
                            value={alertPrice}
                            placeholder={copy.alertPricePlaceholder}
                            onChange={(e) => setAlertPrice(e.target.value)}
                          />
                          <button type="button" className={wStyles.alertBtn} onClick={() => addAlertRule(item)}>
                            {copy.alertSave}
                          </button>
                          <button type="button" className={wStyles.alertBtnGhost} onClick={() => setOpenAlertFor(null)}>
                            {copy.alertCancel}
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          className={wStyles.alertAddBtn}
                          onClick={() => { setOpenAlertFor(item.symbol); setAlertPrice(""); }}
                        >
                          🔔 {copy.alertAdd}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              {!visible.length && <p className={styles.emptyState}>{copy.empty}</p>}
            </div>
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>{copy.comparePairs}</h2>
              <span className={styles.panelCaption}>{copy.quickPairs}</span>
            </div>
            <div className={styles.stack}>
              {PAIRS[language].map(([title, desc]) => (
                <div key={title} className={styles.listCard}>
                  <p className={styles.itemTitle}>{title}</p>
                  <p className={styles.itemMeta}>{desc}</p>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
