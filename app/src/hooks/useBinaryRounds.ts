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

// ── Simulated demo wallets for activity feed ──
const DEMO_WALLETS = [
  "7xKz..aF9p", "3mRq..bT2x", "9pLw..cK4d", "5nHv..dM8s",
  "2jBx..eP6w", "8tGs..fR1y", "4vCn..gU3q", "6wDm..hV5r",
  "1kAf..iW7t", "0sEh..jX9u",
];

function randomWallet(): string {
  return DEMO_WALLETS[Math.floor(Math.random() * DEMO_WALLETS.length)];
}

function randomBetAmount(): number {
  const amounts = [0.1, 0.2, 0.5, 1, 2, 5, 10];
  return amounts[Math.floor(Math.random() * amounts.length)];
}

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
  return {
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
    upPool: solToLamports(25 + Math.random() * 50), // seed with some demo liquidity
    downPool: solToLamports(25 + Math.random() * 50),
    totalPool: 0, // computed below
    feeCollected: 0,
    bets: [],
  };
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

  // Initialize rounds with live prices
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const init = async () => {
      const assets: CryptoAsset[] = ["BTC", "ETH", "SOL"];
      const prices: Record<string, number> = {};
      const newRounds: Record<string, BinaryRound> = {} as Record<CryptoAsset, BinaryRound>;
      const now = Math.floor(Date.now() / 1000);

      for (const asset of assets) {
        const price = await fetchCryptoPrice(asset);
        prices[asset] = price;
        const round = createRound(asset, 1, price, now);
        round.totalPool = round.upPool + round.downPool;
        newRounds[asset] = round;
      }

      setLivePrices(prices as Record<CryptoAsset, number>);
      setRounds(newRounds as Record<CryptoAsset, BinaryRound>);
    };

    init();
  }, []);

  // Tick: update phases, resolve rounds, start new ones, simulate bets
  useEffect(() => {
    const interval = setInterval(async () => {
      const now = Math.floor(Date.now() / 1000);

      // Fetch live prices
      const assets: CryptoAsset[] = ["BTC", "ETH", "SOL"];
      const newPrices = { ...livePrices };
      for (const asset of assets) {
        const p = await fetchCryptoPrice(asset);
        if (p > 0) newPrices[asset] = p;
      }
      setLivePrices(newPrices);

      setRounds((prev) => {
        const updated = { ...prev };
        let changed = false;

        for (const asset of assets) {
          const round = updated[asset];
          if (!round) continue;

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
            // Resolve the round
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

            // Start next round after short delay
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
                nextRound.totalPool = nextRound.upPool + nextRound.downPool;
                return { ...p, [asset]: nextRound };
              });
            }, 3000); // 3 second pause between rounds
          } else if (newPhase !== round.phase) {
            updated[asset] = { ...round, phase: newPhase };
            changed = true;
          }

          // Simulate random bets during betting phase
          if (
            round.phase === "betting" &&
            Math.random() < 0.3 // ~30% chance each tick
          ) {
            const side: "up" | "down" = Math.random() > 0.5 ? "up" : "down";
            const amount = solToLamports(randomBetAmount());
            const bet: BinaryBet = {
              id: `${round.id}-bet-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              roundId: round.id,
              wallet: randomWallet(),
              side,
              amount,
              timestamp: now,
            };

            const r = updated[asset];
            updated[asset] = {
              ...r,
              bets: [...r.bets.slice(-49), bet], // keep last 50
              upPool: r.upPool + (side === "up" ? amount : 0),
              downPool: r.downPool + (side === "down" ? amount : 0),
              totalPool:
                r.upPool +
                r.downPool +
                amount,
            };
            changed = true;
          }
        }

        return changed ? updated : prev;
      });
    }, 3000); // every 3 seconds

    return () => clearInterval(interval);
  }, [livePrices]);

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
