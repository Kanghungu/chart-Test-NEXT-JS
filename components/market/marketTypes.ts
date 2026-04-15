import type { MacroQuotePayload, SessionRiskPayload } from "@/lib/macroQuotes";

export type { MacroQuotePayload, SessionRiskPayload };

export interface AssetItem {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  currency?: string | null;
}

export interface FearGreedData {
  value: number;
  classification: string;
}

export interface SnapshotData {
  assets: AssetItem[];
  fearGreed: FearGreedData | null;
  koreaFearGreed?: FearGreedData | null;
  stockFearGreed?: FearGreedData | null;
  koreaTradingValue: number | null;
  /** 원달러·DXY·국채 등 거시 한 줄 */
  macroRail?: MacroQuotePayload[];
  /** VIX·미니 선물 (세션 리스크 보조) */
  sessionRisk?: SessionRiskPayload;
  warnings: string[];
  updatedAt: string | null;
}

export interface TickerItem {
  symbol: string;
  name?: string;
  nameKo?: string;
  nameEn?: string;
  price: number | null;
  changePercent: number | null;
}
