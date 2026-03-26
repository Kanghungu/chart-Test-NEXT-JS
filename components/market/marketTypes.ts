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
  cryptoVolumeUsd: number | null;
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
