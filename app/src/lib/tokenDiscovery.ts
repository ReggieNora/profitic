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
  /** Available binary intervals in seconds */
  intervals: number[];
  /** Whether this is a core asset or a trending pump.fun token */
  type: "core" | "pumpfun";
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
    color: "#F7931A",
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    coingeckoId: "ethereum",
    pythFeedId: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    intervals: [60, 300, 900],
    type: "core",
    color: "#627EEA",
  },
  {
    symbol: "SOL",
    name: "Solana",
    coingeckoId: "solana",
    pythFeedId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    intervals: [60, 300, 900],
    type: "core",
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
    intervals: [180], // 3m only
    type: "pumpfun",
    color: "#4ADE80",
  },
  {
    symbol: "BONK",
    name: "Bonk",
    coingeckoId: "bonk",
    pythFeedId: "",
    intervals: [180],
    type: "pumpfun",
    color: "#FF9F43",
  },
  {
    symbol: "WIF",
    name: "dogwifhat",
    coingeckoId: "dogwifcoin",
    pythFeedId: "",
    intervals: [180],
    type: "pumpfun",
    color: "#C084FC",
  },
  {
    symbol: "POPCAT",
    name: "Popcat",
    coingeckoId: "popcat",
    pythFeedId: "",
    intervals: [180],
    type: "pumpfun",
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
    const res = await fetch("https://api.coingecko.com/api/v3/search/trending", {
      signal: AbortSignal.timeout(5000),
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
        intervals: [180], // 3-minute binaries only
        type: "pumpfun",
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
const PRICE_CACHE_TTL = 10_000;

/**
 * Fetch historical price chart from CoinGecko.
 */
const chartCache: Record<string, { data: { time: number; price: number }[]; ts: number }> = {};
const CHART_CACHE_TTL = 60_000;

/**
 * Fetch a daily (24h) chart for an asset. Uses the simple /market_chart?days=1 endpoint.
 * Returns all data points unfiltered — ~288 points at 5-min granularity.
 */
export async function fetchDailyChart(
  coingeckoId: string
): Promise<{ time: number; price: number }[]> {
  const cacheKey = `daily-${coingeckoId}`;
  const cached = chartCache[cacheKey];
  if (cached && Date.now() - cached.ts < CHART_CACHE_TTL) {
    return cached.data;
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart?vs_currency=usd&days=1`,
      { signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) throw new Error(`CoinGecko chart: ${res.status}`);

    const data = await res.json();
    const prices: [number, number][] = data?.prices || [];
    const result = prices.map(([ts, price]) => ({ time: ts, price }));

    if (result.length > 0) {
      chartCache[cacheKey] = { data: result, ts: Date.now() };
      return result;
    }
  } catch {
    // return empty
  }

  return [];
}

/**
 * Fetch price chart for a specific time range using /market_chart/range.
 * Falls back to filtering the daily chart data.
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

  // Try range endpoint
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coingeckoId}/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`,
      { signal: AbortSignal.timeout(8000) }
    );

    if (!res.ok) throw new Error(`CoinGecko chart: ${res.status}`);

    const data = await res.json();
    const prices: [number, number][] = data?.prices || [];
    const result = prices.map(([ts, price]) => ({ time: ts, price }));

    if (result.length > 0) {
      chartCache[cacheKey] = { data: result, ts: Date.now() };
      return result;
    }
  } catch {
    // fallback below
  }

  // Fallback: use daily chart data filtered to the time range
  try {
    const daily = await fetchDailyChart(coingeckoId);
    const fromMs = fromTimestamp * 1000;
    const toMs = toTimestamp * 1000;
    const result = daily.filter((p) => p.time >= fromMs && p.time <= toMs);
    if (result.length > 0) {
      chartCache[cacheKey] = { data: result, ts: Date.now() };
      return result;
    }
  } catch {
    // return empty
  }

  return [];
}

export async function fetchAssetPrice(coingeckoId: string): Promise<number> {
  const cached = assetPriceCache[coingeckoId];
  if (cached && Date.now() - cached.ts < PRICE_CACHE_TTL) {
    return cached.price;
  }

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coingeckoId}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    const price = data?.[coingeckoId]?.usd;
    if (typeof price === "number" && price > 0) {
      assetPriceCache[coingeckoId] = { price, ts: Date.now() };
      return price;
    }
  } catch {
    // use cache if available
  }
  return cached?.price || 0;
}
