"use client";

import { useState, useEffect, useCallback } from "react";
import { Market, Trade } from "@/types";
import { API_URL } from "@/lib/constants";
import { getDemoMarketById, getDemoTrades } from "@/lib/demoData";

interface UseMarketReturn {
  market: Market | null;
  trades: Trade[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMarket(id: string): UseMarketReturn {
  const [market, setMarket] = useState<Market | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMarket = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    try {
      const [marketRes, tradesRes] = await Promise.all([
        fetch(`${API_URL}/markets/${id}`),
        fetch(`${API_URL}/markets/${id}/trades`),
      ]);

      if (!marketRes.ok) throw new Error("Market not found");

      const marketData = await marketRes.json();
      setMarket(marketData.market || marketData);

      if (tradesRes.ok) {
        const tradesData = await tradesRes.json();
        setTrades(tradesData.trades || tradesData || []);
      }
    } catch (err) {
      console.error("Error fetching market:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch market");
      // Demo fallback — look up the correct market from shared demo data
      setMarket(getDemoMarketById(id));
      setTrades(getDemoTrades(id));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMarket();
  }, [fetchMarket]);

  return { market, trades, loading, error, refetch: fetchMarket };
}
