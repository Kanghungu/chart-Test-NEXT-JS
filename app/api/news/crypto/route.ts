import { NextResponse } from "next/server";

export async function GET() {
    const res = await fetch(
        "https://cryptopanic.com/api/developer/v2/posts/?auth_token=ad3d65ed53699656e4f6ff88e5210a357cb25dff&regions=ko",
        { cache: "no-store" } // 캐싱 방지
    );

    if (!res.ok) {
        return NextResponse.json(
            { error: "CryptoPanic API 호출 실패" },
            { status: res.status }
        );
    }

    const json = await res.json();
    return NextResponse.json(json);
}