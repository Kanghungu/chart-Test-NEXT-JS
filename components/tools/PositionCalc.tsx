"use client";
import { useState, useMemo } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import s from "./tools.module.css";

const COINS = ["BTC","ETH","SOL","XRP","BNB","DOGE","ADA","LTC"] as const;
const LEVERAGES = [1,2,3,5,10,15,20,25,50,75,100,125] as const;
const FEE_TAKER = 0.0004; // 0.04% 테이커 수수료

const COPY = {
  ko: {
    title: "포지션 계산기", hint: "진입가·레버리지·금액으로 청산가·손익을 자동 계산합니다",
    direction: "방향", long: "롱 (상승)", short: "숏 (하락)",
    coin: "코인", leverage: "레버리지", entryPrice: "진입가 (USDT)",
    amount: "투자 금액 (USDT)", stopLoss: "손절가 (선택)", target: "목표가 (선택)",
    result: "계산 결과", liqPrice: "청산가", posSize: "포지션 크기",
    margin: "사용 증거금", fee: "진입 수수료",
    slLoss: "손절 시 손실", tpProfit: "목표 시 수익", rr: "RR 비율",
    reset: "초기화", warning: "과도한 레버리지는 빠른 청산을 유발합니다. 항상 리스크 관리를 먼저.",
    unit: "개",
  },
  en: {
    title: "Position Calculator", hint: "Auto-calculate liquidation price and P&L from entry, leverage & size",
    direction: "Direction", long: "Long (Bullish)", short: "Short (Bearish)",
    coin: "Coin", leverage: "Leverage", entryPrice: "Entry Price (USDT)",
    amount: "Capital (USDT)", stopLoss: "Stop Loss (optional)", target: "Take Profit (optional)",
    result: "Results", liqPrice: "Liq. Price", posSize: "Position Size",
    margin: "Margin Used", fee: "Entry Fee",
    slLoss: "Loss at SL", tpProfit: "Profit at TP", rr: "Risk/Reward",
    reset: "Reset", warning: "High leverage leads to rapid liquidation. Always manage your risk first.",
    unit: "units",
  },
} as const;

function fmt(n: number, dec = 2) {
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
function pct(n: number) { return isFinite(n) ? `${n >= 0 ? "+" : ""}${fmt(n, 2)}%` : "—"; }

export default function PositionCalc() {
  const { language } = useLanguage();
  const C = COPY[language];

  const [dir,      setDir]      = useState<"long"|"short">("long");
  const [coin,     setCoin]     = useState("BTC");
  const [lev,      setLev]      = useState(10);
  const [entry,    setEntry]    = useState("");
  const [amount,   setAmount]   = useState("");
  const [stop,     setStop]     = useState("");
  const [target,   setTarget]   = useState("");

  const calc = useMemo(() => {
    const ep = parseFloat(entry);
    const am = parseFloat(amount);
    if (!isFinite(ep) || ep <= 0 || !isFinite(am) || am <= 0) return null;

    const posUSDT  = am * lev;                          // 포지션 USDT 가치
    const posSize  = posUSDT / ep;                      // 코인 수량
    const fee      = posUSDT * FEE_TAKER;               // 진입 수수료

    // 청산가
    const liqPrice = dir === "long"
      ? ep * (1 - 1/lev)
      : ep * (1 + 1/lev);

    // 손절
    const sl = parseFloat(stop);
    let slLoss = NaN, slPct = NaN;
    if (isFinite(sl) && sl > 0) {
      slLoss = dir === "long"
        ? (ep - sl) * posSize
        : (sl - ep) * posSize;
      slPct = (slLoss / am) * 100;
    }

    // 목표
    const tp = parseFloat(target);
    let tpProfit = NaN, tpPct = NaN, rr = NaN;
    if (isFinite(tp) && tp > 0) {
      tpProfit = dir === "long"
        ? (tp - ep) * posSize
        : (ep - tp) * posSize;
      tpPct = (tpProfit / am) * 100;
      if (isFinite(slLoss) && slLoss > 0) rr = tpProfit / slLoss;
    }

    return { posSize, fee, liqPrice, slLoss, slPct, tpProfit, tpPct, rr };
  }, [dir, lev, entry, amount, stop, target]);

  const reset = () => { setEntry(""); setAmount(""); setStop(""); setTarget(""); };

  const liqDanger = calc && entry
    ? Math.abs(calc.liqPrice - parseFloat(entry)) / parseFloat(entry) < 0.05
    : false;

  return (
    <div className={s.card}>
      <div className={s.cardHeader}>
        <div>
          <p className={s.kicker}>POSITION CALCULATOR · 포지션 계산기</p>
          <h2 className={s.title}>{C.title}</h2>
          <p className={s.hint}>{C.hint}</p>
        </div>
      </div>

      <div className={s.calcGrid}>
        {/* 입력 패널 */}
        <div className={s.inputPanel}>
          {/* 방향 */}
          <div className={s.field}>
            <label className={s.label}>{C.direction}</label>
            <div className={s.dirBtns}>
              <button
                className={`${s.dirBtn} ${dir === "long" ? s.dirLong : ""}`}
                onClick={() => setDir("long")}
              >▲ {C.long}</button>
              <button
                className={`${s.dirBtn} ${dir === "short" ? s.dirShort : ""}`}
                onClick={() => setDir("short")}
              >▼ {C.short}</button>
            </div>
          </div>

          {/* 코인 */}
          <div className={s.field}>
            <label className={s.label}>{C.coin}</label>
            <div className={s.chipRow}>
              {COINS.map(c => (
                <button key={c} className={`${s.chip} ${coin === c ? s.chipActive : ""}`}
                  onClick={() => setCoin(c)}>{c}</button>
              ))}
            </div>
          </div>

          {/* 레버리지 */}
          <div className={s.field}>
            <label className={s.label}>{C.leverage}: <span className={s.levVal}>{lev}×</span></label>
            <input type="range" min={1} max={125} value={lev}
              onChange={e => setLev(Number(e.target.value))}
              className={s.slider} list="lev-list" />
            <datalist id="lev-list">
              {LEVERAGES.map(l => <option key={l} value={l} />)}
            </datalist>
            <div className={s.levScale}>
              {LEVERAGES.map(l => <span key={l}>{l}×</span>)}
            </div>
          </div>

          {/* 진입가 / 금액 */}
          <div className={s.inputRow}>
            <div className={s.field}>
              <label className={s.label}>{C.entryPrice}</label>
              <input className={s.input} type="number" placeholder="e.g. 80000"
                value={entry} onChange={e => setEntry(e.target.value)} />
            </div>
            <div className={s.field}>
              <label className={s.label}>{C.amount}</label>
              <input className={s.input} type="number" placeholder="e.g. 1000"
                value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
          </div>

          <div className={s.inputRow}>
            <div className={s.field}>
              <label className={s.label}>{C.stopLoss}</label>
              <input className={s.input} type="number" placeholder="—"
                value={stop} onChange={e => setStop(e.target.value)} />
            </div>
            <div className={s.field}>
              <label className={s.label}>{C.target}</label>
              <input className={s.input} type="number" placeholder="—"
                value={target} onChange={e => setTarget(e.target.value)} />
            </div>
          </div>

          <button className={s.resetBtn} onClick={reset}>{C.reset}</button>
          <p className={s.warning}>⚠ {C.warning}</p>
        </div>

        {/* 결과 패널 */}
        <div className={s.resultPanel}>
          <p className={s.resultTitle}>{C.result}</p>
          {!calc ? (
            <p className={s.placeholder}>진입가와 투자 금액을 입력하세요</p>
          ) : (
            <div className={s.resultGrid}>
              <ResultRow label={C.liqPrice}
                value={`$${fmt(calc.liqPrice, 2)}`}
                sub={calc.liqPrice && entry ? pct(((calc.liqPrice - parseFloat(entry)) / parseFloat(entry)) * 100) : ""}
                color={liqDanger ? "red" : "amber"}
                glow={liqDanger} />
              <ResultRow label={C.posSize}
                value={`${fmt(calc.posSize, 4)} ${coin}`} color="cyan" />
              <ResultRow label={C.margin}
                value={`$${fmt(parseFloat(amount), 2)}`} color="default" />
              <ResultRow label={C.fee}
                value={`$${fmt(calc.fee, 4)}`} color="default" />
              {isFinite(calc.slLoss) && (
                <ResultRow label={C.slLoss}
                  value={`-$${fmt(calc.slLoss, 2)}`}
                  sub={pct(-Math.abs(calc.slPct))} color="red" />
              )}
              {isFinite(calc.tpProfit) && (
                <ResultRow label={C.tpProfit}
                  value={`+$${fmt(calc.tpProfit, 2)}`}
                  sub={pct(calc.tpPct)} color="green" />
              )}
              {isFinite(calc.rr) && (
                <ResultRow label={C.rr}
                  value={`1 : ${fmt(calc.rr, 2)}`}
                  color={calc.rr >= 2 ? "green" : calc.rr >= 1 ? "amber" : "red"} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultRow({ label, value, sub, color, glow }:
  { label: string; value: string; sub?: string; color?: string; glow?: boolean }) {
  const colorMap: Record<string, string> = {
    cyan: "#06b6d4", green: "#10b981", red: "#f87171",
    amber: "#f59e0b", purple: "#7c3aed", default: "#e2e8f0",
  };
  const c = colorMap[color ?? "default"];
  return (
    <div className={`${s.resultRow} ${glow ? s.resultGlow : ""}`}>
      <span className={s.resultLabel}>{label}</span>
      <div className={s.resultRight}>
        <span className={s.resultValue} style={{ color: c }}>{value}</span>
        {sub && <span className={s.resultSub}>{sub}</span>}
      </div>
    </div>
  );
}
