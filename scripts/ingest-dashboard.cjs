/**
 * 로컬/CI에서 수동으로 대시보드 ingest 실행
 * 사용법:
 *   CRON_SECRET=... INGEST_URL=https://guguchart.vercel.app node scripts/ingest-dashboard.cjs
 */

async function main() {
  const baseUrl = process.env.INGEST_URL?.replace(/\/$/, "");
  const cronSecret = process.env.CRON_SECRET;

  if (!baseUrl) {
    console.error("INGEST_URL 환경 변수를 설정하세요. 예: https://guguchart.vercel.app");
    process.exit(1);
  }

  if (!cronSecret) {
    console.error("CRON_SECRET 환경 변수를 설정하세요.");
    process.exit(1);
  }

  const targetUrl = `${baseUrl}/api/cron/ingest-dashboard`;
  const response = await fetch(targetUrl, {
    headers: {
      Authorization: `Bearer ${cronSecret}`
    }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error("ingest 실패", response.status, payload);
    process.exit(1);
  }

  console.log("ingest 완료", JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
