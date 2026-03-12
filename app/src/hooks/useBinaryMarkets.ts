"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  TradingAsset,
  CORE_ASSETS,
  discoverTrendingTokens,
  fetchAssetPrice,
  formatInterval,
} from "@/lib/tokenDiscovery";

// ── Types ──

export type MarketPhase = "betting" | "locked" | "resolving" | "complete";

export interface BinaryMarket {
  id: string;
  asset: TradingAsset;
  interval: number; // seconds
  intervalLabel: string;
  roundNumber: number;
  phase: MarketPhase;
  startTime: number;
  endTime: number;
  lockTime: number;
  entryPrice: number;
  finalPrice?: number;
  outcome?: "up" | "down" | "refund";
  upPool: number; // lamports
  downPool: number;
  totalPool: number;
  feeCollected: number;
  bets: MarketBet[];
}

export interface MarketBet {
  id: string;
  wallet: string;
  side: "up" | "down";
  amount: number;
  timestamp: number;
}

export interface CompletedRound {
  id: string;
  asset: TradingAsset;
  interval: number;
  intervalLabel: string;
  roundNumber: number;
  entryPrice: number;
  finalPrice: number;
  outcome: "up" | "down" | "refund";
  upPool: number;
  downPool: number;
  totalPool: number;
  feeCollected: number;
  startTime: number;
  endTime: number;
  totalBets: number;
}

// ── Constants ──

const LOCK_BUFFER_SECONDS = 10; // lock bets 10s before expiry

const DEMO_WALLETS = [
  "7xKz..aF9p", "3mRq..bT2x", "9pLw..cK4d", "5nHv..dM8s",
  "2jBx..eP6w", "8tGs..fR1y", "4vCn..gU3q", "6wDm..hV5r",
];

const BET_AMOUNTS = [0.1, 0.2, 0.5, 1, 2, 5, 10];

const FALLBACK_PRICES: Record<string, number> = {
  bitcoin: 69000,
  ethereum: 2400,
  solana: 85,
};

function solToLamports(sol: number): number {
  return Math.round(sol * 1_000_000_000);
}

function randomWallet(): string {
  return DEMO_WALLETS[Math.floor(Math.random() * DEMO_WALLETS.length)];
}

function randomBetAmount(): number {
  return BET_AMOUNTS[Math.floor(Math.random() * BET_AMOUNTS.length)];
}

// ── Create a fresh market round ──

function createMarket(
  asset: TradingAsset,
  interval: number,
  roundNumber: number,
  entryPrice: number,
  now: number
): BinaryMarket {
  const market: BinaryMarket = {
    id: `${asset.symbol}-${interval}-r${roundNumber}`,
    asset,
    interval,
    intervalLabel: `${formatInterval(interval)} Binary`,
    roundNumber,
    phase: "betting",
    startTime: now,
    endTime: now + interval,
    lockTime: now + interval - LOCK_BUFFER_SECONDS,
    entryPrice,
    upPool: solToLamports(10 + Math.random() * 40),
    downPool: solToLamports(10 + Math.random() * 40),
    totalPool: 0,
    feeCollected: 0,
    bets: [],
  };
  market.totalPool = market.upPool + market.downPool;
  return market;
}

// ── Hook ──

export interface UseBinaryMarketsReturn {
  markets: BinaryMarket[];
  assets: TradingAsset[];
  livePrices: Record<string, number>;
  placeBet: (marketId: string, side: "up" | "down", amount: number) => void;
  roundHistory: Record<string, CompletedRound[]>; // keyed by "SYMBOL-interval"
  loading: boolean;
}

export function useBinaryMarkets(): UseBinaryMarketsReturn {
  const [markets, setMarkets] = useState<BinaryMarket[]>([]);
  const [assets, setAssets] = useState<TradingAsset[]>(CORE_ASSETS);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [roundHistory, setRoundHistory] = useState<Record<string, CompletedRound[]>>({});
  const initialized = useRef(false);
  const roundCounters = useRef<Record<string, number>>({});
  const livePricesRef = useRef(livePrices);
  livePricesRef.current = livePrices;

  // Client-only init: create markets with fallback prices, then fetch real data
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Create initial markets synchronously (client-side only, no hydration mismatch)
    const now = Math.floor(Date.now() / 1000);
    const fallbackPrices: Record<string, number> = {};
    const initialMarkets: BinaryMarket[] = [];

    for (const asset of CORE_ASSETS) {
      const price = FALLBACK_PRICES[asset.coingeckoId] || 0.01;
      fallbackPrices[asset.symbol] = price;
      for (const iv of asset.intervals) {
        const key = `${asset.symbol}-${iv}`;
        roundCounters.current[key] = 1;
        initialMarkets.push(createMarket(asset, iv, 1, price, now));
      }
    }

    setLivePrices(fallbackPrices);
    setMarkets(initialMarkets);
    setLoading(false);

    const fetchRealData = async () => {
      // Discover trending tokens (non-blocking)
      const trending = await discoverTrendingTokens(3);
      const allAssets = [...CORE_ASSETS, ...trending];
      setAssets(allAssets);

      // Fetch all prices in parallel
      const priceEntries = await Promise.allSettled(
        allAssets.map(async (a) => {
          const price = await fetchAssetPrice(a.coingeckoId);
          return [a.symbol, price] as [string, number];
        })
      );

      const prices: Record<string, number> = { ...fallbackPrices };
      priceEntries.forEach((result) => {
        if (result.status === "fulfilled") {
          const [sym, price] = result.value;
          prices[sym] = price > 0 ? price : (FALLBACK_PRICES[allAssets.find((a) => a.symbol === sym)?.coingeckoId ?? ""] || 0.01);
        }
      });
      setLivePrices(prices);

      // Add markets for any new trending assets
      const nowUpdated = Math.floor(Date.now() / 1000);
      const newMarkets: BinaryMarket[] = [];
      for (const asset of trending) {
        for (const iv of asset.intervals) {
          const key = `${asset.symbol}-${iv}`;
          if (!roundCounters.current[key]) {
            roundCounters.current[key] = 1;
            const price = prices[asset.symbol] || 0.01;
            newMarkets.push(createMarket(asset, iv, 1, price, nowUpdated));
          }
        }
      }

      if (newMarkets.length > 0) {
        setMarkets((prev) => [...prev, ...newMarkets]);
      }
    };

    fetchRealData();
  }, []);

  // Tick loop: update phases, simulate bets, resolve markets, start new rounds
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Math.floor(Date.now() / 1000);

      // Refresh prices
      const currentAssets = assets;
      const newPrices: Record<string, number> = { ...livePricesRef.current };
      const priceResults = await Promise.allSettled(
        currentAssets.map(async (a) => {
          const p = await fetchAssetPrice(a.coingeckoId);
          return [a.symbol, p] as [string, number];
        })
      );
      priceResults.forEach((r) => {
        if (r.status === "fulfilled" && r.value[1] > 0) {
          newPrices[r.value[0]] = r.value[1];
        }
      });
      setLivePrices(newPrices);

      setMarkets((prev) => {
        const updated = [...prev];
        let changed = false;

        for (let i = 0; i < updated.length; i++) {
          const m = updated[i];
          if (!m) continue;

          // Phase transitions
          if (m.phase === "betting" && now >= m.lockTime) {
            updated[i] = { ...m, phase: "locked" };
            changed = true;
            continue;
          }

          if ((m.phase === "betting" || m.phase === "locked") && now >= m.endTime) {
            // Resolve
            const finalPrice = newPrices[m.asset.symbol] || m.entryPrice;
            let outcome: "up" | "down" | "refund";
            if (finalPrice > m.entryPrice) outcome = "up";
            else if (finalPrice < m.entryPrice) outcome = "down";
            else outcome = "refund";

            const fee = Math.round(m.totalPool * 0.02);

            updated[i] = {
              ...m,
              phase: "complete",
              finalPrice,
              outcome,
              feeCollected: fee,
            };
            changed = true;

            // Save to round history
            const historyKey = `${m.asset.symbol}-${m.interval}`;
            const completedRound: CompletedRound = {
              id: m.id,
              asset: m.asset,
              interval: m.interval,
              intervalLabel: m.intervalLabel,
              roundNumber: m.roundNumber,
              entryPrice: m.entryPrice,
              finalPrice,
              outcome,
              upPool: m.upPool,
              downPool: m.downPool,
              totalPool: m.totalPool,
              feeCollected: fee,
              startTime: m.startTime,
              endTime: m.endTime,
              totalBets: m.bets.length,
            };
            setRoundHistory((prev) => {
              const existing = prev[historyKey] || [];
              return { ...prev, [historyKey]: [...existing, completedRound].slice(-50) };
            });

            // Schedule new round
            const key = `${m.asset.symbol}-${m.interval}`;
            const rn = (roundCounters.current[key] || 1) + 1;
            roundCounters.current[key] = rn;

            setTimeout(() => {
              setMarkets((p) => {
                const idx = p.findIndex((x) => x.id === m.id);
                if (idx === -1) return p;
                const price = livePricesRef.current[m.asset.symbol] || m.entryPrice;
                const newMarket = createMarket(
                  m.asset,
                  m.interval,
                  rn,
                  price,
                  Math.floor(Date.now() / 1000)
                );
                const next = [...p];
                next[idx] = newMarket;
                return next;
              });
            }, 3000);
            continue;
          }

          // Simulate random bets during betting phase
          if (m.phase === "betting" && Math.random() < 0.25) {
            const side: "up" | "down" = Math.random() > 0.5 ? "up" : "down";
            const amount = solToLamports(randomBetAmount());
            const bet: MarketBet = {
              id: `${m.id}-bet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              wallet: randomWallet(),
              side,
              amount,
              timestamp: now,
            };

            updated[i] = {
              ...m,
              bets: [...m.bets.slice(-29), bet],
              upPool: m.upPool + (side === "up" ? amount : 0),
              downPool: m.downPool + (side === "down" ? amount : 0),
              totalPool: m.totalPool + amount,
            };
            changed = true;
          }
        }

        return changed ? updated : prev;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [assets]);

  const placeBet = useCallback(
    (marketId: string, side: "up" | "down", amount: number) => {
      setMarkets((prev) => {
        const idx = prev.findIndex((m) => m.id === marketId);
        if (idx === -1) return prev;
        const m = prev[idx];
        if (m.phase !== "betting") return prev;

        const lamports = solToLamports(amount);
        const bet: MarketBet = {
          id: `${m.id}-user-${Date.now()}`,
          wallet: "You",
          side,
          amount: lamports,
          timestamp: Math.floor(Date.now() / 1000),
        };

        const updated = [...prev];
        updated[idx] = {
          ...m,
          bets: [...m.bets, bet],
          upPool: m.upPool + (side === "up" ? lamports : 0),
          downPool: m.downPool + (side === "down" ? lamports : 0),
          totalPool: m.totalPool + lamports,
        };
        return updated;
      });
    },
    []
  );

  return { markets, assets, livePrices, placeBet, roundHistory, loading };
}
