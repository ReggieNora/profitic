import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for CoinGecko price API.
 * Batches multiple asset IDs into a single CoinGecko call.
 * Returns stale cache on any failure to avoid 502 floods.
 *
 * GET /api/prices?ids=bitcoin,ethereum,solana
 */

let cache: { data: Record<string, number>; ts: number } | null = null;
const CACHE_TTL = 30_000; // 30 seconds — CoinGecko free tier allows ~10-30 req/min

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids") || "";
  if (!ids) {
    return NextResponse.json({ error: "Missing ids" }, { status: 400 });
  }

  // Return cache if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd`,
      {
        signal: AbortSignal.timeout(10000),
        headers: { Accept: "application/json" },
      }
    );

    if (!res.ok) {
      // Return stale cache on rate-limit or any error
      if (cache) {
        return NextResponse.json(cache.data);
      }
      return NextResponse.json(
        { error: `CoinGecko returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Flatten to { id: price } map
    const prices: Record<string, number> = {};
    for (const [id, val] of Object.entries(data)) {
      const v = val as { usd?: number };
      if (typeof v?.usd === "number") {
        prices[id] = v.usd;
      }
    }

    cache = { data: prices, ts: Date.now() };
    return NextResponse.json(prices);
  } catch {
    // Return stale cache on network error
    if (cache) {
      return NextResponse.json(cache.data);
    }
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }
}
