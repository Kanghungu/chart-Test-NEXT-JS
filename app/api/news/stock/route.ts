import { NextResponse } from "next/server";
import { fetchDeepsearchStockNews } from "@/lib/deepsearchStockNews";

export async function GET() {
  try {
    const data = await fetchDeepsearchStockNews();
    return NextResponse.json({ data });
  } catch {
    return NextResponse.json({ error: "Server error", data: [] }, { status: 500 });
  }
}
