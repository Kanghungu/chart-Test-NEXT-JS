import { NextResponse } from "next/server";

type EventItem = {
  time: string;
  country: string;
  title: string;
  impact: string;
};

function fallbackEvents(): EventItem[] {
  return [
    { time: "이번 주", country: "미국", title: "연준 위원 발언 및 금리 경로 점검", impact: "높음" },
    { time: "이번 주", country: "미국", title: "주요 기술주 실적 가이던스", impact: "중간" },
    { time: "이번 주", country: "한국", title: "수출/물가 관련 지표 발표", impact: "중간" },
    { time: "이번 주", country: "유럽", title: "유럽 물가 및 경기지표 확인", impact: "중간" }
  ];
}

function normalizeCountry(v: string) {
  const upper = (v || "").toUpperCase();
  if (upper.includes("USD") || upper === "US") return "미국";
  if (upper.includes("EUR") || upper === "EU") return "유럽";
  if (upper.includes("JPY") || upper === "JP") return "일본";
  if (upper.includes("KRW") || upper === "KR") return "한국";
  if (upper.includes("CNY") || upper === "CN") return "중국";
  return v || "기타";
}

export async function GET() {
  try {
    const res = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      cache: "no-store"
    });

    if (!res.ok) {
      return NextResponse.json({ items: fallbackEvents(), source: "fallback" });
    }

    const json = await res.json();
    const rows = Array.isArray(json) ? json : [];

    const items: EventItem[] = rows
      .filter((row) => {
        const c = (row?.country || "").toString().toUpperCase();
        return ["USD", "EUR", "JPY", "KRW", "CNY"].includes(c);
      })
      .map((row) => ({
        time: `${row?.date || ""} ${row?.time || ""}`.trim() || "일정 미정",
        country: normalizeCountry((row?.country || "").toString()),
        title: (row?.title || "주요 경제 이벤트").toString(),
        impact: (row?.impact || "중간").toString()
      }))
      .slice(0, 8);

    if (!items.length) {
      return NextResponse.json({ items: fallbackEvents(), source: "fallback" });
    }

    return NextResponse.json({ items, source: "live" });
  } catch {
    return NextResponse.json({ items: fallbackEvents(), source: "fallback" });
  }
}

