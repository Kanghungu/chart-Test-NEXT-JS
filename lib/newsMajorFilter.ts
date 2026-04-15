/**
 * 카더라·루머·무근거 보도 등 제목/요약에서 흔한 패턴 제외 (완벽 분류는 아님)
 */
const KOREAN_RUMOR_OR_TABLOID = [
  "카더라",
  "카더라성",
  "루머",
  "무근거",
  "근거없",
  "사실무근",
  "확인불가",
  "확인 불가",
  "확인안됨",
  "확인 안 됨",
  "날조",
  "익명커뮤",
  "익명 커뮤",
  "디시인사이드",
  "dc인사이드",
  "한줄요약",
  "ㅇㅇ이라더라",
  "썰 푼",
  "썰프다",
  "가짜뉴스",
  "가짜 뉴스"
];

const ENGLISH_RUMOR = [
  "unconfirmed rumor",
  "rumor mill",
  "according to unnamed sources",
  "internet rumor",
  "social media rumor",
  "unverified claim"
];

/** 출처 문자열에 들어가면 제외할 힌트 (커뮤·낚시 성격) */
const LOW_TRUST_PUBLISHER_HINTS = [
  "펨코",
  "루리웹",
  "ilbe",
  "dcinside",
  "디시인사이드"
];

function normalizeForScan(text: string) {
  return (text || "").toLowerCase();
}

export function isLikelyRumorOrTabloidNews(fullText: string, publisher: string) {
  const combined = `${fullText} ${publisher}`;
  const lower = normalizeForScan(combined);

  if (KOREAN_RUMOR_OR_TABLOID.some((needle) => combined.includes(needle))) {
    return true;
  }

  if (ENGLISH_RUMOR.some((needle) => lower.includes(needle.toLowerCase()))) {
    return true;
  }

  if (LOW_TRUST_PUBLISHER_HINTS.some((hint) => lower.includes(hint.toLowerCase()))) {
    return true;
  }

  return false;
}
