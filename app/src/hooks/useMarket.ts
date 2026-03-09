"use client";

import { useState, useEffect, useCallback } from "react";
import { Market, Trade } from "@/types";
import { API_URL } from "@/lib/constants";

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
      // Demo fallback
      setMarket(getDemoMarket(id));
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

function getDemoMarket(id: string): Market {
  const now = Math.floor(Date.now() / 1000);
  return {
    id,
    publicKey: "Demo11111111111111111111111111111111111111",
    question: "Will Bitcoin exceed $100,000 by end of Q1 2026?",
    description:
      "This market resolves YES if the price of Bitcoin (BTC/USD) on any major exchange exceeds $100,000 at any point before March 31, 2026. The resolution source is CoinGecko.",
    creator: "Creator11111111111111111111111111111111111",
    resolutionDate: now + 86400 * 30,
    dataSourceUrl: "https://www.coingecko.com/en/coins/bitcoin",
    outcome: "unresolved",
    status: "active",
    yesShares: 15000,
    noShares: 10000,
    totalVolume: 50_000_000_000,
    liquidityPool: 25_000_000_000,
    yesPrice: 0.6,
    noPrice: 0.4,
    resolved: false,
    createdAt: now - 86400 * 5,
    yesPool: 15_000_000_000,
    noPool: 10_000_000_000,
    feesCollected: 1_000_000_000,
    creatorYesLiquidity: 12_500_000_000,
    creatorNoLiquidity: 12_500_000_000,
    creatorLiquidityWithdrawn: false,
  };
}

function getDemoTrades(marketId: string): Trade[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      id: "t1",
      marketId,
      trader: "Trader1111111111111111111111111111111111111",
      outcome: "yes",
      direction: "buy",
      shares: 500,
      price: 0.58,
      cost: 290_000_000,
      timestamp: now - 3600,
      fee: 5_800_000,
      txSignature: "5xAbC...demo1",
    },
    {
      id: "t2",
      marketId,
      trader: "Trader2222222222222222222222222222222222222",
      outcome: "no",
      direction: "buy",
      shares: 300,
      price: 0.41,
      cost: 123_000_000,
      timestamp: now - 7200,
      fee: 2_460_000,
      txSignature: "5xDeF...demo2",
    },
    {
      id: "t3",
      marketId,
      trader: "Trader3333333333333333333333333333333333333",
      outcome: "yes",
      direction: "sell",
      shares: 150,
      price: 0.62,
      cost: 93_000_000,
      timestamp: now - 10800,
      fee: 1_860_000,
      txSignature: "5xGhI...demo3",
    },
    {
      id: "t4",
      marketId,
      trader: "Trader1111111111111111111111111111111111111",
      outcome: "yes",
      direction: "buy",
      shares: 1000,
      price: 0.55,
      cost: 550_000_000,
      timestamp: now - 21600,
      fee: 11_000_000,
      txSignature: "5xJkL...demo4",
    },
    {
      id: "t5",
      marketId,
      trader: "Trader4444444444444444444444444444444444444",
      outcome: "no",
      direction: "buy",
      shares: 800,
      price: 0.38,
      cost: 304_000_000,
      timestamp: now - 43200,
      fee: 6_080_000,
      txSignature: "5xMnO...demo5",
    },
  ];
}
