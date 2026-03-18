/**
 * Profitic Backend — Hybrid Price Oracle Service
 *
 * Fetches real-time crypto prices using a cascading approach:
 *   Core assets (BTC, ETH, SOL): Pyth Network → CoinCap → CoinGecko
 *   Meme/pump.fun tokens:        Jupiter Price API → CoinGecko
 *
 * Resolution logic:
 *   - Up/Down: compares start_price to current price at expiry
 *   - Price Target: compares current price at expiry to strike_price
 */

// ---------------------------------------------------------------------------
// Pyth Network Price Feed IDs (mainnet-beta)
// ---------------------------------------------------------------------------
const PYTH_FEED_IDS: Record<string, string> = {
  BTC: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
};

// Pyth Hermes API endpoint (public, no auth required)
const PYTH_HERMES_URL = "https://hermes.pyth.network";

// CoinGecko API IDs (free tier, no auth required)
const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
};

// CoinCap API IDs (free tier, no auth required)
const COINCAP_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
};

// Core assets that have Pyth feeds
const CORE_ASSETS = new Set(Object.keys(PYTH_FEED_IDS));

// ---------------------------------------------------------------------------
// Price Result
// ---------------------------------------------------------------------------
export interface PriceResult {
  asset: string;
  price: number; // USD
  confidence: number; // USD confidence interval
  timestamp: number; // Unix seconds
  source: "pyth" | "coincap" | "coingecko" | "jupiter" | "simulated";
}

// ---------------------------------------------------------------------------
// Pyth Network Price Fetch
// ---------------------------------------------------------------------------

/**
 * Fetch the latest price for an asset from Pyth Network's Hermes API.
 */
export async function fetchPythPrice(asset: string): Promise<PriceResult | null> {
  const feedId = PYTH_FEED_IDS[asset.toUpperCase()];
  if (!feedId) return null;

  try {
    const url = `${PYTH_HERMES_URL}/v2/updates/price/latest?ids[]=${feedId}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!res.ok) {
      console.warn(`[oracle] Pyth API returned ${res.status} for ${asset}`);
      return null;
    }

    const data = await res.json() as { parsed?: Array<{ id: string; price?: { price: string; expo: string; conf: string; publish_time: string } }> };
    const parsed = data?.parsed?.[0];
    if (!parsed?.price) return null;

    // Pyth prices use an exponent (e.g., price=8475000, expo=-2 means $84,750.00)
    const priceVal = Number(parsed.price.price);
    const expo = Number(parsed.price.expo);
    const conf = Number(parsed.price.conf);
    const publishTime = Number(parsed.price.publish_time);

    const price = priceVal * Math.pow(10, expo);
    const confidence = conf * Math.pow(10, expo);

    return {
      asset: asset.toUpperCase(),
      price,
      confidence,
      timestamp: publishTime,
      source: "pyth",
    };
  } catch (err) {
    console.warn(`[oracle] Pyth fetch failed for ${asset}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// CoinCap Fallback (for core assets)
// ---------------------------------------------------------------------------

/**
 * Fetch the latest price from CoinCap (free API, no key required).
 */
export async function fetchCoinCapPrice(asset: string): Promise<PriceResult | null> {
  const id = COINCAP_IDS[asset.toUpperCase()];
  if (!id) return null;

  try {
    const url = `https://api.coincap.io/v2/assets/${id}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!res.ok) {
      console.warn(`[oracle] CoinCap API returned ${res.status} for ${asset}`);
      return null;
    }

    const data = await res.json() as { data?: { priceUsd?: string } };
    const price = parseFloat(data?.data?.priceUsd ?? "");
    if (isNaN(price) || price <= 0) return null;

    return {
      asset: asset.toUpperCase(),
      price,
      confidence: 0,
      timestamp: Math.floor(Date.now() / 1000),
      source: "coincap",
    };
  } catch (err) {
    console.warn(`[oracle] CoinCap fetch failed for ${asset}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// CoinGecko Fallback
// ---------------------------------------------------------------------------

/**
 * Fetch the latest price from CoinGecko (free API, no key required).
 */
export async function fetchCoinGeckoPrice(asset: string): Promise<PriceResult | null> {
  const id = COINGECKO_IDS[asset.toUpperCase()];
  if (!id) return null;

  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!res.ok) {
      console.warn(`[oracle] CoinGecko API returned ${res.status} for ${asset}`);
      return null;
    }

    const data = await res.json() as Record<string, { usd?: number }>;
    const price = data?.[id]?.usd;
    if (typeof price !== "number") return null;

    return {
      asset: asset.toUpperCase(),
      price,
      confidence: 0,
      timestamp: Math.floor(Date.now() / 1000),
      source: "coingecko",
    };
  } catch (err) {
    console.warn(`[oracle] CoinGecko fetch failed for ${asset}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Jupiter Price API (for any Solana token, including pump.fun)
// ---------------------------------------------------------------------------

/**
 * Fetch the latest price from Jupiter Price API.
 * Works with token symbols (BONK, WIF) or mint addresses.
 */
export async function fetchJupiterPrice(symbolOrMint: string): Promise<PriceResult | null> {
  try {
    const url = `https://price.jup.ag/v6/price?ids=${encodeURIComponent(symbolOrMint)}&vsToken=USDC`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });

    if (!res.ok) {
      console.warn(`[oracle] Jupiter API returned ${res.status} for ${symbolOrMint}`);
      return null;
    }

    const data = await res.json() as { data?: Record<string, { price?: number }> };
    const entry = data?.data?.[symbolOrMint];
    if (!entry || typeof entry.price !== "number" || entry.price <= 0) return null;

    return {
      asset: symbolOrMint.toUpperCase(),
      price: entry.price,
      confidence: 0,
      timestamp: Math.floor(Date.now() / 1000),
      source: "jupiter",
    };
  } catch (err) {
    console.warn(`[oracle] Jupiter fetch failed for ${symbolOrMint}:`, err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Combined Price Fetch (hybrid cascade)
// ---------------------------------------------------------------------------

/**
 * Get the current price of a crypto asset.
 *
 * Core assets (BTC, ETH, SOL): Pyth → CoinCap → CoinGecko → Simulated
 * Other tokens:                 Jupiter → CoinGecko → Simulated
 */
export async function getPrice(asset: string): Promise<PriceResult> {
  const upper = asset.toUpperCase();

  if (CORE_ASSETS.has(upper)) {
    // Core asset cascade: Pyth → CoinCap → CoinGecko
    const pythPrice = await fetchPythPrice(upper);
    if (pythPrice) return pythPrice;

    const coincapPrice = await fetchCoinCapPrice(upper);
    if (coincapPrice) return coincapPrice;

    const cgPrice = await fetchCoinGeckoPrice(upper);
    if (cgPrice) return cgPrice;
  } else {
    // Non-core (meme/pump.fun): Jupiter → CoinGecko
    const jupPrice = await fetchJupiterPrice(asset);
    if (jupPrice) return jupPrice;

    // Try CoinGecko as fallback (works if the token has a CoinGecko listing)
    const cgPrice = await fetchCoinGeckoPrice(asset);
    if (cgPrice) return cgPrice;
  }

  // Last resort: simulated prices (for development/testing)
  console.warn(`[oracle] All price sources failed for ${asset}, using simulated price`);
  const simulated: Record<string, number> = {
    BTC: 74000,
    ETH: 1900,
    SOL: 130,
  };
  return {
    asset: upper,
    price: simulated[upper] || 0,
    confidence: 0,
    timestamp: Math.floor(Date.now() / 1000),
    source: "simulated",
  };
}

// ---------------------------------------------------------------------------
// Market Resolution Logic
// ---------------------------------------------------------------------------

export interface ResolutionResult {
  winningOutcome: 0 | 1; // 0 = YES/UP, 1 = NO/DOWN
  finalPrice: number;
  priceSource: string;
  evidence: string;
}

/**
 * Resolve a Crypto Up/Down market.
 *
 * For "up_down" markets:
 *   - YES wins if finalPrice >= startPrice
 *   - NO wins if finalPrice < startPrice
 *
 * For "price_target" markets:
 *   - YES wins if finalPrice >= strikePrice
 *   - NO wins if finalPrice < strikePrice
 */
export async function resolveMarket(params: {
  asset: string;
  subtype: "up_down" | "price_target";
  startPrice: number;
  strikePrice?: number;
}): Promise<ResolutionResult> {
  const { asset, subtype, startPrice, strikePrice } = params;

  const priceData = await getPrice(asset);
  const finalPrice = priceData.price;

  let yesWins: boolean;
  let evidence: string;

  if (subtype === "up_down") {
    yesWins = finalPrice >= startPrice;
    evidence = `${asset} price at resolution: $${finalPrice.toLocaleString()} (start: $${startPrice.toLocaleString()}). Price went ${yesWins ? "UP" : "DOWN"}. Source: ${priceData.source}`;
  } else {
    const target = strikePrice || startPrice;
    yesWins = finalPrice >= target;
    evidence = `${asset} price at resolution: $${finalPrice.toLocaleString()} (target: $${target.toLocaleString()}). Target ${yesWins ? "reached" : "not reached"}. Source: ${priceData.source}`;
  }

  return {
    winningOutcome: yesWins ? 0 : 1,
    finalPrice,
    priceSource: priceData.source,
    evidence,
  };
}

// ---------------------------------------------------------------------------
// Market Expiry Checker
// ---------------------------------------------------------------------------

/**
 * Check if a crypto market has expired and should be resolved.
 * Returns true if current time is past the resolution timestamp.
 */
export function isMarketExpired(resolutionTimestamp: number): boolean {
  return Math.floor(Date.now() / 1000) >= resolutionTimestamp;
}
