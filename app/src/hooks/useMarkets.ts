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
    // ── Crypto ──
    {
      id: "demo-1",
      publicKey: "Demo11111111111111111111111111111111111111",
      question: "Will Bitcoin exceed $150,000 by end of Q2 2026?",
      description: "Resolves YES if BTC/USD on any major exchange exceeds $150,000 at any point before June 30, 2026.",
      creator: "BtcMax7777777777777777777777777777777777777",
      category: "crypto",
      resolutionDate: now + 86400 * 115,
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
      category: "crypto",
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
      description: "Resolves YES if Solana mainnet-beta sustains over 100,000 real (non-vote) TPS for a continuous 24-hour period.",
      creator: "SolWhale5555555555555555555555555555555555555",
      category: "crypto",
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
      category: "crypto",
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
    // ── Finance ──
    {
      id: "demo-5",
      publicKey: "Demo55555555555555555555555555555555555555",
      question: "Will the Fed cut rates below 4% by end of 2026?",
      description: "Resolves YES if the Federal Reserve cuts the federal funds rate target below 4.00% before December 31, 2026.",
      creator: "MacroBull8888888888888888888888888888888888888",
      category: "finance",
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
      id: "demo-6",
      publicKey: "Demo66666666666666666666666666666666666666",
      question: "Will the S&P 500 close above 6,500 before July 2026?",
      description: "Resolves YES if the S&P 500 index closes above 6,500 on any trading day before July 1, 2026.",
      creator: "StockPick1111111111111111111111111111111111111",
      category: "finance",
      resolutionDate: now + 86400 * 120,
      dataSourceUrl: "https://finance.yahoo.com/",
      outcome: "unresolved",
      yesShares: 20000,
      noShares: 8000,
      totalVolume: 65_000_000_000,
      liquidityPool: 32_000_000_000,
      yesPrice: 0.71,
      noPrice: 0.29,
      resolved: false,
      createdAt: now - 86400 * 4,
    },
    {
      id: "demo-7",
      publicKey: "Demo77777777777777777777777777777777777777",
      question: "Will US inflation drop below 2.5% by Q3 2026?",
      description: "Resolves YES if US CPI year-over-year falls below 2.5% in any monthly report before October 1, 2026.",
      creator: "MacroBull8888888888888888888888888888888888888",
      category: "finance",
      resolutionDate: now + 86400 * 210,
      dataSourceUrl: "https://www.bls.gov/cpi/",
      outcome: "unresolved",
      yesShares: 11000,
      noShares: 14000,
      totalVolume: 38_000_000_000,
      liquidityPool: 19_000_000_000,
      yesPrice: 0.44,
      noPrice: 0.56,
      resolved: false,
      createdAt: now - 86400 * 9,
    },
    // ── Politics ──
    {
      id: "demo-8",
      publicKey: "Demo88888888888888888888888888888888888888",
      question: "Will a US TikTok ban take effect in 2026?",
      description: "Resolves YES if TikTok becomes unavailable on US app stores due to federal legislation or executive order before December 31, 2026.",
      creator: "PolWatch2222222222222222222222222222222222222",
      category: "politics",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://www.congress.gov/",
      outcome: "unresolved",
      yesShares: 16000,
      noShares: 9000,
      totalVolume: 55_000_000_000,
      liquidityPool: 27_000_000_000,
      yesPrice: 0.64,
      noPrice: 0.36,
      resolved: false,
      createdAt: now - 86400 * 6,
    },
    {
      id: "demo-9",
      publicKey: "Demo99999999999999999999999999999999999999",
      question: "Will Congress pass a federal stablecoin bill in 2026?",
      description: "Resolves YES if both chambers of the US Congress pass stablecoin regulatory legislation before December 31, 2026.",
      creator: "PolWatch2222222222222222222222222222222222222",
      category: "politics",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://www.congress.gov/",
      outcome: "unresolved",
      yesShares: 10000,
      noShares: 15000,
      totalVolume: 30_000_000_000,
      liquidityPool: 15_000_000_000,
      yesPrice: 0.4,
      noPrice: 0.6,
      resolved: false,
      createdAt: now - 86400 * 14,
    },
    {
      id: "demo-10",
      publicKey: "DemoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      question: "Will the EU finalize MiCA enforcement by mid-2026?",
      description: "Resolves YES if MiCA crypto regulation is fully enforced across all EU member states before July 1, 2026.",
      creator: "EUWatch3333333333333333333333333333333333333",
      category: "politics",
      resolutionDate: now + 86400 * 120,
      dataSourceUrl: "https://www.europarl.europa.eu/",
      outcome: "unresolved",
      yesShares: 19000,
      noShares: 6000,
      totalVolume: 42_000_000_000,
      liquidityPool: 21_000_000_000,
      yesPrice: 0.76,
      noPrice: 0.24,
      resolved: false,
      createdAt: now - 86400 * 11,
    },
    // ── World Events ──
    {
      id: "demo-11",
      publicKey: "DemoBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      question: "Will a ceasefire in Ukraine hold for 90+ days in 2026?",
      description: "Resolves YES if an official ceasefire agreement between Russia and Ukraine lasts at least 90 consecutive days during 2026.",
      creator: "WorldWatch444444444444444444444444444444444444",
      category: "world",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://www.reuters.com/",
      outcome: "unresolved",
      yesShares: 7000,
      noShares: 18000,
      totalVolume: 40_000_000_000,
      liquidityPool: 20_000_000_000,
      yesPrice: 0.28,
      noPrice: 0.72,
      resolved: false,
      createdAt: now - 86400 * 8,
    },
    {
      id: "demo-12",
      publicKey: "DemoCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      question: "Will global average temperature set a new record in 2026?",
      description: "Resolves YES if 2026 becomes the hottest year on record per NASA GISS data, surpassing 2024/2025.",
      creator: "WorldWatch444444444444444444444444444444444444",
      category: "world",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://data.giss.nasa.gov/gistemp/",
      outcome: "unresolved",
      yesShares: 13000,
      noShares: 12000,
      totalVolume: 25_000_000_000,
      liquidityPool: 12_000_000_000,
      yesPrice: 0.52,
      noPrice: 0.48,
      resolved: false,
      createdAt: now - 86400 * 2,
    },
    {
      id: "demo-13",
      publicKey: "DemoDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
      question: "Will El Salvador issue a Bitcoin-backed bond in 2026?",
      description: "Resolves YES if El Salvador successfully issues a sovereign bond backed by or denominated in Bitcoin before December 31, 2026.",
      creator: "WorldWatch444444444444444444444444444444444444",
      category: "world",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://www.reuters.com/",
      outcome: "unresolved",
      yesShares: 9000,
      noShares: 16000,
      totalVolume: 18_000_000_000,
      liquidityPool: 9_000_000_000,
      yesPrice: 0.36,
      noPrice: 0.64,
      resolved: false,
      createdAt: now - 86400 * 13,
    },
    // ── Tech ──
    {
      id: "demo-14",
      publicKey: "DemoEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
      question: "Will GPT-5 be released before September 2026?",
      description: "Resolves YES if OpenAI publicly releases GPT-5 (or equivalent next-gen model) before September 1, 2026.",
      creator: "AiTrader6666666666666666666666666666666666666",
      category: "tech",
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
      id: "demo-15",
      publicKey: "DemoFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
      question: "Will Apple ship an AI-native Siri in iOS 20?",
      description: "Resolves YES if Apple announces and ships a fully LLM-powered Siri replacement in iOS 20 at WWDC 2026.",
      creator: "TechBull5555555555555555555555555555555555555",
      category: "tech",
      resolutionDate: now + 86400 * 100,
      dataSourceUrl: "https://developer.apple.com/",
      outcome: "unresolved",
      yesShares: 17000,
      noShares: 8000,
      totalVolume: 55_000_000_000,
      liquidityPool: 27_000_000_000,
      yesPrice: 0.68,
      noPrice: 0.32,
      resolved: false,
      createdAt: now - 86400 * 1,
    },
    {
      id: "demo-16",
      publicKey: "DemoGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
      question: "Will an AI model score above 90% on the ARC-AGI benchmark?",
      description: "Resolves YES if any publicly benchmarked AI model achieves above 90% on the ARC-AGI evaluation before December 31, 2026.",
      creator: "AiTrader6666666666666666666666666666666666666",
      category: "tech",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://arcprize.org/",
      outcome: "unresolved",
      yesShares: 6000,
      noShares: 19000,
      totalVolume: 35_000_000_000,
      liquidityPool: 17_000_000_000,
      yesPrice: 0.24,
      noPrice: 0.76,
      resolved: false,
      createdAt: now - 86400 * 3,
    },
    // ── Sports ──
    {
      id: "demo-17",
      publicKey: "DemoHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
      question: "Will the US win the most gold medals at the 2026 Winter Olympics?",
      description: "Resolves YES if the United States wins the most gold medals at the 2026 Milan-Cortina Winter Olympics.",
      creator: "SportsBet777777777777777777777777777777777777",
      category: "sports",
      resolutionDate: now + 86400 * 350,
      dataSourceUrl: "https://olympics.com/",
      outcome: "unresolved",
      yesShares: 7000,
      noShares: 18000,
      totalVolume: 22_000_000_000,
      liquidityPool: 11_000_000_000,
      yesPrice: 0.28,
      noPrice: 0.72,
      resolved: false,
      createdAt: now - 86400 * 4,
    },
    {
      id: "demo-18",
      publicKey: "DemoIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII",
      question: "Will a FIFA Club World Cup match draw 100K+ viewers on-chain?",
      description: "Resolves YES if any 2025 FIFA Club World Cup match token/NFT engagement exceeds 100,000 unique on-chain interactions.",
      creator: "SportsBet777777777777777777777777777777777777",
      category: "sports",
      resolutionDate: now + 86400 * 90,
      dataSourceUrl: "https://www.fifa.com/",
      outcome: "unresolved",
      yesShares: 4000,
      noShares: 21000,
      totalVolume: 12_000_000_000,
      liquidityPool: 6_000_000_000,
      yesPrice: 0.16,
      noPrice: 0.84,
      resolved: false,
      createdAt: now - 86400 * 6,
    },
    {
      id: "demo-19",
      publicKey: "DemoJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ",
      question: "Will an NBA team be tokenized on Solana by end of 2026?",
      description: "Resolves YES if any NBA franchise launches an official fan/ownership token on the Solana blockchain before December 31, 2026.",
      creator: "SportsBet777777777777777777777777777777777777",
      category: "sports",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://www.nba.com/",
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
