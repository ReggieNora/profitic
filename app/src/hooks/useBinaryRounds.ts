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

function solToLamports(sol: number): number {
  return Math.round(sol * 1_000_000_000);
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
  const round: BinaryRound = {
    id: `${asset}-round-${roundNumber}`,
    asset,
    roundNumber,
    phase: "betting",
    duration: BINARY_ROUND_DURATION,
    lockBuffer: BINARY_LOCK_BUFFER,
    startTime: now,
    endTime: now + BINARY_ROUND_DURATION,
    lockTime: now + BINARY_ROUND_DURATION - BINARY_LOCK_BUFFER,
    startPrice,
    upPool: 0,
    downPool: 0,
    totalPool: 0,
    feeCollected: 0,
    bets: [],
  };
  round.totalPool = round.upPool + round.downPool;
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

  // Tick: update phases, resolve rounds, start new ones, simulate bets
  // No dependency on livePrices — uses ref instead to keep interval stable
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Math.floor(Date.now() / 1000);

      // Fetch live prices in parallel
      const newPrices = await fetchAllPrices();
      // Merge: keep previous price if new fetch returned 0
      const currentPrices = livePricesRef.current;
      for (const asset of ASSETS) {
        if (newPrices[asset] <= 0) {
          newPrices[asset] = currentPrices[asset];
        }
      }
      setLivePrices(newPrices);

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

          let newPhase: BinaryRoundPhase = round.phase;

          if (round.phase === "betting" && now >= round.lockTime) {
            newPhase = "locked";
          }
          if (
            (round.phase === "locked" || round.phase === "betting") &&
            now >= round.endTime
          ) {
            newPhase = "resolving";
          }

          if (newPhase === "resolving" && round.phase !== "complete") {
            const endPrice = newPrices[asset] || round.startPrice;
            const outcome: "up" | "down" =
              endPrice >= round.startPrice ? "up" : "down";
            const fee = Math.round(round.totalPool * 0.02);

            updated[asset] = {
              ...round,
              phase: "complete",
              endPrice,
              outcome,
              feeCollected: fee,
            };
            changed = true;

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
          } else if (newPhase !== round.phase) {
            updated[asset] = { ...round, phase: newPhase };
            changed = true;
          }

        }

        return changed ? updated : prev;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []); // stable interval — no livePrices dependency

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
