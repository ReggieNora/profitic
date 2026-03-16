"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  TradingAsset,
  CORE_ASSETS,
  discoverTrendingTokens,
  fetchAssetPrices,
  formatInterval,
} from "@/lib/tokenDiscovery";
import { useBinaryProgram, deriveRoundPda, deriveBetPda, deriveConfigPda } from "./useBinaryProgram";

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

const LOCK_BUFFER_SECONDS = 30; // lock bets 30s before expiry (must match on-chain lock_buffer)

const DEMO_WALLETS = [
  "7xKz..aF9p", "3mRq..bT2x", "9pLw..cK4d", "5nHv..dM8s",
  "2jBx..eP6w", "8tGs..fR1y", "4vCn..gU3q", "6wDm..hV5r",
];

const BET_AMOUNTS = [0.1, 0.2, 0.5, 1, 2, 5, 10];

const FALLBACK_PRICES: Record<string, number> = {
  bitcoin: 71000,
  ethereum: 2500,
  solana: 130,
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

// Track user's simulated bets for payout calculation
export interface UserBet {
  marketId: string;
  side: "up" | "down";
  amount: number; // lamports
}

export interface UseBinaryMarketsReturn {
  markets: BinaryMarket[];
  assets: TradingAsset[];
  livePrices: Record<string, number>;
  placeBet: (marketId: string, side: "up" | "down", amount: number) => Promise<void>;
  claimWinnings: (marketId: string, betIndex: number) => Promise<void>;
  roundHistory: Record<string, CompletedRound[]>; // keyed by "SYMBOL-interval"
  loading: boolean;
  txPending: boolean;
  txError: string | null;
  demoBalance: number | null; // SOL — null until wallet balance loaded
  userBets: UserBet[];
  lastPayout: { amount: number; won: boolean } | null;
}

export function useBinaryMarkets(): UseBinaryMarketsReturn {
  const [markets, setMarkets] = useState<BinaryMarket[]>([]);
  const [assets, setAssets] = useState<TradingAsset[]>(CORE_ASSETS);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [roundHistory, setRoundHistory] = useState<Record<string, CompletedRound[]>>({});
  const [txPending, setTxPending] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [demoBalance, setDemoBalance] = useState<number | null>(null); // null until wallet balance loaded
  const [userBets, setUserBets] = useState<UserBet[]>([]);
  const [lastPayout, setLastPayout] = useState<{ amount: number; won: boolean } | null>(null);
  const userBetsRef = useRef(userBets);
  userBetsRef.current = userBets;
  const balanceInitialized = useRef(false);
  const initialized = useRef(false);
  const roundCounters = useRef<Record<string, number>>({});
  const livePricesRef = useRef(livePrices);
  livePricesRef.current = livePrices;

  // On-chain program access
  const { program } = useBinaryProgram();
  const wallet = useWallet();
  const { connection } = useConnection();

  // Initialize demo balance from wallet's actual SOL balance
  useEffect(() => {
    if (!wallet.publicKey || balanceInitialized.current) return;
    balanceInitialized.current = true;
    connection.getBalance(wallet.publicKey).then((lamports) => {
      setDemoBalance(lamports / 1_000_000_000);
    }).catch(() => {
      setDemoBalance(10); // fallback if RPC fails
    });
  }, [wallet.publicKey, connection]);

  // Reset balance tracking when wallet disconnects
  useEffect(() => {
    if (!wallet.publicKey) {
      balanceInitialized.current = false;
      setDemoBalance(null);
      setUserBets([]);
    }
  }, [wallet.publicKey]);

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

      // Fetch all prices — core via hybrid proxy, meme via Jupiter
      const coreIds = allAssets.filter((a) => a.type === "core").map((a) => a.coingeckoId);
      const jupSymbols = allAssets.filter((a) => a.type === "pumpfun" && a.jupiterId).map((a) => a.jupiterId!);
      const nonCoreIds = allAssets.filter((a) => a.type === "pumpfun" && !a.jupiterId).map((a) => a.coingeckoId);
      const fetchedPrices = await fetchAssetPrices([...coreIds, ...nonCoreIds], jupSymbols);

      const prices: Record<string, number> = { ...fallbackPrices };
      for (const asset of allAssets) {
        // Check both coingeckoId and jupiterId keys
        const p = fetchedPrices[asset.coingeckoId] || (asset.jupiterId ? fetchedPrices[asset.jupiterId] : 0);
        if (p && p > 0) {
          prices[asset.symbol] = p;
        } else {
          prices[asset.symbol] = prices[asset.symbol] || FALLBACK_PRICES[asset.coingeckoId] || 0.01;
        }
      }
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

      // Refresh prices — core via hybrid proxy, meme via Jupiter
      const currentAssets = assets;
      const newPrices: Record<string, number> = { ...livePricesRef.current };
      const cIds = currentAssets.filter((a) => a.type === "core").map((a) => a.coingeckoId);
      const jSyms = currentAssets.filter((a) => a.type === "pumpfun" && a.jupiterId).map((a) => a.jupiterId!);
      const ncIds = currentAssets.filter((a) => a.type === "pumpfun" && !a.jupiterId).map((a) => a.coingeckoId);
      const fetched = await fetchAssetPrices([...cIds, ...ncIds], jSyms);
      for (const asset of currentAssets) {
        const p = fetched[asset.coingeckoId] || (asset.jupiterId ? fetched[asset.jupiterId] : 0);
        if (p && p > 0) {
          newPrices[asset.symbol] = p;
        }
      }
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
            // Resolve: use live price with realistic micro-movement
            // The cached API price may not have changed within a short round,
            // so we add small random drift to simulate real market movement.
            const basePrice = newPrices[m.asset.symbol] || m.entryPrice;
            const volatility = m.asset.symbol === "BTC" ? 0.001 : m.asset.symbol === "ETH" ? 0.0015 : 0.003;
            const drift = basePrice * (Math.random() - 0.5) * 2 * volatility;
            const finalPrice = basePrice + drift;
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

            // Process user bet payouts for this resolved market
            const currentUserBets = userBetsRef.current;
            const userBet = currentUserBets.find((b) => b.marketId === m.id);
            if (userBet) {
              const betSol = userBet.amount / 1_000_000_000;
              if (outcome === "refund") {
                // Refund the bet
                setDemoBalance((prev) => (prev ?? 0) + betSol);
                setLastPayout({ amount: betSol, won: false });
              } else if (userBet.side === outcome) {
                // Winner: payout = (totalPool * 0.98) * (userBet / winningPool)
                const winningPool = outcome === "up" ? m.upPool : m.downPool;
                const payoutLamports = winningPool > 0
                  ? ((m.totalPool * 0.98) * userBet.amount) / winningPool
                  : 0;
                const payoutSol = payoutLamports / 1_000_000_000;
                setDemoBalance((prev) => (prev ?? 0) + payoutSol);
                setLastPayout({ amount: payoutSol, won: true });
              } else {
                // Loser: bet already deducted, nothing to do
                setLastPayout({ amount: betSol, won: false });
              }
              // Remove this bet from tracking
              setUserBets((prev) => prev.filter((b) => b.marketId !== m.id));
            }

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

  // ── Place Bet (on-chain if wallet connected, otherwise local simulation) ──
  const placeBet = useCallback(
    async (marketId: string, side: "up" | "down", amount: number) => {
      const market = markets.find((m) => m.id === marketId);
      if (!market || market.phase !== "betting") return;

      const lamports = solToLamports(amount);

      // Optimistic UI update
      const applyBet = (wallet: string) => {
        const bet: MarketBet = {
          id: `${marketId}-${wallet}-${Date.now()}`,
          wallet,
          side,
          amount: lamports,
          timestamp: Math.floor(Date.now() / 1000),
        };
        setMarkets((prev) => {
          const idx = prev.findIndex((m) => m.id === marketId);
          if (idx === -1) return prev;
          const m = prev[idx];
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
      };

      // Helper: apply bet in simulation mode (deduct balance, track for payout)
      const applySimulatedBet = () => {
        const betSol = lamports / 1_000_000_000;

        // Check sufficient balance
        if (demoBalance !== null && betSol > demoBalance) {
          setTxError("Insufficient balance");
          return;
        }

        // Deduct from tracked balance
        if (demoBalance !== null) {
          setDemoBalance((prev) => (prev !== null ? prev - betSol : prev));
        }

        // Track user bet for payout on resolution
        setUserBets((prev) => [...prev, { marketId, side, amount: lamports }]);

        const walletLabel = wallet.publicKey
          ? wallet.publicKey.toBase58().slice(0, 4) + ".." + wallet.publicKey.toBase58().slice(-4)
          : "You";
        applyBet(walletLabel);
      };

      // Try on-chain first if program is available, fall back to simulation
      if (program && wallet.publicKey) {
        setTxPending(true);
        setTxError(null);

        try {
          const [roundPda] = deriveRoundPda(market.asset.symbol, market.roundNumber);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const roundAccount = await (program.account as any)["binaryRoundAccount"].fetch(roundPda);
          const totalBets = (roundAccount.totalBets as number) || 0;

          const [betPda] = deriveBetPda(roundPda, wallet.publicKey, totalBets);

          const sideArg = side === "up" ? { up: {} } : { down: {} };

          const tx = await program.methods
            .placeBet(sideArg as never, new BN(lamports))
            .accounts({
              round: roundPda,
              bet: betPda,
              user: wallet.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .rpc();

          console.log("Bet placed on-chain:", tx);
          applyBet(wallet.publicKey.toBase58().slice(0, 4) + ".." + wallet.publicKey.toBase58().slice(-4));
        } catch (err: unknown) {
          // On-chain failed (program not deployed) — fall back to simulation
          console.warn("On-chain bet unavailable, using simulation:", err instanceof Error ? err.message : err);
          applySimulatedBet();
        } finally {
          setTxPending(false);
        }
      } else {
        // No program/wallet — pure simulation
        applySimulatedBet();
      }
    },
    [markets, program, wallet.publicKey, demoBalance]
  );

  // ── Claim Winnings ──
  const claimWinnings = useCallback(
    async (marketId: string, betIndex: number) => {
      if (!program || !wallet.publicKey) {
        throw new Error("Wallet not connected");
      }

      const market = markets.find((m) => m.id === marketId);
      if (!market || market.phase !== "complete") {
        throw new Error("Round not complete");
      }

      setTxPending(true);
      setTxError(null);

      try {
        const [roundPda] = deriveRoundPda(market.asset.symbol, market.roundNumber);
        const [betPda] = deriveBetPda(roundPda, wallet.publicKey, betIndex);

        const tx = await program.methods
          .claimWinnings()
          .accounts({
            round: roundPda,
            bet: betPda,
            user: wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        console.log("Winnings claimed:", tx);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Claim failed:", msg);
        setTxError(msg);
        throw err;
      } finally {
        setTxPending(false);
      }
    },
    [markets, program, wallet.publicKey]
  );

  return { markets, assets, livePrices, placeBet, claimWinnings, roundHistory, loading, txPending, txError, demoBalance, userBets, lastPayout };
}
