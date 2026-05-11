"use client";
import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import s from "./tools.module.css";

type KimpData = {
  upbit: number | null;
  binance: number | null;
  usdkrw: number | null;
  kimp: number | null;
  ts: number;
};

const HISTORY_MAX = 60;

async function fetchKimp(): Promise<KimpData> {
  const ts = Date.now();
  try {
    // 업비트·바이낸스는 브라우저 CORS 허용, 환율만 서버 프록시 사용
    const [upbitRes, binRes, macroRes] = await Promise.allSettled([
      fetch("https://api.upbit.com/v1/ticker?markets=KRW-BTC", { cache: "no-store" }),
      fetch("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT", { cache: "no-store" }),
      fetch("/api/macro/quotes", { cache: "no-store" }),
    ]);

    const upbit = upbitRes.status === "fulfilled" && upbitRes.value.ok
      ? (await upbitRes.value.json())[0]?.trade_price ?? null
      : null;

    const binance = binRes.status === "fulfilled" && binRes.value.ok
      ? parseFloat((await binRes.value.json()).price)
      : null;

    let usdkrw: number | null = null;
    if (macroRes.status === "fulfilled" && macroRes.value.ok) {
      const d = await macroRes.value.json();
      usdkrw = d?.usdkrw?.price ?? null;
    }

    const kimp = upbit && binance && usdkrw
      ? ((upbit - binance * usdkrw) / (binance * usdkrw)) * 100
      : null;

    return { upbit, binance, usdkrw, kimp, ts };
  } catch {
    return { upbit: null, binance: null, usdkrw: null, kimp: null, ts };
  }
}

const COPY = {
  ko: {
    title: "김프 모니터", kicker: "KIMP MONITOR · 한국 프리미엄",
    hint: "업비트 BTC/KRW vs Binance BTC/USDT × 원달러 환율로 산출한 프리미엄",
    upbit: "업비트 BTC", binance: "바이낸스 BTC (원화 환산)", usdkrw: "원/달러 환율",
    kimp: "김프", premium: "프리미엄", discount: "역프리미엄", neutral: "보합",
    history: "실시간 변화", refreshing: "갱신 중...",
    guide: ["김프 > 2%: 국내 과열 (숏 우위)", "김프 1~2%: 일반적 수준", "김프 0~1%: 낮음", "역프 < 0%: 국내 약세 (롱 우위)"],
  },
  en: {
    title: "Kimchi Premium", kicker: "KIMP MONITOR · Korean Premium",
    hint: "Upbit BTC/KRW vs Binance BTC/USDT × USD/KRW exchange rate",
    upbit: "Upbit BTC", binance: "Binance BTC (in KRW)", usdkrw: "USD/KRW Rate",
    kimp: "Premium", premium: "Premium", discount: "Discount", neutral: "Neutral",
    history: "Live History", refreshing: "Refreshing...",
    guide: ["Kimp > 2%: Korean overheated (short bias)", "Kimp 1~2%: Normal range", "Kimp 0~1%: Low", "Negative: Korean bearish (long bias)"],
  },
} as const;

function kimpColor(v: number | null) {
  if (v === null) return "#94a3b8";
  if (v > 3) return "#f87171";
  if (v > 1.5) return "#f59e0b";
  if (v > 0) return "#10b981";
  return "#06b6d4";
}

type CopyType = { premium: string; discount: string; neutral: string };
function kimpLabel(v: number | null, C: CopyType) {
  if (v === null) return "—";
  if (v > 0.3) return C.premium;
  if (v < -0.3) return C.discount;
  return C.neutral;
}

export default function KimpMonitor() {
  const { language } = useLanguage();
  const C = COPY[language];
  const [data, setData] = useState<KimpData>({ upbit: null, binance: null, usdkrw: null, kimp: null, ts: 0 });
  const [history, setHistory] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const d = await fetchKimp();
      if (!mounted) return;
      setData(d);
      setLoading(false);
      if (d.kimp !== null) {
        setHistory(prev => [...prev.slice(-(HISTORY_MAX - 1)), d.kimp!]);
      }
    };
    load();
    const t = setInterval(load, 15_000);
    return () => { mounted = false; clearInterval(t); };
  }, []);

  // 미니 차트 그리기
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const min = Math.min(...history) - 0.1;
    const max = Math.max(...history) + 0.1;
    const range = max - min || 1;

    const toX = (i: number) => (i / (HISTORY_MAX - 1)) * W;
    const toY = (v: number) => H - ((v - min) / range) * H;

    // 0선 (보라색)
    const zeroY = toY(0);
    ctx.strokeStyle = "rgba(124,58,237,0.3)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(W, zeroY); ctx.stroke();
    ctx.setLineDash([]);

    // 라인
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "#7c3aed");
    grad.addColorStop(1, "#06b6d4");
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((v, i) => {
      const x = toX(i + (HISTORY_MAX - history.length));
      const y = toY(v);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // 영역 채우기
    const lastX = toX(HISTORY_MAX - 1);
    ctx.lineTo(lastX, H); ctx.lineTo(0, H); ctx.closePath();
    const fill = ctx.createLinearGradient(0, 0, 0, H);
    fill.addColorStop(0, "rgba(124,58,237,0.2)");
    fill.addColorStop(1, "transparent");
    ctx.fillStyle = fill;
    ctx.fill();
  }, [history]);

  const kimpVal = data.kimp;
  const color = kimpColor(kimpVal);

  return (
    <div className={s.card}>
      <div className={s.cardHeader}>
        <div>
          <p className={s.kicker}>{C.kicker}</p>
          <h2 className={s.title}>{C.title}</h2>
          <p className={s.hint}>{C.hint}</p>
        </div>
        {loading && <span className={s.loadingBadge}>{C.refreshing}</span>}
      </div>

      {/* 메인 수치 */}
      <div className={s.kimpHero}>
        <div className={s.kimpBig} style={{ color }}>
          {kimpVal !== null ? `${kimpVal >= 0 ? "+" : ""}${kimpVal.toFixed(3)}%` : "—"}
        </div>
        <div className={s.kimpLabel} style={{ color }}>
          {kimpLabel(kimpVal, C)}
        </div>
      </div>

      {/* 데이터 행 */}
      <div className={s.kimpGrid}>
        <KimpCell label={C.upbit}
          value={data.upbit ? `₩${data.upbit.toLocaleString("ko-KR")}` : "—"}
          color="#ec4899" />
        <KimpCell label={C.binance}
          value={data.binance && data.usdkrw
            ? `₩${(data.binance * data.usdkrw).toLocaleString("ko-KR", { maximumFractionDigits: 0 })}`
            : "—"}
          color="#f59e0b" />
        <KimpCell label={C.usdkrw}
          value={data.usdkrw ? `₩${data.usdkrw.toFixed(2)}` : "—"}
          color="#06b6d4" />
      </div>

      {/* 미니 차트 */}
      <div className={s.miniChartWrap}>
        <p className={s.miniChartLabel}>{C.history}</p>
        <canvas ref={canvasRef} width={600} height={80} className={s.miniCanvas} />
      </div>

      {/* 가이드 */}
      <div className={s.kimpGuide}>
        {C.guide.map((g, i) => (
          <div key={i} className={s.guideRow}>
            <span className={s.guideDot}
              style={{ background: i === 0 ? "#f87171" : i === 1 ? "#f59e0b" : i === 2 ? "#10b981" : "#06b6d4" }} />
            <span>{g}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KimpCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className={s.kimpCell}>
      <p className={s.kimpCellLabel}>{label}</p>
      <p className={s.kimpCellValue} style={{ color }}>{value}</p>
    </div>
  );
}
