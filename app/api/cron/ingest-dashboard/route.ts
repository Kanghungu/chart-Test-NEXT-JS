import { NextResponse } from "next/server";
import { formatIngestError, runDashboardIngest } from "@/lib/dashboardIngest";

/**
 * Vercel Cron 등에서 호출: 경제 일정·브리핑 스텁·중립 시그널 적재
 * 환경 변수 `CRON_SECRET` 설정 후 `Authorization: Bearer <secret>` 또는 `x-cron-secret` 헤더로 보호합니다.
 */
export async function GET(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization") || "";
  const bearerToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const headerSecret = request.headers.get("x-cron-secret");

  if (!expectedSecret || (bearerToken !== expectedSecret && headerSecret !== expectedSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDashboardIngest();
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    return NextResponse.json({ ok: false, error: formatIngestError(error) }, { status: 500 });
  }
}
