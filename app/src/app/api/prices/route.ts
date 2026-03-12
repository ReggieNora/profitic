import { NextRequest, NextResponse } from "next/server";

/**
 * Hybrid price API — cascading price sources for reliability.
 *
 * Core assets (BTC, ETH, SOL): Pyth Network → CoinCap → CoinGecko
 * Meme/pump.fun tokens:        Jupiter Price API → CoinGecko
 *
 * GET /api/prices?ids=bitcoin,ethereum,solana
 * GET /api/prices?ids=bitcoin,ethereum&symbols=BONK,WIF  (Jupiter symbols)
 * GET /api/prices?ids=bitcoin&mints=So111...              (Jupiter mints)
 *
 * Returns: { bitcoin: 84750.12, ethereum: 2185.50, BONK: 0.000015, ... }
 */

// ── Mapping between CoinGecko IDs, CoinCap IDs, and asset symbols ──

const COINGECKO_TO_SYMBOL: Record<string, string> = {
  bitcoin: "BTC",
  ethereum: "ETH",
  solana: "SOL",
};

const COINGECKO_TO_COINCAP: Record<string, string> = {
  bitcoin: "bitcoin",
  ethereum: "ethereum",
  solana: "solana",
};

const PYTH_HERMES_URL = "https://hermes.pyth.network";

const PYTH_FEED_IDS: Record<string, string> = {
  BTC: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
};

// ── Cache ──

let cache: { data: Record<string, number>; ts: number } | null = null;
const CACHE_TTL = 10_000; // 10 seconds

// ── Price source fetchers ──

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

async function fetchCoinCapPrices(coincapIds: string[]): Promise<Record<string, number>> {
  if (coincapIds.length === 0) return {};
  try {
    const url = `https://api.coincap.io/v2/assets?ids=${encodeURIComponent(coincapIds.join(","))}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return {};

    const data = await res.json();
    const result: Record<string, number> = {};
    if (Array.isArray(data?.data)) {
      for (const asset of data.data) {
        const price = parseFloat(asset.priceUsd);
        if (asset.id && !isNaN(price) && price > 0) result[asset.id] = price;
      }
    }
    return result;
  } catch {
    return {};
  }
}

async function fetchCoinGeckoPrices(ids: string[]): Promise<Record<string, number>> {
  if (ids.length === 0) return {};
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${encodeURIComponent(ids.join(","))}&vs_currencies=usd`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return {};

    const data = await res.json();
    const result: Record<string, number> = {};
    for (const [id, val] of Object.entries(data)) {
      const v = val as { usd?: number };
      if (typeof v?.usd === "number") result[id] = v.usd;
    }
    return result;
  } catch {
    return {};
  }
}

async function fetchJupiterPrices(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};
  try {
    const url = `https://price.jup.ag/v6/price?ids=${encodeURIComponent(symbols.join(","))}&vsToken=USDC`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return {};

    const data = await res.json();
    const result: Record<string, number> = {};
    if (data?.data) {
      for (const [id, info] of Object.entries(data.data)) {
        const p = (info as { price?: number })?.price;
        if (typeof p === "number" && p > 0) result[id] = p;
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
  const symbolsParam = req.nextUrl.searchParams.get("symbols") || "";
  const mintsParam = req.nextUrl.searchParams.get("mints") || "";

  if (!idsParam && !symbolsParam && !mintsParam) {
    return NextResponse.json({ error: "Missing ids, symbols, or mints" }, { status: 400 });
  }

  // Return cache if fresh
  if (cache && Date.now() - cache.ts < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  const coingeckoIds = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const jupiterSymbols = symbolsParam ? symbolsParam.split(",").map((s) => s.trim()).filter(Boolean) : [];
  const jupiterMints = mintsParam ? mintsParam.split(",").map((s) => s.trim()).filter(Boolean) : [];

  // Separate core vs non-core CoinGecko IDs
  const coreIds = coingeckoIds.filter((id) => id in COINGECKO_TO_SYMBOL);
  const nonCoreIds = coingeckoIds.filter((id) => !(id in COINGECKO_TO_SYMBOL));
  const coreSymbols = coreIds.map((id) => COINGECKO_TO_SYMBOL[id]);

  const result: Record<string, number> = {};

  // 1. Core assets: Pyth → CoinCap → CoinGecko cascade
  if (coreIds.length > 0) {
    // Try Pyth first (fastest, on-chain)
    const pythPrices = await fetchPythPrices(coreSymbols);

    // Map Pyth results back to CoinGecko IDs for consistent response format
    const symbolToId: Record<string, string> = {};
    for (const id of coreIds) symbolToId[COINGECKO_TO_SYMBOL[id]] = id;

    for (const [sym, price] of Object.entries(pythPrices)) {
      result[symbolToId[sym]] = price;
    }

    // Find missing core assets
    const missingCoreIds = coreIds.filter((id) => !(id in result));

    if (missingCoreIds.length > 0) {
      // Try CoinCap for missing
      const coincapIds = missingCoreIds
        .map((id) => COINGECKO_TO_COINCAP[id])
        .filter(Boolean);
      const coincapPrices = await fetchCoinCapPrices(coincapIds);

      // Map CoinCap results back to CoinGecko IDs
      for (const id of missingCoreIds) {
        const coincapId = COINGECKO_TO_COINCAP[id];
        if (coincapId && coincapPrices[coincapId]) {
          result[id] = coincapPrices[coincapId];
        }
      }

      // Still missing? Fall back to CoinGecko
      const stillMissing = missingCoreIds.filter((id) => !(id in result));
      if (stillMissing.length > 0) {
        const cgPrices = await fetchCoinGeckoPrices(stillMissing);
        Object.assign(result, cgPrices);
      }
    }
  }

  // 2. Non-core CoinGecko IDs: Jupiter (by symbol) → CoinGecko
  if (nonCoreIds.length > 0) {
    // Try CoinGecko first for non-core (they have coingeckoIds)
    const cgPrices = await fetchCoinGeckoPrices(nonCoreIds);
    Object.assign(result, cgPrices);
  }

  // 3. Jupiter symbols (for pump.fun / meme tokens without CoinGecko IDs)
  const allJupiterIds = [...jupiterSymbols, ...jupiterMints];
  if (allJupiterIds.length > 0) {
    const jupPrices = await fetchJupiterPrices(allJupiterIds);
    Object.assign(result, jupPrices);
  }

  // Update cache
  cache = { data: { ...(cache?.data || {}), ...result }, ts: Date.now() };

  return NextResponse.json(result);
}
