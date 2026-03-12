"use client";

import { useState, useEffect, useCallback } from "react";
import { CryptoAsset } from "@/types";

type PriceSource = "pyth" | "coincap" | "coingecko" | "jupiter" | "fallback";

interface CryptoPriceResult {
  price: number;
  loading: boolean;
  error: string | null;
  source: PriceSource;
}

// Module-level cache so all components share the same price data
const priceCache: Record<string, { price: number; timestamp: number; source: PriceSource }> = {};
const CACHE_TTL = 15_000; // 15 seconds — Pyth is fast, keep prices fresh

// Core assets use the hybrid /api/prices route (Pyth → CoinCap → CoinGecko)
const CORE_ASSETS = new Set<string>(["BTC", "ETH", "SOL"]);

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
};

/**
 * Hook to fetch live crypto prices via hybrid server-side proxies.
 * Core assets: Pyth → CoinCap → CoinGecko (via /api/prices)
 * Meme tokens: Jupiter (via /api/jupiter-price)
 */
export function useCryptoPrice(asset: CryptoAsset | string): CryptoPriceResult {
  const [price, setPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<PriceSource>("fallback");

  const fetchPrice = useCallback(async () => {
    const cached = priceCache[asset];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setPrice(cached.price);
      setSource(cached.source);
      setLoading(false);
      return;
    }

    try {
      let fetchedPrice: number | undefined;
      let fetchedSource: PriceSource = "fallback";

      if (CORE_ASSETS.has(asset.toUpperCase())) {
        // Core asset: use hybrid /api/prices (Pyth → CoinCap → CoinGecko)
        const id = COINGECKO_IDS[asset.toUpperCase()] || asset.toLowerCase();
        const res = await fetch(
          `/api/prices?ids=${encodeURIComponent(id)}`,
          { signal: AbortSignal.timeout(8000) }
        );

        if (!res.ok) throw new Error(`Price proxy returned ${res.status}`);
        const data = await res.json();
        fetchedPrice = data?.[id];
        fetchedSource = "pyth"; // Pyth is primary; the proxy cascades internally
      } else {
        // Non-core (meme/pump.fun): try Jupiter first
        const res = await fetch(
          `/api/jupiter-price?ids=${encodeURIComponent(asset.toUpperCase())}`,
          { signal: AbortSignal.timeout(8000) }
        );

        if (res.ok) {
          const data = await res.json();
          fetchedPrice = data?.[asset.toUpperCase()];
          fetchedSource = "jupiter";
        }

        // Fallback to CoinGecko if Jupiter didn't have it
        if (!fetchedPrice || fetchedPrice <= 0) {
          const cgRes = await fetch(
            `/api/prices?ids=${encodeURIComponent(asset.toLowerCase())}`,
            { signal: AbortSignal.timeout(8000) }
          );
          if (cgRes.ok) {
            const cgData = await cgRes.json();
            fetchedPrice = cgData?.[asset.toLowerCase()];
            fetchedSource = "coingecko";
          }
        }
      }

      if (typeof fetchedPrice === "number" && fetchedPrice > 0) {
        priceCache[asset] = { price: fetchedPrice, timestamp: Date.now(), source: fetchedSource };
        setPrice(fetchedPrice);
        setSource(fetchedSource);
        setError(null);
      } else {
        throw new Error("Invalid price data");
      }
    } catch (err) {
      // Don't overwrite a good cached price on transient failure
      if (cached) {
        setPrice(cached.price);
        setSource(cached.source);
      }
      setError(err instanceof Error ? err.message : "Price fetch failed");
    } finally {
      setLoading(false);
    }
  }, [asset]);

  useEffect(() => {
    fetchPrice();
    const interval = setInterval(fetchPrice, 30_000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, [fetchPrice]);

  return { price, loading, error, source };
}

/**
 * Fetch price once (non-hook version for use in event handlers).
 */
export async function fetchCryptoPrice(asset: CryptoAsset | string): Promise<number> {
  const cached = priceCache[asset];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  try {
    if (CORE_ASSETS.has(asset.toUpperCase())) {
      const id = COINGECKO_IDS[asset.toUpperCase()] || asset.toLowerCase();
      const res = await fetch(
        `/api/prices?ids=${encodeURIComponent(id)}`,
        { signal: AbortSignal.timeout(8000) }
      );
      const data = await res.json();
      const price = data?.[id];
      if (typeof price === "number" && price > 0) {
        priceCache[asset] = { price, timestamp: Date.now(), source: "pyth" };
        return price;
      }
    } else {
      // Jupiter for non-core
      const res = await fetch(
        `/api/jupiter-price?ids=${encodeURIComponent(asset.toUpperCase())}`,
        { signal: AbortSignal.timeout(8000) }
      );
      if (res.ok) {
        const data = await res.json();
        const price = data?.[asset.toUpperCase()];
        if (typeof price === "number" && price > 0) {
          priceCache[asset] = { price, timestamp: Date.now(), source: "jupiter" };
          return price;
        }
      }
    }
  } catch {
    // fallback
  }

  return cached?.price || 0;
}
