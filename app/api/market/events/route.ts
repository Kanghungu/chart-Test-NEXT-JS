import { NextResponse } from "next/server";

type EventItem = {
  time: string;
  country: string;
  countryKo: string;
  countryEn: string;
  title: string;
  titleKo: string;
  titleEn: string;
  impact: string;
  impactKo: string;
  impactEn: string;
};

function fallbackEvents(): EventItem[] {
  return [
    {
      time: "This week",
      country: "United States",
      countryKo: "미국",
      countryEn: "United States",
      title: "Fed speakers and rate-path check",
      titleKo: "연준 위원 발언 및 금리 경로 점검",
      titleEn: "Fed speakers and rate-path check",
      impact: "HIGH",
      impactKo: "높음",
      impactEn: "HIGH"
    },
    {
      time: "This week",
      country: "United States",
      countryKo: "미국",
      countryEn: "United States",
      title: "Major tech earnings guidance",
      titleKo: "주요 기술주 실적 가이던스",
      titleEn: "Major tech earnings guidance",
      impact: "MEDIUM",
      impactKo: "중간",
      impactEn: "MEDIUM"
    },
    {
      time: "This week",
      country: "South Korea",
      countryKo: "한국",
      countryEn: "South Korea",
      title: "Export and inflation data release",
      titleKo: "수출/물가 관련 지표 발표",
      titleEn: "Export and inflation data release",
      impact: "MEDIUM",
      impactKo: "중간",
      impactEn: "MEDIUM"
    },
    {
      time: "This week",
      country: "Europe",
      countryKo: "유럽",
      countryEn: "Europe",
      title: "Europe inflation and activity check",
      titleKo: "유럽 물가 및 경기지표 확인",
      titleEn: "Europe inflation and activity check",
      impact: "MEDIUM",
      impactKo: "중간",
      impactEn: "MEDIUM"
    }
  ];
}

function normalizeCountry(code: string) {
  const upper = (code || "").toUpperCase();
  if (upper.includes("USD") || upper === "US") return { ko: "미국", en: "United States" };
  if (upper.includes("EUR") || upper === "EU") return { ko: "유럽", en: "Europe" };
  if (upper.includes("JPY") || upper === "JP") return { ko: "일본", en: "Japan" };
  if (upper.includes("KRW") || upper === "KR") return { ko: "한국", en: "South Korea" };
  if (upper.includes("CNY") || upper === "CN") return { ko: "중국", en: "China" };
  return { ko: code || "기타", en: code || "Other" };
}

function normalizeImpact(value: string) {
  const upper = (value || "").toString().toUpperCase();
  if (upper.includes("HIGH") || value.includes("높")) {
    return { ko: "높음", en: "HIGH", raw: "HIGH" };
  }
  if (upper.includes("MEDIUM") || value.includes("중")) {
    return { ko: "중간", en: "MEDIUM", raw: "MEDIUM" };
  }
  return { ko: "낮음", en: "LOW", raw: "LOW" };
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
      .map((row) => {
        const country = normalizeCountry((row?.country || "").toString());
        const impact = normalizeImpact((row?.impact || "MEDIUM").toString());
        const titleEn = (row?.title || "Key economic event").toString();

        return {
          time: `${row?.date || ""} ${row?.time || ""}`.trim() || "TBD",
          country: country.en,
          countryKo: country.ko,
          countryEn: country.en,
          title: titleEn,
          titleKo: titleEn,
          titleEn,
          impact: impact.raw,
          impactKo: impact.ko,
          impactEn: impact.en
        };
      })
      .slice(0, 8);

    if (!items.length) {
      return NextResponse.json({ items: fallbackEvents(), source: "fallback" });
    }

    return NextResponse.json({ items, source: "live" });
  } catch {
    return NextResponse.json({ items: fallbackEvents(), source: "fallback" });
  }
}
