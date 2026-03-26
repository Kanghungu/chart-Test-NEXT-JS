import { NextResponse } from "next/server";

const BASE_URL = "https://cryptopanic.com/api/developer/v2/posts/";
const AUTH_TOKEN = "ad3d65ed53699656e4f6ff88e5210a357cb25dff";

async function fetchCryptoNews(region?: string) {
  const params = new URLSearchParams({ auth_token: AUTH_TOKEN });
  if (region) params.set("regions", region);

  const res = await fetch(`${BASE_URL}?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`CryptoPanic request failed: ${res.status}`);
  }

  return res.json();
}

export async function GET() {
  try {
    const regional = await fetchCryptoNews("ko");
    if (Array.isArray(regional?.results) && regional.results.length > 0) {
      return NextResponse.json(regional);
    }

    const fallback = await fetchCryptoNews();
    return NextResponse.json(fallback);
  } catch {
    return NextResponse.json({ error: "Failed to load crypto news", results: [] }, { status: 502 });
  }
}
