import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for Jupiter Price API.
 * Fetches prices for any Solana token (including pump.fun tokens).
 *
 * GET /api/jupiter-price?ids=SOL,BONK,So11111111111111111111111111111111
 *
 * Returns stale cache on any failure to prevent 502 floods.
 */

let cache: { data: Record<string, number>; ts: number } | null = null;
const CACHE_TTL = 30_000; // 30 seconds — avoid hammering Jupiter

// Track consecutive failures to implement backoff
let lastFailure = 0;
const FAILURE_BACKOFF = 60_000; // Wait 60s after a failure before retrying Jupiter

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids") || "";
  if (!ids) {
    return NextResponse.json({ error: "Missing ids" }, { status: 400 });
  }

  // Return cache if fresh (don't require ALL ids to be present — partial is fine)
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  // If Jupiter recently failed, return stale cache or empty rather than retrying
  if (lastFailure && Date.now() - lastFailure < FAILURE_BACKOFF) {
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({});
  }

  try {
    const url = `https://price.jup.ag/v6/price?ids=${encodeURIComponent(ids)}&vsToken=USDC`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      lastFailure = Date.now();
      if (cache) return NextResponse.json(cache.data);
      return NextResponse.json({});
    }

    const data = await res.json();

    // Jupiter returns { data: { [id]: { id, mintSymbol, vsToken, vsTokenSymbol, price } } }
    const prices: Record<string, number> = {};
    if (data?.data) {
      for (const [id, info] of Object.entries(data.data)) {
        const p = (info as { price?: number })?.price;
        if (typeof p === "number" && p > 0) {
          prices[id] = p;
        }
      }
    }

    // Merge with existing cache
    cache = {
      data: { ...(cache?.data || {}), ...prices },
      ts: Date.now(),
    };
    lastFailure = 0; // Reset on success

    return NextResponse.json(prices);
  } catch {
    lastFailure = Date.now();
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({});
  }
}
