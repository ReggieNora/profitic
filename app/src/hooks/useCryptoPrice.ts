"use client";

import { useState, useEffect, useCallback } from "react";
import { CryptoAsset } from "@/types";

const COINGECKO_IDS: Record<CryptoAsset, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
};

interface CryptoPriceResult {
  price: number;
  loading: boolean;
  error: string | null;
  source: "coingecko" | "fallback";
}

// Module-level cache so all components share the same price data
const priceCache: Record<string, { price: number; timestamp: number; source: "coingecko" | "fallback" }> = {};
const CACHE_TTL = 10_000; // 10 seconds

/**
 * Hook to fetch live crypto prices from CoinGecko (free, no API key).
 * Caches prices for 10 seconds and polls every 10 seconds.
 * Falls back to approximate prices if fetch fails.
 */
export function useCryptoPrice(asset: CryptoAsset): CryptoPriceResult {
  const [price, setPrice] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<"coingecko" | "fallback">("coingecko");

  const fetchPrice = useCallback(async () => {
    const cached = priceCache[asset];
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      setPrice(cached.price);
      setSource(cached.source);
      setLoading(false);
      return;
    }

    try {
      const id = COINGECKO_IDS[asset];
      const res = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
        { signal: AbortSignal.timeout(5000) }
      );

      if (!res.ok) throw new Error(`CoinGecko returned ${res.status}`);

      const data = await res.json();
      const fetchedPrice = data?.[id]?.usd;

      if (typeof fetchedPrice === "number" && fetchedPrice > 0) {
        priceCache[asset] = { price: fetchedPrice, timestamp: Date.now(), source: "coingecko" };
        setPrice(fetchedPrice);
        setSource("coingecko");
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
    const interval = setInterval(fetchPrice, 10_000);
    return () => clearInterval(interval);
  }, [fetchPrice]);

  return { price, loading, error, source };
}

/**
 * Fetch price once (non-hook version for use in event handlers).
 */
export async function fetchCryptoPrice(asset: CryptoAsset): Promise<number> {
  const cached = priceCache[asset];
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  try {
    const id = COINGECKO_IDS[asset];
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
      { signal: AbortSignal.timeout(5000) }
    );
    const data = await res.json();
    const price = data?.[id]?.usd;
    if (typeof price === "number" && price > 0) {
      priceCache[asset] = { price, timestamp: Date.now(), source: "coingecko" };
      return price;
    }
  } catch {
    // fallback
  }

  return cached?.price || 0;
}
