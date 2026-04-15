/**
 * 거시·변동성 스냅샷용 공통 타입 (API 응답과 클라이언트 상태 공유)
 */
export type MacroQuoteDisplayUnit = "pair" | "index" | "yield" | "future";

export type MacroQuoteId = "usdkrw" | "dxy" | "us10y" | "kr10y";

export interface MacroQuotePayload {
  id: MacroQuoteId;
  price: number | null;
  changePercent: number | null;
  displayUnit: MacroQuoteDisplayUnit;
}

export interface SessionRiskPayload {
  vix: { price: number | null; changePercent: number | null };
  esFuture: { price: number | null; changePercent: number | null };
  nqFuture: { price: number | null; changePercent: number | null };
}
