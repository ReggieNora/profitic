"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  TradingAsset,
  CORE_ASSETS,
  discoverTrendingTokens,
  fetchAssetPrices,
  formatInterval,
} from "@/lib/tokenDiscovery";
import { useBinaryProgram, deriveRoundPda, deriveConfigPda, deriveBetPda, PYTH_FEEDS } from "./useBinaryProgram";

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

// No fallback prices — all prices come exclusively from Pyth Network

function solToLamports(sol: number): number {
  return Math.round(sol * 1_000_000_000);
}

// Map interval to an offset so each interval gets its own PDA namespace.
// The on-chain PDA seeds are [ROUND_SEED, asset, round_number] with no interval,
// so we encode the interval into the round number to avoid collisions.
const INTERVAL_OFFSETS: Record<number, number> = {
  60: 1_000_000,
  180: 2_000_000,
  300: 3_000_000,
  900: 4_000_000,
};

function onChainRoundNumber(localRound: number, interval: number): number {
  const offset = INTERVAL_OFFSETS[interval] ?? interval * 10_000;
  return offset + localRound;
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
    upPool: 0,
    downPool: 0,
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

  // Track rounds already resolved/attempted to avoid repeated wallet popups
  const resolvedRoundsRef = useRef<Set<string>>(new Set());

  // On-chain program access
  const { program } = useBinaryProgram();
  const wallet = useWallet();
  const { connection } = useConnection();

  // Refs so the tick loop can access current program/wallet without stale closures
  const programRef = useRef(program);
  programRef.current = program;


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

  // Client-only init: fetch real Pyth prices first, then create markets
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      // Discover trending tokens (non-blocking)
      const trending = await discoverTrendingTokens(3);
      const allAssets = [...CORE_ASSETS, ...trending];
      setAssets(allAssets);

      // Fetch all prices from Pyth (no fallbacks)
      const allIds = allAssets.map((a) => a.coingeckoId);
      const fetchedPrices = await fetchAssetPrices(allIds);

      const prices: Record<string, number> = {};
      for (const asset of allAssets) {
        const p = fetchedPrices[asset.coingeckoId];
        if (p && p > 0) {
          prices[asset.symbol] = p;
        }
      }
      setLivePrices(prices);

      // Create markets only for assets where we got a real Pyth price
      const now = Math.floor(Date.now() / 1000);
      const initialMarkets: BinaryMarket[] = [];

      for (const asset of allAssets) {
        const price = prices[asset.symbol];
        if (!price || price <= 0) continue; // skip assets without Pyth price
        for (const iv of asset.intervals) {
          const key = `${asset.symbol}-${iv}`;
          roundCounters.current[key] = 1;
          initialMarkets.push(createMarket(asset, iv, 1, price, now));
        }
      }

      setMarkets(initialMarkets);
      setLoading(false);
    };

    init();
  }, []);

  // Helper: process payouts + history after a market resolves (used by both on-chain and simulation paths)
  const processResolutionPayouts = (original: BinaryMarket, resolved: BinaryMarket) => {
    const outcome = resolved.outcome!;
    const finalPrice = resolved.finalPrice!;
    const fee = resolved.feeCollected;

    // Process user bet payouts
    const currentUserBets = userBetsRef.current;
    const userBet = currentUserBets.find((b) => b.marketId === original.id);
    if (userBet) {
      const betSol = userBet.amount / 1_000_000_000;
      if (outcome === "refund") {
        setDemoBalance((prev) => (prev ?? 0) + betSol);
        setLastPayout({ amount: betSol, won: false });
      } else if (userBet.side === outcome) {
        const winningPool = outcome === "up" ? original.upPool : original.downPool;
        const payoutLamports = winningPool > 0
          ? ((original.totalPool * 0.98) * userBet.amount) / winningPool
          : 0;
        const payoutSol = payoutLamports / 1_000_000_000;
        setDemoBalance((prev) => (prev ?? 0) + payoutSol);
        setLastPayout({ amount: payoutSol, won: true });
      } else {
        setLastPayout({ amount: betSol, won: false });
      }
      setUserBets((prev) => prev.filter((b) => b.marketId !== original.id));
    }

    // Save to round history
    const historyKey = `${original.asset.symbol}-${original.interval}`;
    const completedRound: CompletedRound = {
      id: original.id,
      asset: original.asset,
      interval: original.interval,
      intervalLabel: original.intervalLabel,
      roundNumber: original.roundNumber,
      entryPrice: original.entryPrice,
      finalPrice,
      outcome,
      upPool: original.upPool,
      downPool: original.downPool,
      totalPool: original.totalPool,
      feeCollected: fee,
      startTime: original.startTime,
      endTime: original.endTime,
      totalBets: original.bets.length,
    };
    setRoundHistory((prev) => {
      const existing = prev[historyKey] || [];
      return { ...prev, [historyKey]: [...existing, completedRound].slice(-50) };
    });

    // Clean up resolved-round tracking for this market
    resolvedRoundsRef.current.delete(original.id);

    // Schedule new round
    const key = `${original.asset.symbol}-${original.interval}`;
    const rn = (roundCounters.current[key] || 1) + 1;
    roundCounters.current[key] = rn;

    setTimeout(() => {
      setMarkets((p) => {
        const idx = p.findIndex((x) => x.id === original.id);
        if (idx === -1) return p;
        const price = livePricesRef.current[original.asset.symbol] || original.entryPrice;
        const newMarket = createMarket(
          original.asset,
          original.interval,
          rn,
          price,
          Math.floor(Date.now() / 1000)
        );
        const next = [...p];
        next[idx] = newMarket;
        return next;
      });
    }, 3000);
  };

  // Tick loop: update phases, simulate bets, resolve markets, start new rounds
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Math.floor(Date.now() / 1000);

      // Refresh prices from Pyth
      const currentAssets = assets;
      const newPrices: Record<string, number> = { ...livePricesRef.current };
      const allIds = currentAssets.map((a) => a.coingeckoId);
      const fetched = await fetchAssetPrices(allIds);
      for (const asset of currentAssets) {
        const p = fetched[asset.coingeckoId];
        if (p && p > 0) {
          newPrices[asset.symbol] = p;
        }
      }
      setLivePrices(newPrices);

      // Pre-scan: check on-chain state for rounds that have ended (read-only, no wallet popups)
      // Resolution transactions are NOT sent automatically — that's a cranker's job.
      // We only READ on-chain accounts to see if a cranker already resolved the round.
      const onChainResolutions: Record<string, BinaryMarket> = {};
      const currentProgram = programRef.current;
      // Use a snapshot of current markets (read via ref to avoid stale closure)
      const marketsSnapshot = markets;
      for (const m of marketsSnapshot) {
        if ((m.phase === "betting" || m.phase === "locked") && now >= m.endTime) {
          // Skip rounds we've already checked (prevents repeated RPC calls)
          if (resolvedRoundsRef.current.has(m.id)) continue;

          if (currentProgram) {
            try {
              resolvedRoundsRef.current.add(m.id);
              const [roundPda] = deriveRoundPda(m.asset.symbol, onChainRoundNumber(m.roundNumber, m.interval));
              // Read-only fetch — no wallet signature required
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const roundAccount = await (currentProgram.account as any)["binaryRoundAccount"].fetch(roundPda);
              const outcomeRaw = roundAccount.outcome;
              const isResolved = outcomeRaw && (outcomeRaw.up || outcomeRaw.down || outcomeRaw.refund);

              if (isResolved) {
                console.log(`Round ${m.id} resolved on-chain by cranker, fetching result...`);
                const endPriceRaw = (roundAccount.endPrice as { toNumber?: () => number });
                const endPrice = typeof endPriceRaw?.toNumber === "function" ? endPriceRaw.toNumber() : Number(endPriceRaw);
                const onChainOutcome: "up" | "down" | "refund" =
                  outcomeRaw?.up ? "up" : outcomeRaw?.down ? "down" : "refund";
                const feeRaw = (roundAccount.feeCollected as { toNumber?: () => number });
                const feeCollected = typeof feeRaw?.toNumber === "function" ? feeRaw.toNumber() : Number(feeRaw);

                onChainResolutions[m.id] = {
                  ...m,
                  phase: "complete",
                  finalPrice: endPrice > 0 ? endPrice / 1e8 : (newPrices[m.asset.symbol] || m.entryPrice),
                  outcome: onChainOutcome,
                  feeCollected,
                };
              } else {
                // Round exists on-chain but not yet resolved — let simulation handle it
                resolvedRoundsRef.current.delete(m.id);
              }
            } catch {
              // Round account doesn't exist on-chain — use simulation fallback
              resolvedRoundsRef.current.delete(m.id);
            }
          }
        }
      }

      setMarkets((prev) => {
        const updated = [...prev];
        let changed = false;

        for (let i = 0; i < updated.length; i++) {
          const m = updated[i];
          if (!m) continue;

          // Phase transitions (lock 2s early to account for clock skew with Solana)
          if (m.phase === "betting" && now >= m.lockTime - 2) {
            updated[i] = { ...m, phase: "locked" };
            changed = true;
            continue;
          }

          if ((m.phase === "betting" || m.phase === "locked") && now >= m.endTime) {
            // Use on-chain result if available, else simulate
            if (onChainResolutions[m.id]) {
              const resolved = onChainResolutions[m.id];
              updated[i] = resolved;
              changed = true;
              processResolutionPayouts(m, resolved);
              continue;
            }

            // Fallback: resolve using current live price vs entry price
            const finalPrice = newPrices[m.asset.symbol] || m.entryPrice;
            let outcome: "up" | "down" | "refund";
            if (finalPrice > m.entryPrice) outcome = "up";
            else if (finalPrice < m.entryPrice) outcome = "down";
            else outcome = "refund";

            const fee = Math.round(m.totalPool * 0.02);

            const resolvedMarket: BinaryMarket = {
              ...m,
              phase: "complete",
              finalPrice,
              outcome,
              feeCollected: fee,
            };
            updated[i] = resolvedMarket;
            changed = true;

            processResolutionPayouts(m, resolvedMarket);
            continue;
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
          const [roundPda] = deriveRoundPda(market.asset.symbol, onChainRoundNumber(market.roundNumber, market.interval));

          // Try to fetch the round account; if it doesn't exist, create it first
          let roundAccount;
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            roundAccount = await (program.account as any)["binaryRoundAccount"].fetch(roundPda);
          } catch {
            // Round doesn't exist on-chain — try to create it
            console.log("Round PDA not found, attempting to create on-chain...");
            const pythFeed = PYTH_FEEDS[market.asset.symbol];
            if (!pythFeed) {
              console.warn("No Pyth feed for", market.asset.symbol, "— falling back to simulation");
              applySimulatedBet();
              setTxPending(false);
              return;
            }
            const [configPda] = deriveConfigPda();
            try {
              await program.methods
                .createRound(
                  market.asset.symbol,
                  new BN(onChainRoundNumber(market.roundNumber, market.interval)),
                  new BN(market.interval),
                  new BN(LOCK_BUFFER_SECONDS),
                )
                .accounts({
                  round: roundPda,
                  config: configPda,
                  payer: wallet.publicKey,
                  pythFeed,
                  systemProgram: SystemProgram.programId,
                })
                .rpc();
              console.log("Round created on-chain successfully");
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              roundAccount = await (program.account as any)["binaryRoundAccount"].fetch(roundPda);
            } catch (createErr: unknown) {
              const createMsg = createErr instanceof Error ? createErr.message : String(createErr);
              console.warn("Failed to create round on-chain:", createMsg);
              applySimulatedBet();
              setTxPending(false);
              return;
            }
          }
          const totalBets = (roundAccount.totalBets as number) || 0;

          // Pre-flight: check on-chain round status before sending tx
          const outcomeRaw = roundAccount.outcome;
          const isResolved = outcomeRaw && (outcomeRaw.up || outcomeRaw.down || outcomeRaw.refund);
          if (isResolved) {
            setTxError("Round already resolved — wait for the next round");
            setTxPending(false);
            return;
          }

          const lockTime = (roundAccount.lockTime as { toNumber?: () => number });
          const onChainLock = typeof lockTime?.toNumber === "function" ? lockTime.toNumber() : Number(lockTime);
          const nowSec = Math.floor(Date.now() / 1000);
          if (onChainLock && nowSec >= onChainLock - 2) {
            // Within 2s of lock or past it — reject client-side to avoid on-chain error
            setTxError("Betting is locked — round is closing soon");
            setTxPending(false);
            return;
          }

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
          const errMsg = err instanceof Error ? err.message : String(err);

          // Check if user rejected the wallet signature request
          const isUserRejection = errMsg.includes("User rejected")
            || errMsg.includes("WalletSignTransactionError");

          if (isUserRejection) {
            console.log("User rejected transaction signing");
            setTxError("Transaction cancelled");
            setTxPending(false);
            return;
          }

          // Check for known on-chain program errors — surface them to the user
          const isProgramError = errMsg.includes("BettingLocked")
            || errMsg.includes("RoundNotBetting")
            || errMsg.includes("InvalidAmount")
            || errMsg.includes("AlreadyResolved")
            || errMsg.includes("InvalidPythFeed")
            || errMsg.includes("PythPriceTooOld")
            || errMsg.includes("6001")
            || errMsg.includes("6000")
            || errMsg.includes("6002")
            || errMsg.includes("6004")
            || errMsg.includes("6007")
            || errMsg.includes("6008");

          if (isProgramError) {
            console.error("On-chain bet rejected:", errMsg);
            setTxError(
              errMsg.includes("BettingLocked") || errMsg.includes("6001")
                ? "Betting is locked — round is closing soon"
                : errMsg.includes("RoundNotBetting") || errMsg.includes("6000")
                  ? "Round is not in betting phase"
                  : errMsg.includes("AlreadyResolved") || errMsg.includes("6004")
                    ? "Round already resolved — wait for the next round"
                    : errMsg.includes("InvalidPythFeed") || errMsg.includes("6007")
                      ? "Invalid Pyth price feed"
                      : errMsg.includes("PythPriceTooOld") || errMsg.includes("6008")
                        ? "Pyth price is too stale"
                        : "Bet rejected by program"
            );
          } else {
            // Program not deployed or network issue — fall back to simulation
            console.warn("On-chain bet unavailable, using simulation:", errMsg);
            applySimulatedBet();
          }
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
        const [roundPda] = deriveRoundPda(market.asset.symbol, onChainRoundNumber(market.roundNumber, market.interval));
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
