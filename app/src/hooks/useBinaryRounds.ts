"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  BinaryRound,
  BinaryBet,
  BinaryRoundPhase,
  CryptoAsset,
  BINARY_ROUND_DURATION,
  BINARY_LOCK_BUFFER,
} from "@/types";
import { fetchCryptoPrice } from "@/hooks/useCryptoPrice";

// No fallback prices — all prices come exclusively from Pyth Network

const ASSETS: CryptoAsset[] = ["BTC", "ETH", "SOL"];
const LOCK_BUFFER = 10; // 10 seconds lock period

function solToLamports(sol: number): number {
  return Math.round(sol * 1_000_000_000);
}

function alignToClockBoundary(nowSec: number, intervalSec: number): { startTime: number; endTime: number; lockTime: number } {
  const currentBoundary = Math.floor(nowSec / intervalSec) * intervalSec;
  const startTime = currentBoundary;
  const endTime = currentBoundary + intervalSec;
  const lockTime = endTime - LOCK_BUFFER;
  return { startTime, endTime, lockTime };
}

// ── Round state manager ──

interface UseBinaryRoundsReturn {
  rounds: Record<CryptoAsset, BinaryRound>;
  placeBet: (asset: CryptoAsset, side: "up" | "down", amount: number) => void;
  livePrices: Record<CryptoAsset, number>;
}

function createRound(
  asset: CryptoAsset,
  roundNumber: number,
  startPrice: number,
  now: number
): BinaryRound {
  const aligned = alignToClockBoundary(now, BINARY_ROUND_DURATION);
  const round: BinaryRound = {
    id: `${asset}-round-${roundNumber}`,
    asset,
    roundNumber,
    phase: "betting",
    duration: BINARY_ROUND_DURATION,
    lockBuffer: LOCK_BUFFER,
    startTime: aligned.startTime,
    endTime: aligned.endTime,
    lockTime: aligned.lockTime,
    startPrice,
    upPool: 0,
    downPool: 0,
    totalPool: 0,
    feeCollected: 0,
    bets: [],
  };
  console.log(`PYTH_START_PRICE: ${asset} round #${roundNumber} startPrice=${startPrice}`);
  return round;
}

async function fetchAllPrices(): Promise<Record<CryptoAsset, number>> {
  const results = await Promise.allSettled(
    ASSETS.map((asset) => fetchCryptoPrice(asset))
  );
  const prices: Record<string, number> = {};
  ASSETS.forEach((asset, i) => {
    const result = results[i];
    const price = result.status === "fulfilled" && result.value > 0
      ? result.value
      : 0;
    prices[asset] = price;
  });
  return prices as Record<CryptoAsset, number>;
}

export function useBinaryRounds(): UseBinaryRoundsReturn {
  const [rounds, setRounds] = useState<Record<CryptoAsset, BinaryRound>>(
    {} as Record<CryptoAsset, BinaryRound>
  );
  const [livePrices, setLivePrices] = useState<Record<CryptoAsset, number>>({
    BTC: 0,
    ETH: 0,
    SOL: 0,
  });
  const initialized = useRef(false);
  const roundNumbers = useRef<Record<CryptoAsset, number>>({
    BTC: 1,
    ETH: 1,
    SOL: 1,
  });
  // Use ref for livePrices inside the tick interval to avoid dependency issues
  const livePricesRef = useRef(livePrices);
  livePricesRef.current = livePrices;

  // Initialize rounds with live prices (parallel fetch)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      const prices = await fetchAllPrices();
      const now = Math.floor(Date.now() / 1000);
      const newRounds = {} as Record<CryptoAsset, BinaryRound>;

      for (const asset of ASSETS) {
        // Only create rounds with real Pyth prices — no fallbacks
        const price = prices[asset];
        if (price > 0) {
          newRounds[asset] = createRound(asset, 1, price, now);
        }
      }

      setLivePrices(prices);
      setRounds(newRounds);
    };

    init();
  }, []);

  // Locked final prices per round — once set, never changes
  const lockedFinalPrices = useRef<Record<string, number>>({});

  // Price refresh — runs every 3s
  useEffect(() => {
    const priceInterval = setInterval(async () => {
      const newPrices = await fetchAllPrices();
      const currentPrices = livePricesRef.current;
      for (const asset of ASSETS) {
        if (newPrices[asset] <= 0) {
          newPrices[asset] = currentPrices[asset];
        }
      }
      setLivePrices(newPrices);
    }, 3000);
    return () => clearInterval(priceInterval);
  }, []);

  // Tick: update phases, resolve rounds — runs every 1s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const newPrices = livePricesRef.current;

      setRounds((prev) => {
        const updated = { ...prev };
        let changed = false;

        for (const asset of ASSETS) {
          const round = updated[asset];
          if (!round) continue;

          // Update startPrice if it was 0 (API was slow on init)
          if (round.startPrice === 0 && newPrices[asset] > 0) {
            updated[asset] = { ...round, startPrice: newPrices[asset] };
            changed = true;
            continue;
          }

          // PHASE 3: Lock at lockTime (last 10 seconds)
          if (round.phase === "betting" && now >= round.lockTime) {
            console.log(`ROUND_END_TRIGGERED: ${asset} round #${round.roundNumber} entering LOCKED phase`);
            updated[asset] = { ...round, phase: "locked" };
            changed = true;
            continue;
          }

          // PHASE 1: Resolve at endTime
          if ((round.phase === "locked" || round.phase === "betting") && now >= round.endTime) {
            console.log(`RESOLVING_ROUND: ${asset} round #${round.roundNumber}`);

            // PHASE 5: Fetch final price ONCE and lock it
            const alreadyLocked = lockedFinalPrices.current[round.id];
            const endPrice = alreadyLocked ?? newPrices[asset] ?? round.startPrice;
            lockedFinalPrices.current[round.id] = endPrice;
            console.log(`PYTH_FINAL_PRICE_LOCKED: ${asset} round #${round.roundNumber} finalPrice=${endPrice}`);

            const outcome: "up" | "down" = endPrice >= round.startPrice ? "up" : "down";
            const fee = Math.round(round.totalPool * 0.02);

            updated[asset] = {
              ...round,
              phase: "complete",
              endPrice,
              outcome,
              feeCollected: fee,
            };
            changed = true;

            console.log(`ROUND_RESOLVED: ${asset} round #${round.roundNumber} outcome=${outcome} finalPrice=${endPrice} startPrice=${round.startPrice}`);

            // Clean up locked price
            delete lockedFinalPrices.current[round.id];

            const rn = roundNumbers.current[asset] + 1;
            roundNumbers.current[asset] = rn;

            setTimeout(() => {
              setRounds((p) => {
                const nextRound = createRound(
                  asset,
                  rn,
                  newPrices[asset] || endPrice,
                  Math.floor(Date.now() / 1000)
                );
                return { ...p, [asset]: nextRound };
              });
            }, 3000);
          }
        }

        return changed ? updated : prev;
      });
    }, 1000); // 1-second tick for responsive resolution

    return () => clearInterval(interval);
  }, []); // stable interval

  const placeBet = useCallback(
    (asset: CryptoAsset, side: "up" | "down", amount: number) => {
      setRounds((prev) => {
        const round = prev[asset];
        if (!round || round.phase !== "betting") return prev;

        const lamports = solToLamports(amount);
        const bet: BinaryBet = {
          id: `${round.id}-user-${Date.now()}`,
          roundId: round.id,
          wallet: "You",
          side,
          amount: lamports,
          timestamp: Math.floor(Date.now() / 1000),
        };

        return {
          ...prev,
          [asset]: {
            ...round,
            bets: [...round.bets, bet],
            upPool: round.upPool + (side === "up" ? lamports : 0),
            downPool: round.downPool + (side === "down" ? lamports : 0),
            totalPool: round.totalPool + lamports,
          },
        };
      });
    },
    []
  );

  return { rounds, placeBet, livePrices };
}
