"use client";

import { useState, useEffect, useCallback } from "react";
import { Market } from "@/types";
import { API_URL } from "@/lib/constants";
import { getDemoMarketsLive } from "@/lib/demoData";

interface UseMarketsOptions {
  filter?: string;
  search?: string;
}

interface UseMarketsReturn {
  markets: Market[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMarkets(options: UseMarketsOptions = {}): UseMarketsReturn {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.filter && options.filter !== "all") {
        params.set("filter", options.filter);
      }
      if (options.search) {
        params.set("search", options.search);
      }

      const queryString = params.toString();
      const url = `${API_URL}/markets${queryString ? `?${queryString}` : ""}`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch markets: ${res.statusText}`);

      const data = await res.json();
      setMarkets(data.markets || data || []);
    } catch (err) {
      console.error("Error fetching markets:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch markets");
      // Set demo data with live crypto prices
      const demoMarkets = await getDemoMarketsLive();
      setMarkets(demoMarkets);
    } finally {
      setLoading(false);
    }
  }, [options.filter, options.search]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return { markets, loading, error, refetch: fetchMarkets };
}
