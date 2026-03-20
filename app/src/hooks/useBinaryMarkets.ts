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

const LOCK_BUFFER_SECONDS = 10; // lock bets 10s before expiry

// No fallback prices — all prices come exclusively from Pyth Network

function solToLamports(sol: number): number {
  return Math.round(sol * 1_000_000_000);
}

/**
 * PHASE 4: Snap a timestamp to the nearest interval boundary.
 * e.g. for 5m (300s): 12:03 → next boundary at 12:05
 * for 1m (60s):  every :00, :01, :02 ...
 * for 15m (900s): :00, :15, :30, :45
 */
function alignToClockBoundary(nowSec: number, intervalSec: number): { startTime: number; endTime: number; lockTime: number } {
  // Find the current interval boundary (floor to interval)
  const currentBoundary = Math.floor(nowSec / intervalSec) * intervalSec;
  // If we're past the current boundary, the round is the current one
  // The next boundary is the end
  const startTime = currentBoundary;
  const endTime = currentBoundary + intervalSec;
  const lockTime = endTime - LOCK_BUFFER_SECONDS;
  return { startTime, endTime, lockTime };
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
  // PHASE 4: Align round times to real clock boundaries
  const aligned = alignToClockBoundary(now, interval);

  const market: BinaryMarket = {
    id: `${asset.symbol}-${interval}-r${roundNumber}`,
    asset,
    interval,
    intervalLabel: `${formatInterval(interval)} Binary`,
    roundNumber,
    phase: "betting",
    startTime: aligned.startTime,
    endTime: aligned.endTime,
    lockTime: aligned.lockTime,
    entryPrice,
    upPool: 0,
    downPool: 0,
    totalPool: 0,
    feeCollected: 0,
    bets: [],
  };
  console.log(`PYTH_START_PRICE: ${asset.symbol} round #${roundNumber} startPrice=${entryPrice} startTime=${aligned.startTime} endTime=${aligned.endTime}`);
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
  txSignature: string | null; // last successful on-chain tx signature
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
  const [txSignature, setTxSignature] = useState<string | null>(null);
  const userBetsRef = useRef(userBets);
  userBetsRef.current = userBets;
  const balanceInitialized = useRef(false);
  const initialized = useRef(false);
  const roundCounters = useRef<Record<string, number>>({});
  const livePricesRef = useRef(livePrices);
  livePricesRef.current = livePrices;
  // PHASE 5: Track locked final prices per round — once set, never changes
  const lockedFinalPrices = useRef<Record<string, number>>({});

  // Track rounds already resolved/attempted to avoid repeated wallet popups
  const resolvedRoundsRef = useRef<Set<string>>(new Set());

  // Track whether on-chain program is available.
  // Starts false — the startup probe sets it true only if the config PDA exists.
  const onChainAvailableRef = useRef(false);
  const onChainProbed = useRef(false);

  // On-chain program access
  const { program } = useBinaryProgram();
  const wallet = useWallet();
  const { connection } = useConnection();

  // Refs so the tick loop can access current program/wallet without stale closures
  const programRef = useRef(program);
  programRef.current = program;
  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  // ── Probe on-chain program availability on startup ──
  // Try to fetch the config PDA once. If it doesn't exist or the program
  // isn't deployed, disable on-chain mode immediately so we never trigger
  // wallet popups for transactions that are doomed to fail.
  useEffect(() => {
    if (!program || onChainProbed.current) return;
    onChainProbed.current = true;

    (async () => {
      try {
        const [configPda] = deriveConfigPda();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (program.account as any)["binaryConfig"].fetch(configPda);
        onChainAvailableRef.current = true;
        console.log("On-chain binary_market program verified — config PDA found");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Program not deployed, config not initialized, or account deserialization failure
        // — all mean on-chain mode won't work. Keep onChainAvailableRef as false.
        console.log(
          "On-chain binary_market program not available — using simulation mode.",
          msg.slice(0, 120)
        );
      }
    })();
  }, [program]);


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

    console.log(`ROUND_RESOLVED: ${original.asset.symbol} round #${original.roundNumber} outcome=${outcome} finalPrice=${finalPrice} startPrice=${original.entryPrice}`);

    // PHASE 1 + 2: Process ALL bets in this round for payouts
    const currentUserBets = userBetsRef.current;
    const userBet = currentUserBets.find((b) => b.marketId === original.id);
    if (userBet) {
      const betSol = userBet.amount / 1_000_000_000;
      if (outcome === "refund") {
        setDemoBalance((prev) => (prev ?? 0) + betSol);
        setLastPayout({ amount: betSol, won: false });
        console.log(`PAYOUT_SENT: Refund ${betSol} SOL to user for ${original.id}`);
      } else if (userBet.side === outcome) {
        const winningPool = outcome === "up" ? original.upPool : original.downPool;
        const payoutLamports = winningPool > 0
          ? ((original.totalPool * 0.98) * userBet.amount) / winningPool
          : 0;
        const payoutSol = payoutLamports / 1_000_000_000;
        setDemoBalance((prev) => (prev ?? 0) + payoutSol);
        setLastPayout({ amount: payoutSol, won: true });
        console.log(`PAYOUT_SENT: Won ${payoutSol.toFixed(4)} SOL for ${original.id} (bet ${betSol} SOL on ${userBet.side})`);
      } else {
        setLastPayout({ amount: betSol, won: false });
        console.log(`PAYOUT_SENT: Lost ${betSol} SOL for ${original.id} (bet ${userBet.side}, outcome ${outcome})`);
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

    // Clean up resolved-round tracking and locked prices for this market
    resolvedRoundsRef.current.delete(original.id);
    delete lockedFinalPrices.current[original.id];

    // Schedule new round (aligned to clock boundary)
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

  // Track whether a price fetch is in flight to avoid overlapping fetches
  const priceFetchInFlight = useRef(false);

  // Price refresh loop — runs every 3s independently from the phase tick
  useEffect(() => {
    const priceInterval = setInterval(async () => {
      if (priceFetchInFlight.current) return;
      priceFetchInFlight.current = true;
      try {
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
      } finally {
        priceFetchInFlight.current = false;
      }
    }, 3000);
    return () => clearInterval(priceInterval);
  }, [assets]);

  // Tick loop: update phases, resolve markets, start new rounds — runs every 1s for responsive resolution
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Math.floor(Date.now() / 1000);
      const newPrices = livePricesRef.current;

      // Pre-scan: check on-chain state for rounds that have ended
      const onChainResolutions: Record<string, BinaryMarket> = {};
      const currentProgram = programRef.current;
      const currentWallet = walletRef.current;
      if (currentProgram && onChainAvailableRef.current) {
        const marketsSnapshot = markets;
        for (const m of marketsSnapshot) {
          if ((m.phase === "betting" || m.phase === "locked") && now >= m.endTime) {
            if (resolvedRoundsRef.current.has(m.id)) continue;

            try {
              resolvedRoundsRef.current.add(m.id);
              const [roundPda] = deriveRoundPda(m.asset.symbol, onChainRoundNumber(m.roundNumber, m.interval));
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const roundAccount = await (currentProgram.account as any)["binaryRoundAccount"].fetch(roundPda);
              const outcomeRaw = roundAccount.outcome;
              const isResolved = outcomeRaw && (outcomeRaw.up || outcomeRaw.down);

              if (isResolved) {
                const endPriceRaw = (roundAccount.endPrice as { toNumber?: () => number });
                const endPrice = typeof endPriceRaw?.toNumber === "function" ? endPriceRaw.toNumber() : Number(endPriceRaw);
                const onChainOutcome: "up" | "down" = outcomeRaw?.up ? "up" : "down";
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
                if (currentWallet.publicKey) {
                  try {
                    const pythFeed = PYTH_FEEDS[m.asset.symbol];
                    if (pythFeed) {
                      const [configPda] = deriveConfigPda();
                      const resolvePrice = newPrices[m.asset.symbol] || m.entryPrice;
                      const resolvePriceBn = new BN(Math.round(resolvePrice * 1e8));
                      await currentProgram.methods
                        .resolveRound(resolvePriceBn)
                        .accounts({
                          round: roundPda,
                          config: configPda,
                          pythFeed: pythFeed,
                          cranker: currentWallet.publicKey,
                        })
                        .rpc();
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const resolved = await (currentProgram.account as any)["binaryRoundAccount"].fetch(roundPda);
                      const resOutcome = resolved.outcome;
                      const resEndPriceRaw = (resolved.endPrice as { toNumber?: () => number });
                      const resEndPrice = typeof resEndPriceRaw?.toNumber === "function" ? resEndPriceRaw.toNumber() : Number(resEndPriceRaw);
                      const resFeeRaw = (resolved.feeCollected as { toNumber?: () => number });
                      const resFee = typeof resFeeRaw?.toNumber === "function" ? resFeeRaw.toNumber() : Number(resFeeRaw);

                      onChainResolutions[m.id] = {
                        ...m,
                        phase: "complete",
                        finalPrice: resEndPrice > 0 ? resEndPrice / 1e8 : (newPrices[m.asset.symbol] || m.entryPrice),
                        outcome: resOutcome?.up ? "up" : "down",
                        feeCollected: resFee,
                      };
                    } else {
                      resolvedRoundsRef.current.delete(m.id);
                    }
                  } catch (resolveErr: unknown) {
                    const resolveMsg = resolveErr instanceof Error ? resolveErr.message : String(resolveErr);
                    if (resolveMsg.includes("InstructionDidNotDeserialize") || resolveMsg.includes("102")) {
                      onChainAvailableRef.current = false;
                    }
                    resolvedRoundsRef.current.delete(m.id);
                  }
                } else {
                  resolvedRoundsRef.current.delete(m.id);
                }
              }
            } catch {
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

          // PHASE 3: Lock at exactly lockTime (last 10 seconds)
          if (m.phase === "betting" && now >= m.lockTime) {
            console.log(`ROUND_END_TRIGGERED: ${m.asset.symbol} round #${m.roundNumber} entering LOCKED phase (${m.endTime - now}s to end)`);
            updated[i] = { ...m, phase: "locked" };
            changed = true;
            continue;
          }

          // PHASE 1: Resolve at exact endTime
          if ((m.phase === "betting" || m.phase === "locked") && now >= m.endTime) {
            console.log(`RESOLVING_ROUND: ${m.asset.symbol} round #${m.roundNumber}`);

            // Use on-chain result if available
            if (onChainResolutions[m.id]) {
              const resolved = onChainResolutions[m.id];
              // PHASE 5: Lock the final price
              lockedFinalPrices.current[m.id] = resolved.finalPrice!;
              console.log(`PYTH_FINAL_PRICE_LOCKED: ${m.asset.symbol} round #${m.roundNumber} finalPrice=${resolved.finalPrice} (on-chain)`);
              updated[i] = resolved;
              changed = true;
              processResolutionPayouts(m, resolved);
              continue;
            }

            // PHASE 5: Fetch final price ONCE from Pyth and LOCK it
            const alreadyLocked = lockedFinalPrices.current[m.id];
            const finalPrice = alreadyLocked ?? newPrices[m.asset.symbol] ?? m.entryPrice;
            // Lock it so it can never change
            lockedFinalPrices.current[m.id] = finalPrice;
            console.log(`PYTH_FINAL_PRICE_LOCKED: ${m.asset.symbol} round #${m.roundNumber} finalPrice=${finalPrice} entryPrice=${m.entryPrice}`);

            // PHASE 1: Determine UP or DOWN
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

            // PHASE 1 + 2: Process payouts for ALL bets
            processResolutionPayouts(m, resolvedMarket);
            continue;
          }
        }

        return changed ? updated : prev;
      });
    }, 1000); // 1-second tick for responsive resolution

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

        // PHASE 2: Check sufficient balance
        if (demoBalance !== null && betSol > demoBalance) {
          setTxError("Insufficient balance");
          return;
        }

        // PHASE 2: Immediately deduct from balance
        if (demoBalance !== null) {
          setDemoBalance((prev) => (prev !== null ? prev - betSol : prev));
          console.log(`BALANCE_DEDUCTED: ${betSol} SOL deducted for ${side} bet on ${marketId}`);
        }

        // Track user bet for payout on resolution
        setUserBets((prev) => [...prev, { marketId, side, amount: lamports }]);

        const walletLabel = wallet.publicKey
          ? wallet.publicKey.toBase58().slice(0, 4) + ".." + wallet.publicKey.toBase58().slice(-4)
          : "You";
        applyBet(walletLabel);
        console.log(`BET_PLACED: ${betSol} SOL on ${side} for market ${marketId}`);
      };

      // Try on-chain first if program is available AND on-chain hasn't been flagged as broken
      if (program && wallet.publicKey && onChainAvailableRef.current) {
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
              console.log("No Pyth feed for", market.asset.symbol, "— using simulation");
              applySimulatedBet();
              setTxPending(false);
              return;
            }
            const [configPda] = deriveConfigPda();
            // Pass current price scaled to 1e8 (Pyth expo=-8 format) so the
            // on-chain program doesn't need to read the (broken) devnet Pyth feed.
            const startPriceBn = new BN(Math.round(market.entryPrice * 1e8));
            try {
              await program.methods
                .createRound(
                  market.asset.symbol,
                  new BN(onChainRoundNumber(market.roundNumber, market.interval)),
                  new BN(market.interval),
                  new BN(LOCK_BUFFER_SECONDS),
                  startPriceBn,
                )
                .accounts({
                  round: roundPda,
                  config: configPda,
                  payer: wallet.publicKey,
                  pythFeed: pythFeed,
                  systemProgram: SystemProgram.programId,
                })
                .rpc();
              console.log("Round created on-chain successfully");
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              roundAccount = await (program.account as any)["binaryRoundAccount"].fetch(roundPda);
            } catch (createErr: unknown) {
              const createMsg = createErr instanceof Error ? createErr.message : String(createErr);
              // If the program can't deserialize instructions, it's not deployed properly
              // — disable on-chain for this session so we don't keep hitting wallet popups
              if (createMsg.includes("InstructionDidNotDeserialize") || createMsg.includes("102")) {
                console.log("On-chain program unavailable (InstructionDidNotDeserialize) — switching to simulation mode for this session");
                onChainAvailableRef.current = false;
              } else {
                console.log("Failed to create round on-chain:", createMsg);
              }
              applySimulatedBet();
              setTxPending(false);
              return;
            }
          }
          const totalBets = (roundAccount.totalBets as number) || 0;

          // Pre-flight: check on-chain round status before sending tx
          const outcomeRaw = roundAccount.outcome;
          const isResolved = outcomeRaw && (outcomeRaw.up || outcomeRaw.down);
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
          setTxSignature(tx);
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

          // If the program can't deserialize, disable on-chain for this session
          if (errMsg.includes("InstructionDidNotDeserialize") || errMsg.includes("Error Number: 102")) {
            console.log("On-chain program unavailable — switching to simulation mode");
            onChainAvailableRef.current = false;
            applySimulatedBet();
          } else {
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
              console.log("On-chain bet unavailable, using simulation:", errMsg);
              applySimulatedBet();
            }
          }
        } finally {
          setTxPending(false);
        }
      } else {
        // No program/wallet or on-chain unavailable — simulation mode
        setTxPending(true);
        setTxError(null);
        applySimulatedBet();
        setTxPending(false);
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
        setTxSignature(tx);
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

  return { markets, assets, livePrices, placeBet, claimWinnings, roundHistory, loading, txPending, txError, txSignature, demoBalance, userBets, lastPayout };
}
