import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for Jupiter Price API.
 * Fetches prices for any Solana token (including pump.fun tokens).
 *
 * GET /api/jupiter-price?ids=SOL,BONK,So11111111111111111111111111111111
 *
 * Accepts token symbols or mint addresses (comma-separated).
 * Jupiter Price API: https://price.jup.ag/v6/price
 */

let cache: { data: Record<string, number>; ts: number } | null = null;
const CACHE_TTL = 15_000; // 15 seconds — Jupiter is generous with rate limits

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids") || "";
  if (!ids) {
    return NextResponse.json({ error: "Missing ids" }, { status: 400 });
  }

  // Return cache if fresh and all requested ids are present
  const idList = ids.split(",").map((s) => s.trim()).filter(Boolean);
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    const allCached = idList.every((id) => id in cache!.data);
    if (allCached) {
      return NextResponse.json(cache.data);
    }
  }

  try {
    const url = `https://price.jup.ag/v6/price?ids=${encodeURIComponent(ids)}&vsToken=USDC`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      if (cache) return NextResponse.json(cache.data);
      return NextResponse.json(
        { error: `Jupiter returned ${res.status}` },
        { status: res.status }
      );
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

    return NextResponse.json(prices);
  } catch {
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({ error: "Jupiter fetch failed" }, { status: 502 });
  }
}
