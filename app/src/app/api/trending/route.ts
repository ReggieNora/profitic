import { NextResponse } from "next/server";

/**
 * Server-side proxy for CoinGecko trending endpoint.
 * GET /api/trending
 */

let cache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 120_000; // 2 minutes

export async function GET() {
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch("https://api.coingecko.com/api/v3/search/trending", {
      signal: AbortSignal.timeout(10000),
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `CoinGecko returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    cache = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    if (cache) {
      return NextResponse.json(cache.data);
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 502 }
    );
  }
}
