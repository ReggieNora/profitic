"use client";

import { useState, useEffect, useCallback } from "react";
import { Market } from "@/types";
import { API_URL } from "@/lib/constants";

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
      // Set demo data for development when API is unavailable
      setMarkets(getDemoMarkets());
    } finally {
      setLoading(false);
    }
  }, [options.filter, options.search]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return { markets, loading, error, refetch: fetchMarkets };
}

function getDemoMarkets(): Market[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      id: "demo-1",
      publicKey: "Demo11111111111111111111111111111111111111",
      question: "Will Bitcoin exceed $100,000 by end of Q1 2026?",
      description: "This market resolves YES if the price of Bitcoin (BTC/USD) on any major exchange exceeds $100,000 at any point before March 31, 2026.",
      creator: "BtcMax7777777777777777777777777777777777777",
      resolutionDate: now + 86400 * 30,
      dataSourceUrl: "https://www.coingecko.com/en/coins/bitcoin",
      outcome: "unresolved",
      yesShares: 15000,
      noShares: 10000,
      totalVolume: 50_000_000_000,
      liquidityPool: 25_000_000_000,
      yesPrice: 0.6,
      noPrice: 0.4,
      resolved: false,
      createdAt: now - 86400 * 5,
    },
    {
      id: "demo-2",
      publicKey: "Demo22222222222222222222222222222222222222",
      question: "Will Ethereum implement full danksharding in 2026?",
      description: "Resolves YES if Ethereum mainnet activates full danksharding (not proto-danksharding) before December 31, 2026.",
      creator: "EthDev3333333333333333333333333333333333333",
      resolutionDate: now + 86400 * 90,
      dataSourceUrl: "https://ethereum.org/en/roadmap/danksharding/",
      outcome: "unresolved",
      yesShares: 8000,
      noShares: 22000,
      totalVolume: 30_000_000_000,
      liquidityPool: 15_000_000_000,
      yesPrice: 0.267,
      noPrice: 0.733,
      resolved: false,
      createdAt: now - 86400 * 10,
    },
    {
      id: "demo-3",
      publicKey: "Demo33333333333333333333333333333333333333",
      question: "Will Solana TPS exceed 100,000 sustained for 24h?",
      description: "Resolves YES if Solana mainnet-beta sustains over 100,000 real (non-vote) transactions per second for a continuous 24-hour period.",
      creator: "SolWhale5555555555555555555555555555555555555",
      resolutionDate: now + 86400 * 60,
      dataSourceUrl: "https://explorer.solana.com/",
      outcome: "unresolved",
      yesShares: 12000,
      noShares: 12000,
      totalVolume: 20_000_000_000,
      liquidityPool: 10_000_000_000,
      yesPrice: 0.5,
      noPrice: 0.5,
      resolved: false,
      createdAt: now - 86400 * 3,
    },
    {
      id: "demo-4",
      publicKey: "Demo44444444444444444444444444444444444444",
      question: "Will the US approve a spot Solana ETF by July 2026?",
      description: "Resolves YES if the SEC approves at least one spot Solana ETF for trading on a US exchange before July 1, 2026.",
      creator: "RegWatch4444444444444444444444444444444444444",
      resolutionDate: now + 86400 * 120,
      dataSourceUrl: "https://www.sec.gov/",
      outcome: "unresolved",
      yesShares: 18000,
      noShares: 7000,
      totalVolume: 80_000_000_000,
      liquidityPool: 40_000_000_000,
      yesPrice: 0.72,
      noPrice: 0.28,
      resolved: false,
      createdAt: now - 86400 * 15,
    },
    {
      id: "demo-5",
      publicKey: "Demo55555555555555555555555555555555555555",
      question: "Will GPT-5 be released before September 2026?",
      description: "Resolves YES if OpenAI publicly releases GPT-5 (or an equivalent next-generation model) before September 1, 2026.",
      creator: "AiTrader6666666666666666666666666666666666666",
      resolutionDate: now + 86400 * 180,
      dataSourceUrl: "https://openai.com/",
      outcome: "unresolved",
      yesShares: 25000,
      noShares: 10000,
      totalVolume: 120_000_000_000,
      liquidityPool: 60_000_000_000,
      yesPrice: 0.71,
      noPrice: 0.29,
      resolved: false,
      createdAt: now - 86400 * 2,
    },
    {
      id: "demo-6",
      publicKey: "Demo66666666666666666666666666666666666666",
      question: "Will the Fed cut rates below 4% by end of 2026?",
      description: "Resolves YES if the Federal Reserve cuts the federal funds rate target below 4.00% before December 31, 2026.",
      creator: "MacroBull8888888888888888888888888888888888888",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://www.federalreserve.gov/",
      outcome: "unresolved",
      yesShares: 14000,
      noShares: 16000,
      totalVolume: 45_000_000_000,
      liquidityPool: 22_000_000_000,
      yesPrice: 0.47,
      noPrice: 0.53,
      resolved: false,
      createdAt: now - 86400 * 7,
    },
    {
      id: "demo-7",
      publicKey: "Demo77777777777777777777777777777777777777",
      question: "Will Bitcoin dominance stay above 50% through June 2026?",
      description: "Resolves YES if Bitcoin market cap dominance (per CoinGecko) remains above 50% for every day through June 30, 2026.",
      creator: "BtcMax7777777777777777777777777777777777777",
      resolutionDate: now + 86400 * 115,
      dataSourceUrl: "https://www.coingecko.com/en/global-charts",
      outcome: "unresolved",
      yesShares: 9000,
      noShares: 11000,
      totalVolume: 35_000_000_000,
      liquidityPool: 17_000_000_000,
      yesPrice: 0.45,
      noPrice: 0.55,
      resolved: false,
      createdAt: now - 86400 * 12,
    },
    {
      id: "demo-8",
      publicKey: "Demo88888888888888888888888888888888888888",
      question: "Will any NFT sell for over $10M in 2026?",
      description: "Resolves YES if any single NFT sells for over $10 million USD (or equivalent) in a verified transaction during 2026.",
      creator: "NftDegen9999999999999999999999999999999999999",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://opensea.io/",
      outcome: "unresolved",
      yesShares: 5000,
      noShares: 20000,
      totalVolume: 15_000_000_000,
      liquidityPool: 7_500_000_000,
      yesPrice: 0.2,
      noPrice: 0.8,
      resolved: false,
      createdAt: now - 86400 * 1,
    },
  ];
}
