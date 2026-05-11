"use client";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import s from "./tools.module.css";

const ASSETS = [
  { sym: "BTC", binance: "BTCUSDT", color: "#f7931a" },
  { sym: "ETH", binance: "ETHUSDT", color: "#627eea" },
  { sym: "SOL", binance: "SOLUSDT", color: "#14f195" },
  { sym: "XRP", binance: "XRPUSDT", color: "#00a3e0" },
  { sym: "BNB", binance: "BNBUSDT", color: "#f3ba2f" },
];
type TF = "7d" | "30d" | "90d";
const TF_LIMIT: Record<TF, number> = { "7d": 7, "30d": 30, "90d": 90 };

const COPY = {
  ko: {
    title: "자산 상관관계", kicker: "ASSET CORRELATION · 상관계수 매트릭스",
    hint: "주요 암호화폐 간 피어슨 상관계수 — 1에 가까울수록 동조화, -1에 가까울수록 역상관",
    tf: "기간", loading: "상관계수 계산 중...", error: "데이터 로드 실패",
    high: "강한 상관 (≥0.7)", mid: "중간 (0.3~0.7)", low: "낮음 (<0.3)", neg: "역상관 (<0)",
    guide: "상관계수 0.9+: 사실상 동조 / 0.7~0.9: 높은 상관 / 0.5~0.7: 중간 / 0.3 미만: 독립적",
  },
  en: {
    title: "Asset Correlation", kicker: "ASSET CORRELATION · Pearson Matrix",
    hint: "Pearson correlation between major crypto assets — 1 = perfect co-movement, -1 = inverse",
    tf: "Period", loading: "Calculating correlations...", error: "Failed to load",
    high: "High (≥0.7)", mid: "Medium (0.3~0.7)", low: "Low (<0.3)", neg: "Negative (<0)",
    guide: "0.9+: virtually identical / 0.7~0.9: high / 0.5~0.7: moderate / <0.3: independent",
  },
} as const;

function pearson(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return NaN;
  const xm = xs.reduce((s, v) => s + v, 0) / n;
  const ym = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xm) * (ys[i] - ym);
    dx  += (xs[i] - xm) ** 2;
    dy  += (ys[i] - ym) ** 2;
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
}

function corrColor(v: number): string {
  if (!isFinite(v)) return "rgba(51,65,85,0.3)";
  if (v >= 0.9) return "rgba(16,185,129,0.7)";
  if (v >= 0.7) return "rgba(16,185,129,0.45)";
  if (v >= 0.5) return "rgba(16,185,129,0.25)";
  if (v >= 0.3) return "rgba(245,158,11,0.25)";
  if (v >= 0)   return "rgba(51,65,85,0.2)";
  if (v >= -0.3) return "rgba(239,68,68,0.15)";
  return                "rgba(239,68,68,0.35)";
}

async function fetchCloses(binSym: string, days: number): Promise<number[]> {
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${binSym}&interval=1d&limit=${days}`,
      { cache: "no-store" }
    );
    const data = await res.json() as Array<(string|number)[]>;
    return data.map(k => parseFloat(k[4] as string));
  } catch { return []; }
}

export default function Correlation() {
  const { language } = useLanguage();
  const C = COPY[language];
  const [tf, setTf]           = useState<TF>("30d");
  const [matrix, setMatrix]   = useState<number[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  const calc = useCallback(async () => {
    setLoading(true); setError(false);
    const days = TF_LIMIT[tf];
    const closes = await Promise.all(ASSETS.map(a => fetchCloses(a.binance, days)));
    if (closes.every(c => !c.length)) { setError(true); setLoading(false); return; }

    // 일간 수익률
    const rets = closes.map(c => c.slice(1).map((v, i) => (v - c[i]) / c[i]));

    // 상관 매트릭스
    const n = ASSETS.length;
    const m = Array.from({ length: n }, (_, i) =>
      Array.from({ length: n }, (_, j) => pearson(rets[i], rets[j]))
    );
    setMatrix(m);
    setLoading(false);
  }, [tf]);

  useEffect(() => { calc(); }, [calc]);

  return (
    <div className={s.card}>
      <div className={s.cardHeader}>
        <div>
          <p className={s.kicker}>{C.kicker}</p>
          <h2 className={s.title}>{C.title}</h2>
          <p className={s.hint}>{C.hint}</p>
        </div>
        <div style={{ display: "flex", gap: "0.4rem" }}>
          {(["7d","30d","90d"] as TF[]).map(t => (
            <button key={t}
              className={`${s.viewBtn} ${tf === t ? s.viewBtnActive : ""}`}
              onClick={() => setTf(t)}>{t}
            </button>
          ))}
        </div>
      </div>

      {loading && <div className={s.loadingBox}><span className={s.spinner} />{C.loading}</div>}

      {!loading && !error && matrix.length > 0 && (
        <>
          <div className={s.corrWrap}>
            {/* 헤더 행 */}
            <div className={s.corrHeader}>
              <div className={s.corrCorner} />
              {ASSETS.map(a => (
                <div key={a.sym} className={s.corrHead} style={{ color: a.color }}>{a.sym}</div>
              ))}
            </div>
            {/* 데이터 행 */}
            {ASSETS.map((rowA, i) => (
              <div key={rowA.sym} className={s.corrRow}>
                <div className={s.corrRowHead} style={{ color: rowA.color }}>{rowA.sym}</div>
                {ASSETS.map((colA, j) => {
                  const v = matrix[i]?.[j] ?? NaN;
                  const isSelf = i === j;
                  return (
                    <div key={colA.sym}
                      className={s.corrCell}
                      style={{ background: isSelf ? "rgba(124,58,237,0.3)" : corrColor(v) }}
                      title={`${rowA.sym} / ${colA.sym}: ${v.toFixed(3)}`}
                    >
                      <span style={{
                        color: isSelf ? "#7c3aed" : isFinite(v) && v < 0 ? "#f87171" : "#e2e8f0",
                        fontWeight: isSelf ? 800 : 600,
                      }}>
                        {isSelf ? "—" : isFinite(v) ? v.toFixed(2) : "—"}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* 범례 */}
          <div className={s.corrLegend}>
            {[
              { label: C.high, bg: "rgba(16,185,129,0.45)" },
              { label: C.mid,  bg: "rgba(245,158,11,0.25)" },
              { label: C.low,  bg: "rgba(51,65,85,0.2)" },
              { label: C.neg,  bg: "rgba(239,68,68,0.35)" },
            ].map(({ label, bg }) => (
              <span key={label} className={s.corrLegendItem}>
                <span className={s.corrLegendBox} style={{ background: bg }} />
                {label}
              </span>
            ))}
          </div>
          <p className={s.etfGuide}>{C.guide}</p>
        </>
      )}
    </div>
  );
}
