import { createHash } from "crypto";
import { EventImpact, Prisma, SignalTone } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type FairCalendarRow = {
  date?: string;
  time?: string;
  country?: string;
  impact?: string;
  title?: string;
};

const FAIR_CALENDAR_URL = "https://nfs.faireconomy.media/ff_calendar_thisweek.json";

function slugifyExternalId(row: FairCalendarRow) {
  const raw = `${row.date || ""}|${row.time || ""}|${(row.title || "").slice(0, 120)}`;
  const hash = createHash("sha1").update(raw).digest("hex").slice(0, 24);
  return `fair-${hash}`;
}

function mapImpact(value: string | undefined): EventImpact {
  const upper = (value || "").toUpperCase();
  if (upper.includes("HIGH") || value?.includes("높")) return EventImpact.HIGH;
  if (upper.includes("LOW") || value?.includes("낮")) return EventImpact.LOW;
  return EventImpact.MEDIUM;
}

function mapCountryCode(code: string) {
  const upper = code.toUpperCase();
  if (upper.includes("USD") || upper === "US") return { country: "United States", code: "US" };
  if (upper.includes("EUR") || upper === "EU") return { country: "Europe", code: "EU" };
  if (upper.includes("JPY") || upper === "JP") return { country: "Japan", code: "JP" };
  if (upper.includes("KRW") || upper === "KR") return { country: "South Korea", code: "KR" };
  if (upper.includes("CNY") || upper === "CN") return { country: "China", code: "CN" };
  return { country: code || "Global", code: upper.slice(0, 3) || "XX" };
}

function parseStartsAt(row: FairCalendarRow): Date | null {
  const datePart = (row.date || "").trim();
  const timePart = (row.time || "").trim();
  if (!datePart) return null;

  const combined = `${datePart} ${timePart}`.trim();
  const parsed = new Date(combined);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** 외부 거시 캘린더 → EconomicEvent 적재 */
export async function ingestEconomicEventsFromFairCalendar(): Promise<{ upserted: number }> {
  const res = await fetch(FAIR_CALENDAR_URL, { cache: "no-store" });

  if (!res.ok) {
    throw new Error(`Fair calendar fetch failed: ${res.status}`);
  }

  const json = (await res.json()) as FairCalendarRow[];
  const rows = Array.isArray(json) ? json : [];

  let upserted = 0;

  for (const row of rows) {
    const countryRaw = (row.country || "").toString();
    if (!["USD", "EUR", "JPY", "KRW", "CNY"].includes(countryRaw.toUpperCase())) {
      continue;
    }

    const externalId = slugifyExternalId(row);
    const { country, code } = mapCountryCode(countryRaw);
    const impact = mapImpact(row.impact?.toString());
    const title = (row.title || "Economic event").toString().slice(0, 500);
    const startsAt = parseStartsAt(row);
    const displayTime = `${row.date || ""} ${row.time || ""}`.trim() || null;

    await prisma.economicEvent.upsert({
      where: { externalId },
      update: {
        title,
        country,
        countryCode: code,
        impact,
        startsAt,
        displayTime,
        source: "fair-calendar"
      },
      create: {
        externalId,
        title,
        country,
        countryCode: code,
        impact,
        startsAt,
        displayTime,
        source: "fair-calendar"
      }
    });

    upserted += 1;
  }

  return { upserted };
}

/** 하루 1회 자동 브리핑 스텁 (DB가 비었을 때 홈 카드용) */
export async function ingestDailyBriefingStub(): Promise<{ created: boolean }> {
  const dayKey = new Date().toISOString().slice(0, 10);
  const externalId = `auto-briefing-${dayKey}`;

  const existing = await prisma.briefing.findUnique({ where: { externalId } });
  if (existing) {
    return { created: false };
  }

  await prisma.briefing.create({
    data: {
      externalId,
      title: "오늘의 시장 체크리스트",
      prompt: "자동 생성된 데일리 브리핑입니다.",
      summary:
        "거시 캘린더와 주요 지수 흐름을 함께 확인하세요. 한국장·미국장 세션과 변동성 지표를 병행해 리스크를 관리하는 것이 좋습니다.",
      marketView:
        "이 브리핑은 크론 잡으로 주기적으로 채워집니다. 운영 환경에서 `CRON_SECRET`으로 보호된 ingest 엔드포인트를 설정해 주세요.",
      publishedAt: new Date()
    }
  });

  return { created: true };
}

/** 최근 시그널이 없을 때 중립 시그널 1건 보강 */
export async function ingestNeutralSignalIfQuiet(): Promise<{ created: boolean }> {
  const since = new Date(Date.now() - 1000 * 60 * 60 * 18);

  const recent = await prisma.marketSignal.count({
    where: { signalDate: { gte: since } }
  });

  if (recent > 0) {
    return { created: false };
  }

  const dayKey = new Date().toISOString().slice(0, 10);
  const externalId = `auto-signal-${dayKey}`;

  const existing = await prisma.marketSignal.findUnique({ where: { externalId } });
  if (existing) {
    return { created: false };
  }

  await prisma.marketSignal.create({
    data: {
      externalId,
      title: "시장 시그널 대기",
      summary:
        "최근 강한 단일 시그널이 없습니다. 지수·거시 레일·뉴스 헤드라인을 함께 보며 변동성 이벤트 전후 포지션을 점검해 보세요.",
      tone: SignalTone.NEUTRAL,
      source: "auto-ingest",
      signalDate: new Date()
    }
  });

  return { created: true };
}

export type IngestSummary = {
  economicEvents: { upserted: number };
  briefing: { created: boolean };
  signal: { created: boolean };
};

/** 크론·스크립트에서 한 번에 실행 */
export async function runDashboardIngest(): Promise<IngestSummary> {
  let economicEvents = { upserted: 0 as number };

  try {
    economicEvents = await ingestEconomicEventsFromFairCalendar();
  } catch (error) {
    console.error("[ingest] economic events failed", error);
  }

  const briefing = await ingestDailyBriefingStub();
  const signal = await ingestNeutralSignalIfQuiet();

  return { economicEvents, briefing, signal };
}

export function formatIngestError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return `Prisma ${error.code}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown ingest error";
}
