import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for CoinGecko price API.
 * Batches multiple asset IDs into a single CoinGecko call.
 *
 * GET /api/prices?ids=bitcoin,ethereum,solana
 */

let cache: { data: Record<string, number>; ts: number } | null = null;
const CACHE_TTL = 15_000; // 15 seconds
let lastIds = "";

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids") || "";
  if (!ids) {
    return NextResponse.json({ error: "Missing ids" }, { status: 400 });
  }

  // Return cache if same ids and fresh
  if (cache && ids === lastIds && Date.now() - cache.ts < CACHE_TTL) {
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
    lastIds = ids;
    return NextResponse.json(prices);
  } catch (err) {
    // Return stale cache if available
    if (cache) {
      return NextResponse.json(cache.data);
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 502 }
    );
  }
}
