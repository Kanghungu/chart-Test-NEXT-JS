export type EarningsEntry = {
  symbol: string;
  nameKo: string;
  nameEn: string;
  date: string; // YYYY-MM-DD
  time: "BMO" | "AMC" | "TBD"; // Before Market Open / After Market Close
  epsEstKo?: string;
  epsEstEn?: string;
  revenueEstKo?: string;
  revenueEstEn?: string;
  market: "US" | "KR";
};

export const EARNINGS_DATA: EarningsEntry[] = [
  // === April 2026 ===
  { symbol: "TSLA",  nameKo: "테슬라",       nameEn: "Tesla",           date: "2026-04-22", time: "AMC", epsEstKo: "$0.47",  epsEstEn: "$0.47",  revenueEstKo: "$21.4B", revenueEstEn: "$21.4B", market: "US" },
  { symbol: "META",  nameKo: "메타",         nameEn: "Meta",            date: "2026-04-29", time: "AMC", epsEstKo: "$5.24",  epsEstEn: "$5.24",  revenueEstKo: "$41.4B", revenueEstEn: "$41.4B", market: "US" },
  { symbol: "AAPL",  nameKo: "애플",         nameEn: "Apple",           date: "2026-05-01", time: "AMC", epsEstKo: "$1.62",  epsEstEn: "$1.62",  revenueEstKo: "$94.2B", revenueEstEn: "$94.2B", market: "US" },
  { symbol: "AMZN",  nameKo: "아마존",       nameEn: "Amazon",          date: "2026-05-01", time: "AMC", epsEstKo: "$1.37",  epsEstEn: "$1.37",  revenueEstKo: "$155B",  revenueEstEn: "$155B",  market: "US" },
  // === May 2026 ===
  { symbol: "MSFT",  nameKo: "마이크로소프트", nameEn: "Microsoft",      date: "2026-05-07", time: "AMC", epsEstKo: "$3.22",  epsEstEn: "$3.22",  revenueEstKo: "$68.4B", revenueEstEn: "$68.4B", market: "US" },
  { symbol: "GOOGL", nameKo: "알파벳",       nameEn: "Alphabet",        date: "2026-05-07", time: "AMC", epsEstKo: "$2.11",  epsEstEn: "$2.11",  revenueEstKo: "$90.1B", revenueEstEn: "$90.1B", market: "US" },
  { symbol: "NVDA",  nameKo: "엔비디아",     nameEn: "NVIDIA",          date: "2026-05-28", time: "AMC", epsEstKo: "$0.89",  epsEstEn: "$0.89",  revenueEstKo: "$43.2B", revenueEstEn: "$43.2B", market: "US" },
  // === Korean stocks ===
  { symbol: "005930", nameKo: "삼성전자",    nameEn: "Samsung Elec.",   date: "2026-04-30", time: "BMO", epsEstKo: "₩500",   epsEstEn: "₩500",   revenueEstKo: "₩73조", revenueEstEn: "₩73T",   market: "KR" },
  { symbol: "000660", nameKo: "SK하이닉스",  nameEn: "SK Hynix",        date: "2026-04-24", time: "BMO", epsEstKo: "₩6,800", epsEstEn: "₩6,800", revenueEstKo: "₩19조", revenueEstEn: "₩19T",   market: "KR" },
  { symbol: "035420", nameKo: "NAVER",      nameEn: "NAVER",           date: "2026-05-08", time: "BMO", epsEstKo: "₩1,200", epsEstEn: "₩1,200", revenueEstKo: "₩2.8조", revenueEstEn: "₩2.8T",  market: "KR" },
  // === June 2026 ===
  { symbol: "005380", nameKo: "현대차",      nameEn: "Hyundai Motor",   date: "2026-07-24", time: "BMO", epsEstKo: "₩8,500", epsEstEn: "₩8,500", revenueEstKo: "₩43조", revenueEstEn: "₩43T",   market: "KR" },
];
