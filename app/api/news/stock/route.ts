import { NextResponse } from "next/server";

export async function GET() {
    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 7);
    const toDate = new Date();

    const url = `https://api-v2.deepsearch.com/v1/global-articles?api_key=bec00d2364fa444b9cdb342e731f73d8`;

    try {
        const res = await fetch(url, { cache: "no-store" });

        if (!res.ok) {
            console.error("딥서치 API 호출 실패:", res.status, res.statusText);
            return NextResponse.json({ error: "Finnhub API 호출 실패" }, { status: res.status });
        }

        const json = await res.json();
        console.log("딥서치 API 호출 성공, 데이터 수:", json.total_items); // 성공 로그
        return NextResponse.json(json);
    } catch (err) {
        console.error("딥서치 API 호출 중 오류 발생:", err);
        return NextResponse.json({ error: "서버 오류" }, { status: 500 });
    }
}