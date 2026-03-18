/**
 * Token Discovery Service
 *
 * Discovers trending Pump.fun tokens via the CoinGecko API and provides
 * them alongside the three hardcoded primary assets (BTC, ETH, SOL).
 *
 * In production this would run server-side and cache aggressively.
 * For the MVP we fetch client-side with a 60-second cache.
 */

// ── Primary (always-on) assets ──

export interface TradingAsset {
  symbol: string;
  name: string;
  /** CoinGecko id for price lookups */
  coingeckoId: string;
  /** Pyth Network feed id (hex) – empty for pump.fun tokens */
  pythFeedId: string;
  /** Jupiter-compatible id (symbol or mint address) for price lookups */
  jupiterId?: string;
  /** Available binary intervals in seconds */
  intervals: number[];
  /** Whether this is a core asset or a trending pump.fun token */
  type: "core" | "pumpfun";
  /** Primary price source for this asset */
  priceSource: "pyth" | "jupiter";
  /** Color used in UI accents */
  color: string;
  /** Current USD price (populated at runtime) */
  price?: number;
  /** Logo URL from CoinGecko (for pump.fun tokens) */
  logoUrl?: string;
}

export const CORE_ASSETS: TradingAsset[] = [
  {
    symbol: "BTC",
    name: "Bitcoin",
    coingeckoId: "bitcoin",
    pythFeedId: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    intervals: [60, 300, 900], // 1m, 5m, 15m
    type: "core",
    priceSource: "pyth",
    color: "#F7931A",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    coingeckoId: "ethereum",
    pythFeedId: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    intervals: [60, 300, 900],
    type: "core",
    priceSource: "pyth",
    color: "#627EEA",
  },
  {
    symbol: "SOL",
    name: "Solana",
    coingeckoId: "solana",
    pythFeedId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    intervals: [60, 300, 900],
    type: "core",
    priceSource: "pyth",
    color: "#14F195",
  },
];

// ── Trending token discovery ──

interface CoinGeckoTrending {
  coins: {
    item: {
      id: string;
      coin_id: number;
      name: string;
      symbol: string;
      thumb: string;
      small: string;
      large: string;
      data?: {
        price?: number;
      };
    };
  }[];
}

// Known Pump.fun / Solana meme-token CoinGecko IDs for fallback
const PUMP_FUN_FALLBACKS: TradingAsset[] = [
  {
    symbol: "FROG",
    name: "Frog",
    coingeckoId: "frog-on-solana",
    pythFeedId: "",
    jupiterId: "FROG",
    intervals: [180], // 3m only
    type: "pumpfun",
    priceSource: "jupiter",
    color: "#4ADE80",
  },
  {
    symbol: "BONK",
    name: "Bonk",
    coingeckoId: "bonk",
    pythFeedId: "",
    jupiterId: "BONK",
    intervals: [180],
    type: "pumpfun",
    priceSource: "jupiter",
    color: "#FF9F43",
  },
  {
    symbol: "WIF",
    name: "dogwifhat",
    coingeckoId: "dogwifcoin",
    pythFeedId: "",
    jupiterId: "WIF",
    intervals: [180],
    type: "pumpfun",
    priceSource: "jupiter",
    color: "#C084FC",
  },
  {
    symbol: "POPCAT",
    name: "Popcat",
    coingeckoId: "popcat",
    pythFeedId: "",
    jupiterId: "POPCAT",
    intervals: [180],
    type: "pumpfun",
    priceSource: "jupiter",
    color: "#F472B6",
  },
];

// Module-level cache
let trendingCache: { assets: TradingAsset[]; timestamp: number } | null = null;
const TRENDING_CACHE_TTL = 60_000; // 60 seconds

/**
 * Fetch trending tokens from CoinGecko and filter for Solana / Pump.fun ecosystem.
 * Falls back to hardcoded popular meme tokens if the API is unavailable.
 */
export async function discoverTrendingTokens(count = 3): Promise<TradingAsset[]> {
  if (trendingCache && Date.now() - trendingCache.timestamp < TRENDING_CACHE_TTL) {
    return trendingCache.assets.slice(0, count);
  }

  try {
    const res = await fetch("/api/trending", {
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`CoinGecko trending: ${res.status}`);

    const data: CoinGeckoTrending = await res.json();

    // Filter for Solana ecosystem tokens (heuristic: skip BTC/ETH/SOL themselves)
    const coreIds = new Set(CORE_ASSETS.map((a) => a.coingeckoId));
    const trending = data.coins
      .filter((c) => !coreIds.has(c.item.id))
      .slice(0, count)
      .map((c): TradingAsset => ({
        symbol: c.item.symbol.toUpperCase(),
        name: c.item.name,
        coingeckoId: c.item.id,
        pythFeedId: "",
        jupiterId: c.item.symbol.toUpperCase(),
        intervals: [180], // 3-minute binaries only
        type: "pumpfun",
        priceSource: "jupiter",
        color: `hsl(${Math.floor(Math.random() * 360)}, 70%, 60%)`,
        logoUrl: c.item.large || c.item.small || c.item.thumb,
        price: c.item.data?.price,
      }));

    const result = trending.length > 0 ? trending : PUMP_FUN_FALLBACKS.slice(0, count);
    trendingCache = { assets: result, timestamp: Date.now() };
    return result;
  } catch {
    // Fallback to hardcoded tokens
    const result = PUMP_FUN_FALLBACKS.slice(0, count);
    trendingCache = { assets: result, timestamp: Date.now() };
    return result;
  }
}

/**
 * Returns the full list of tradeable assets: core + trending.
 */
export async function getAllTradingAssets(): Promise<TradingAsset[]> {
  const trending = await discoverTrendingTokens(3);
  return [...CORE_ASSETS, ...trending];
}

/**
 * Format interval seconds to human-readable label.
 */
export function formatInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m`;
}

/**
 * Fetch price for any asset by CoinGecko id.
 */
const assetPriceCache: Record<string, { price: number; ts: number }> = {};
const PRICE_CACHE_TTL = 10_000; // keep client prices fresh


/**
 * Fetch historical price chart via server-side proxy (/api/chart) to avoid
 * browser CORS issues and CoinGecko rate-limiting.
 */
const chartCache: Record<string, { data: { time: number; price: number }[]; ts: number }> = {};
const CHART_CACHE_TTL = 60_000;

// No fallback prices or synthetic charts — all data comes from Pyth/real APIs

function parseChartResponse(data: { prices?: [number, number][] }): { time: number; price: number }[] {
  const prices: [number, number][] = data?.prices || [];
  return prices.map(([ts, price]) => ({ time: ts, price }));
}

/**
 * Fetch a daily (24h) chart for an asset via the server-side proxy.
 * Falls back to synthetic data if the API is unavailable.
 */
export async function fetchDailyChart(
  coingeckoId: string
): Promise<{ time: number; price: number }[]> {
  const cacheKey = `daily-${coingeckoId}`;
  const cached = chartCache[cacheKey];
  if (cached && Date.now() - cached.ts < CHART_CACHE_TTL) {
    return cached.data;
  }

  // Try server-side proxy first
  try {
    const res = await fetch(
      `/api/chart?id=${encodeURIComponent(coingeckoId)}&days=1`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (res.ok) {
      const data = await res.json();
      const result = parseChartResponse(data);
      if (result.length > 0) {
        chartCache[cacheKey] = { data: result, ts: Date.now() };
        return result;
      }
    }
  } catch {
    // fallback below
  }

  // No synthetic fallback — return empty array if chart API is unavailable
  return [];
}

/**
 * Fetch price chart for a specific time range.
 * Falls back to filtering the daily chart data, then to synthetic data.
 */
export async function fetchPriceChart(
  coingeckoId: string,
  fromTimestamp: number,
  toTimestamp: number
): Promise<{ time: number; price: number }[]> {
  const cacheKey = `${coingeckoId}-${fromTimestamp}-${toTimestamp}`;
  const cached = chartCache[cacheKey];
  if (cached && Date.now() - cached.ts < CHART_CACHE_TTL) {
    return cached.data;
  }

  // Try server-side proxy with range
  try {
    const res = await fetch(
      `/api/chart?id=${encodeURIComponent(coingeckoId)}&from=${fromTimestamp}&to=${toTimestamp}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (res.ok) {
      const data = await res.json();
      const result = parseChartResponse(data);
      if (result.length > 0) {
        chartCache[cacheKey] = { data: result, ts: Date.now() };
        return result;
      }
    }
  } catch {
    // fallback below
  }

  // Fallback: use daily chart data filtered to the time range
  const daily = await fetchDailyChart(coingeckoId);
  const fromMs = fromTimestamp * 1000;
  const toMs = toTimestamp * 1000;
  const result = daily.filter((p) => p.time >= fromMs && p.time <= toMs);
  if (result.length > 0) {
    chartCache[cacheKey] = { data: result, ts: Date.now() };
    return result;
  }

  // If filtered range is empty, return the full daily data
  return daily;
}

/**
 * Fetch price for a Solana token via /api/prices (Pyth only).
 */
export async function fetchJupiterPrice(symbolOrMint: string): Promise<number> {
  // Route through /api/prices (Pyth → CoinCap → CoinGecko) instead of Jupiter
  return fetchAssetPrice(symbolOrMint.toLowerCase());
}

/**
 * Fetch price for an asset via /api/prices (Pyth only for core assets).
 */
export async function fetchAssetPrice(coingeckoId: string): Promise<number> {
  const cached = assetPriceCache[coingeckoId];
  if (cached && Date.now() - cached.ts < PRICE_CACHE_TTL) {
    return cached.price;
  }

  // Use server-side proxy (Pyth only)
  try {
    const res = await fetch(
      `/api/prices?ids=${encodeURIComponent(coingeckoId)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const data = await res.json();
      const price = data?.[coingeckoId];
      if (typeof price === "number" && price > 0) {
        assetPriceCache[coingeckoId] = { price, ts: Date.now() };
        return price;
      }
    }
  } catch {
    // use cache if available
  }
  return cached?.price || 0;
}

/**
 * Fetch prices for multiple assets in a single batched request.
 * All assets go through /api/prices (Pyth only).
 * The jupiterSymbols parameter is accepted for backward compatibility
 * but those symbols are now also routed through /api/prices by CoinGecko ID.
 */
export async function fetchAssetPrices(
  coingeckoIds: string[],
  jupiterSymbols: string[] = []
): Promise<Record<string, number>> {
  const result: Record<string, number> = {};
  const toFetch: string[] = [];

  // Combine all IDs — route everything through /api/prices
  const allIds = [...coingeckoIds];
  // Jupiter symbols are now fetched by their lowercase name via /api/prices
  for (const sym of jupiterSymbols) {
    allIds.push(sym.toLowerCase());
  }

  for (const id of allIds) {
    const cached = assetPriceCache[id];
    if (cached && Date.now() - cached.ts < PRICE_CACHE_TTL) {
      result[id] = cached.price;
    } else {
      toFetch.push(id);
    }
  }

  if (toFetch.length > 0) {
    try {
      const res = await fetch(
        `/api/prices?ids=${encodeURIComponent(toFetch.join(","))}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const data = await res.json();
        for (const [id, price] of Object.entries(data as Record<string, number>)) {
          if (typeof price === "number" && price > 0) {
            assetPriceCache[id] = { price, ts: Date.now() };
            result[id] = price;
          }
        }
      }
    } catch {
      // use cached values
    }
  }

  // Map Jupiter symbol results back so callers can find them by symbol
  for (const sym of jupiterSymbols) {
    const lowerKey = sym.toLowerCase();
    if (result[lowerKey] && !result[sym]) {
      result[sym] = result[lowerKey];
    }
  }

  return result;
}
