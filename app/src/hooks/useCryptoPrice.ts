"use client";

import { useState, useEffect, useCallback } from "react";
import { CryptoAsset } from "@/types";

type PriceSource = "pyth" | "unavailable";

interface CryptoPriceResult {
  price: number;
  loading: boolean;
  error: string | null;
  source: PriceSource;
}

// Module-level cache so all components share the same price data
const priceCache: Record<string, { price: number; timestamp: number; source: PriceSource }> = {};
const CACHE_TTL = 15_000; // 15 seconds — Pyth is fast, keep prices fresh

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
};

/**
 * Hook to fetch live crypto prices via Pyth Network (via /api/prices).
 */
export function useCryptoPrice(asset: CryptoAsset | string): CryptoPriceResult {
  const [price, setPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<PriceSource>("unavailable");

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
      let fetchedSource: PriceSource = "unavailable";

      // All assets: use /api/prices (Pyth only)
      const id = COINGECKO_IDS[asset.toUpperCase()] || asset.toLowerCase();
      const res = await fetch(
        `/api/prices?ids=${encodeURIComponent(id)}`,
        { signal: AbortSignal.timeout(8000) }
      );

      if (!res.ok) throw new Error(`Price proxy returned ${res.status}`);
      const data = await res.json();
      fetchedPrice = data?.[id];
      fetchedSource = "pyth";

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
  } catch {
    // fallback
  }

  return cached?.price || 0;
}
