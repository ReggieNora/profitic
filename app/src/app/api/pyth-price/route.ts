import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side proxy for Pyth Network Hermes API.
 * Fetches real-time prices for core assets (BTC, ETH, SOL).
 *
 * GET /api/pyth-price?assets=BTC,ETH,SOL
 *
 * Returns: { BTC: 84750.12, ETH: 2185.50, SOL: 128.30 }
 */

const PYTH_HERMES_URL = "https://hermes.pyth.network";

const PYTH_FEED_IDS: Record<string, string> = {
  BTC: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
};

interface PythPriceData {
  price: number;
  confidence: number;
  timestamp: number;
}

let cache: { data: Record<string, PythPriceData>; ts: number } | null = null;
const CACHE_TTL = 5_000; // 5 seconds — Pyth is real-time, keep it fresh

export async function GET(req: NextRequest) {
  const assetsParam = req.nextUrl.searchParams.get("assets") || "BTC,ETH,SOL";
  const assets = assetsParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((a) => a in PYTH_FEED_IDS);

  if (assets.length === 0) {
    return NextResponse.json({ error: "No valid assets" }, { status: 400 });
  }

  // Return cache if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    const result: Record<string, number> = {};
    for (const a of assets) {
      if (cache.data[a]) result[a] = cache.data[a].price;
    }
    if (Object.keys(result).length === assets.length) {
      return NextResponse.json(result);
    }
  }

  try {
    // Batch all feed IDs into one request
    const feedIds = assets.map((a) => PYTH_FEED_IDS[a]);
    const idsParam = feedIds.map((id) => `ids[]=${id}`).join("&");
    const url = `${PYTH_HERMES_URL}/v2/updates/price/latest?${idsParam}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      if (cache) {
        const result: Record<string, number> = {};
        for (const a of assets) {
          if (cache.data[a]) result[a] = cache.data[a].price;
        }
        return NextResponse.json(result);
      }
      return NextResponse.json(
        { error: `Pyth returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    const parsed: Record<string, PythPriceData> = {};
    const result: Record<string, number> = {};

    // Map feed IDs back to asset symbols
    const feedToAsset: Record<string, string> = {};
    for (const a of assets) {
      feedToAsset[PYTH_FEED_IDS[a]] = a;
    }

    if (Array.isArray(data?.parsed)) {
      for (const entry of data.parsed) {
        const feedId = entry?.id;
        const asset = feedToAsset[feedId];
        if (!asset || !entry?.price) continue;

        const priceVal = Number(entry.price.price);
        const expo = Number(entry.price.expo);
        const conf = Number(entry.price.conf);
        const publishTime = Number(entry.price.publish_time);

        const price = priceVal * Math.pow(10, expo);
        const confidence = conf * Math.pow(10, expo);

        parsed[asset] = { price, confidence, timestamp: publishTime };
        result[asset] = price;
      }
    }

    cache = {
      data: { ...(cache?.data || {}), ...parsed },
      ts: Date.now(),
    };

    return NextResponse.json(result);
  } catch {
    if (cache) {
      const result: Record<string, number> = {};
      for (const a of assets) {
        if (cache.data[a]) result[a] = cache.data[a].price;
      }
      return NextResponse.json(result);
    }
    return NextResponse.json({ error: "Pyth fetch failed" }, { status: 502 });
  }
}
