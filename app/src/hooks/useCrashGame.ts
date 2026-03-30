import { useState, useCallback, useEffect } from 'react';

export type RoundStatus = "OPEN" | "LOCKED" | "RUNNING" | "ENDED";

export interface CrashBet {
  id: string;
  user: string;
  amount: number;
  targetMultiplier: number;
  payout: number;
  isWinner: boolean;
}

export interface CrashRound {
  roundId: string;
  status: RoundStatus;
  totalPot: number;
  feeAmount: number;
  payoutPool: number;
  crashMultiplier: number;
  bets: CrashBet[];
}

const FEE_PERCENTAGE = 0.03; // 3% Platform Fee
const MIN_MULTIPLIER = 1.0;

export function useCrashGame() {
  const [round, setRound] = useState<CrashRound>({
    roundId: `round-${Date.now()}`,
    status: "OPEN",
    totalPot: 0,
    feeAmount: 0,
    payoutPool: 0,
    crashMultiplier: MIN_MULTIPLIER,
    bets: []
  });

  const [currentMultiplier, setCurrentMultiplier] = useState(MIN_MULTIPLIER);
  const [userBalances, setUserBalances] = useState<Record<string, number>>({});

  // ----------------------------------------
  // PHASE 1 — BETTING
  // ----------------------------------------
  const placeBet = useCallback((user: string, amount: number, targetMultiplier: number) => {
    setRound(prev => {
      // PHASE 6: SAFETY RULES - Prevent bets after LOCKED state
      if (prev.status !== "OPEN") {
        console.warn("Safety Rule: Prevent bets after LOCKED state");
        return prev;
      }
      
      const newBet: CrashBet = {
        id: Math.random().toString(36).substring(7),
        user,
        amount,
        targetMultiplier,
        payout: 0,
        isWinner: false
      };

      // Deduct from balance
      setUserBalances(b => ({ ...b, [user]: (b[user] || 1000) - amount }));

      return {
        ...prev,
        totalPot: prev.totalPot + amount,
        bets: [...prev.bets, newBet]
      };
    });
  }, []);

  // ----------------------------------------
  // PHASE 2 & 3 — LOCK ROUND & PRECOMPUTE CRASH
  // ----------------------------------------
  const lockAndPrecompute = useCallback(() => {
    setRound(prev => {
      if (prev.status !== "OPEN") return prev;

      console.log("ROUND_LOCKED");

      // 1. Apply platform fee
      const feeAmount = prev.totalPot * FEE_PERCENTAGE;
      let payoutPool = prev.totalPot - feeAmount;
      
      // 2. Sort bets by targetMultiplier ASCENDING
      const sortedBets = [...prev.bets].sort((a, b) => a.targetMultiplier - b.targetMultiplier);
      
      let crashMultiplier = MIN_MULTIPLIER;
      
      // ----------------------------------------
      // PHASE 3 — PRECOMPUTE CRASH
      // ----------------------------------------
      for (let i = 0; i < sortedBets.length; i++) {
        const bet = sortedBets[i];
        const requiredPayout = bet.amount * bet.targetMultiplier;
        
        // If payoutPool >= payout: mark bet as winner
        if (payoutPool >= requiredPayout) {
          sortedBets[i].isWinner = true;
          sortedBets[i].payout = requiredPayout;
          payoutPool -= requiredPayout;
        } else {
          // ELSE: crashMultiplier = current bet's targetMultiplier, STOP simulation
          crashMultiplier = bet.targetMultiplier;
          break;
        }

        // If all bets are payable: crashMultiplier = highest targetMultiplier
        if (i === sortedBets.length - 1) {
          crashMultiplier = bet.targetMultiplier;
        }
      }

      console.log("CRASH_CALCULATED");
      console.log("CRASH_MULTIPLIER", crashMultiplier.toFixed(2));

      return {
        ...prev,
        status: "LOCKED",
        feeAmount,
        payoutPool: prev.totalPot - feeAmount,
        crashMultiplier,
        bets: sortedBets
      };
    });
  }, []);

  // ----------------------------------------
  // PHASE 4 — RUN ROUND (VISUAL ONLY)
  // ----------------------------------------
  const runRound = useCallback(() => {
    setRound(prev => {
      if (prev.status !== "LOCKED") return prev;
      console.log("ROUND_STARTED");
      return { ...prev, status: "RUNNING" };
    });
  }, []);

  useEffect(() => {
    if (round.status !== "RUNNING") return;

    let tick = MIN_MULTIPLIER;
    const interval = setInterval(() => {
      // Increment smoothly (UI animation only)
      tick += 0.01 * tick;
      
      // When multiplier reaches crashMultiplier: trigger crash event, end round
      if (tick >= round.crashMultiplier) {
        tick = round.crashMultiplier;
        clearInterval(interval);
        setCurrentMultiplier(tick);
        
        console.log("ROUND_CRASHED");
        
        setRound(prev => ({ ...prev, status: "ENDED" }));
      } else {
        setCurrentMultiplier(tick);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [round.status, round.crashMultiplier]);

  // ----------------------------------------
  // PHASE 5 — RESOLUTION
  // ----------------------------------------
  useEffect(() => {
    if (round.status === "ENDED") {
      setUserBalances(balances => {
        const nextBalances = { ...balances };
        
        for (const bet of round.bets) {
          // SAFETY RULE: To strictly satisfy "never allow payouts > total pot" AND 
          // perfectly align with the deterministic Precompute (Phase 3), we use 
          // the securely pre-calculated `isWinner` property. If it ran out of money 
          // PRECISELY at this multiplier, `isWinner` reliably handles the true outcome.
          if (bet.isWinner) {
            nextBalances[bet.user] = (nextBalances[bet.user] || 0) + bet.payout;
          }
        }
        
        return nextBalances;
      });
      console.log("PAYOUTS_COMPLETE");
    }
  }, [round.status, round.bets]);

  // Handle next round reset
  const resetRound = useCallback(() => {
    if (round.status !== "ENDED") return;
    setRound({
      roundId: `round-${Date.now()}`,
      status: "OPEN",
      totalPot: 0,
      feeAmount: 0,
      payoutPool: 0,
      crashMultiplier: MIN_MULTIPLIER,
      bets: []
    });
    setCurrentMultiplier(MIN_MULTIPLIER);
  }, [round.status]);

  return {
    round,
    currentMultiplier,
    userBalances,
    placeBet,
    lockAndPrecompute,
    runRound,
    resetRound,
    // Helper to fund user for testing
    fundWallet: (user: string, amount: number) => setUserBalances(b => ({...b, [user]: (b[user] || 0) + amount}))
  };
}
