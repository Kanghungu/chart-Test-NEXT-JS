/**
 * 뉴스 헤드라인/요약에서 키워드 빈도 집계 (대시보드 히트맵 보조용)
 */
export type NewsKeywordBucket = {
  id: string;
  labelKo: string;
  labelEn: string;
  count: number;
};

type KeywordRule = {
  id: string;
  labelKo: string;
  labelEn: string;
  patterns: RegExp[];
};

const KEYWORD_RULES: KeywordRule[] = [
  {
    id: "ai",
    labelKo: "AI · 반도체",
    labelEn: "AI & chips",
    patterns: [/\bai\b/i, /nvidia|엔비디아/i, /인공지능/i, /gpu/i]
  },
  {
    id: "fed",
    labelKo: "연준 · 금리",
    labelEn: "Fed & rates",
    patterns: [/\bfed\b|fomc|파월|연준/i, /금리|기준금리|국채/i]
  },
  {
    id: "macro",
    labelKo: "물가 · 고용",
    labelEn: "Inflation & jobs",
    patterns: [/cpi|ppi|pce|nfp|고용|실업|인플레|물가/i]
  },
  {
    id: "korea",
    labelKo: "코스피 · 코스닥",
    labelEn: "Korea market",
    patterns: [/코스피|코스닥|kospi|kosdaq/i, /삼성전자|sk하이닉스|외국인/i]
  },
  {
    id: "us-tech",
    labelKo: "미국 빅테크",
    labelEn: "US mega tech",
    patterns: [/apple|애플|aapl|microsoft|msft|meta|alphabet|구글/i, /amazon|아마족/i]
  },
  {
    id: "energy",
    labelKo: "에너지",
    labelEn: "Energy",
    patterns: [/oil|원유|opec|wti|brent|가스|lng/i]
  }
];

export function aggregateKeywordBuckets(texts: string[]): NewsKeywordBucket[] {
  const counters = new Map<string, number>();

  KEYWORD_RULES.forEach((rule) => {
    counters.set(rule.id, 0);
  });

  texts.forEach((raw) => {
    const text = raw || "";
    if (!text.trim()) return;

    KEYWORD_RULES.forEach((rule) => {
      const hit = rule.patterns.some((pattern) => pattern.test(text));
      if (!hit) return;

      counters.set(rule.id, (counters.get(rule.id) || 0) + 1);
    });
  });

  return KEYWORD_RULES.map((rule) => ({
    id: rule.id,
    labelKo: rule.labelKo,
    labelEn: rule.labelEn,
    count: counters.get(rule.id) || 0
  }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
}
