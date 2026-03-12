import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for CoinGecko chart API.
 * Avoids browser CORS issues and rate-limiting on the free tier.
 *
 * GET /api/chart?id=bitcoin&days=1
 * GET /api/chart?id=bitcoin&from=123&to=456
 */

const cache: Record<string, { data: unknown; ts: number }> = {};
const CACHE_TTL = 60_000; // 1 minute

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const id = searchParams.get("id");
  const days = searchParams.get("days");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let url: string;
  let cacheKey: string;

  if (from && to) {
    url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
    cacheKey = `range-${id}-${from}-${to}`;
  } else {
    const d = days || "1";
    url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(id)}/market_chart?vs_currency=usd&days=${d}`;
    cacheKey = `days-${id}-${d}`;
  }

  // Check server-side cache
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json(cached.data);
  }

  try {
    const res = await fetch(url, {
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
    cache[cacheKey] = { data, ts: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Fetch failed" },
      { status: 502 }
    );
  }
}
