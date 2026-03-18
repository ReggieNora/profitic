import { NextRequest, NextResponse } from "next/server";

/**
 * Pyth-only price API.
 *
 * GET /api/prices?ids=bitcoin,ethereum,solana
 *
 * Returns: { bitcoin: 84750.12, ethereum: 2185.50, ... }
 */

// ── Mapping between CoinGecko IDs and Pyth symbols ──

const COINGECKO_TO_SYMBOL: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
};

const PYTH_HERMES_URL = "https://hermes.pyth.network";

const PYTH_FEED_IDS: Record<string, string> = {
  BTC: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
};

// ── Cache (per-asset with individual TTLs) ──

const priceCache: Record<string, { price: number; ts: number }> = {};
const CACHE_TTL = 5_000; // 5 seconds — Pyth is fast, keep prices fresh

// ── Pyth price fetcher ──

async function fetchPythPrices(symbols: string[]): Promise<Record<string, number>> {
  const validSymbols = symbols.filter((s) => s in PYTH_FEED_IDS);
  if (validSymbols.length === 0) return {};

  try {
    const feedIds = validSymbols.map((s) => PYTH_FEED_IDS[s]);
    const idsParam = feedIds.map((id) => `ids[]=${id}`).join("&");
    const url = `${PYTH_HERMES_URL}/v2/updates/price/latest?${idsParam}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return {};

    const data = await res.json();
    const result: Record<string, number> = {};

    const feedToSymbol: Record<string, string> = {};
    for (const s of validSymbols) feedToSymbol[PYTH_FEED_IDS[s]] = s;

    if (Array.isArray(data?.parsed)) {
      for (const entry of data.parsed) {
        const sym = feedToSymbol[entry?.id];
        if (!sym || !entry?.price) continue;
        const price = Number(entry.price.price) * Math.pow(10, Number(entry.price.expo));
        if (price > 0) result[sym] = price;
      }
    }
    return result;
  } catch {
    return {};
  }
}

// ── Main handler ──

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get("ids") || "";

  if (!idsParam) {
    return NextResponse.json({ error: "Missing ids" }, { status: 400 });
  }

  const coingeckoIds = idsParam.split(",").map((s) => s.trim()).filter(Boolean);

  // Check if ALL requested IDs have fresh cache
  const now = Date.now();
  const allCached = coingeckoIds.every(
    (id) => priceCache[id] && now - priceCache[id].ts < CACHE_TTL
  );
  if (allCached && coingeckoIds.length > 0) {
    const cached: Record<string, number> = {};
    for (const id of coingeckoIds) cached[id] = priceCache[id].price;
    return NextResponse.json(cached);
  }

  // Only serve assets that have Pyth feeds
  const supportedIds = coingeckoIds.filter((id) => id in COINGECKO_TO_SYMBOL);
  const symbols = supportedIds.map((id) => COINGECKO_TO_SYMBOL[id]);

  const result: Record<string, number> = {};

  if (symbols.length > 0) {
    const pythPrices = await fetchPythPrices(symbols);

    // Map Pyth results back to CoinGecko IDs for consistent response format
    const symbolToId: Record<string, string> = {};
    for (const id of supportedIds) symbolToId[COINGECKO_TO_SYMBOL[id]] = id;

    for (const [sym, price] of Object.entries(pythPrices)) {
      result[symbolToId[sym]] = price;
    }
  }

  // Update per-asset cache
  const ts = Date.now();
  for (const [id, price] of Object.entries(result)) {
    priceCache[id] = { price, ts };
  }

  return NextResponse.json(result);
}
