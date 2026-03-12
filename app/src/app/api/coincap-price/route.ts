import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for CoinCap API.
 * Fallback price source for core assets when Pyth is unavailable.
 *
 * GET /api/coincap-price?ids=bitcoin,ethereum,solana
 *
 * CoinCap uses its own IDs (same as CoinGecko for the majors).
 * Returns: { bitcoin: 84750.12, ethereum: 2185.50, solana: 128.30 }
 */

let cache: { data: Record<string, number>; ts: number } | null = null;
const CACHE_TTL = 15_000; // 15 seconds

export async function GET(req: NextRequest) {
  const ids = req.nextUrl.searchParams.get("ids") || "";
  if (!ids) {
    return NextResponse.json({ error: "Missing ids" }, { status: 400 });
  }

  // Return cache if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    const idList = ids.split(",").map((s) => s.trim());
    const allCached = idList.every((id) => id in cache!.data);
    if (allCached) {
      return NextResponse.json(cache.data);
    }
  }

  try {
    // CoinCap v2 assets endpoint — fetch each asset
    const idList = ids.split(",").map((s) => s.trim()).filter(Boolean);
    const prices: Record<string, number> = {};

    // CoinCap allows fetching multiple assets by querying the /assets endpoint with ids
    const url = `https://api.coincap.io/v2/assets?ids=${encodeURIComponent(idList.join(","))}`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      if (cache) return NextResponse.json(cache.data);
      return NextResponse.json(
        { error: `CoinCap returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    if (Array.isArray(data?.data)) {
      for (const asset of data.data) {
        const price = parseFloat(asset.priceUsd);
        if (asset.id && !isNaN(price) && price > 0) {
          prices[asset.id] = price;
        }
      }
    }

    cache = {
      data: { ...(cache?.data || {}), ...prices },
      ts: Date.now(),
    };

    return NextResponse.json(prices);
  } catch {
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({ error: "CoinCap fetch failed" }, { status: 502 });
  }
}
