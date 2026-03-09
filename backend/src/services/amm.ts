/**
 * Profitic Backend — Automated Market Maker (AMM) Engine
 *
 * Implements a constant-product AMM where:
 *   - Probability is derived from pool ratios: P(YES) = yes_pool / (yes_pool + no_pool)
 *   - Every trade charges a 2% protocol fee
 *   - Creator liquidity is locked until market resolution
 *
 * The AMM ensures that:
 *   - Buying YES increases the YES pool, shifting probability up
 *   - Buying NO increases the NO pool, shifting probability down
 *   - Fees are split: protocol treasury receives 2% of every trade
 */

import { PROTOCOL_FEE_BPS, FEE_DENOMINATOR } from "../models/types";

// ---------------------------------------------------------------------------
// AMM Pricing
// ---------------------------------------------------------------------------

/**
 * Compute probabilities from AMM pool balances.
 *
 * P(YES) = yes_pool / (yes_pool + no_pool)
 * P(NO)  = no_pool  / (yes_pool + no_pool)
 */
export function computeAmmPrices(
  yesPool: bigint,
  noPool: bigint,
): { yesPrice: number; noPrice: number } {
  const total = yesPool + noPool;
  if (total === 0n) return { yesPrice: 0.5, noPrice: 0.5 };

  const yesPrice = parseFloat((Number(yesPool) / Number(total)).toFixed(6));
  const noPrice = parseFloat((1 - yesPrice).toFixed(6));
  return { yesPrice, noPrice };
}

/**
 * Calculate the protocol fee for a given trade amount.
 * Fee = amount * PROTOCOL_FEE_BPS / FEE_DENOMINATOR
 *
 * @returns { netAmount, feeAmount } both in lamports
 */
export function calculateProtocolFee(grossAmount: bigint): {
  netAmount: bigint;
  feeAmount: bigint;
} {
  const feeAmount = (grossAmount * BigInt(PROTOCOL_FEE_BPS)) / BigInt(FEE_DENOMINATOR);
  const netAmount = grossAmount - feeAmount;
  return { netAmount, feeAmount };
}

/**
 * Simulate a buy trade on the AMM.
 *
 * When a user bets on YES:
 *   1. 2% fee is deducted from their bet amount
 *   2. Net amount goes into the YES pool
 *   3. Probability shifts: YES pool grows, so P(YES) increases
 *
 * When a user bets on NO:
 *   1. 2% fee is deducted from their bet amount
 *   2. Net amount goes into the NO pool
 *   3. Probability shifts: NO pool grows, so P(NO) increases
 *
 * @returns Updated pool balances, fee, and new prices
 */
export function simulateBuy(
  yesPool: bigint,
  noPool: bigint,
  outcome: "yes" | "no",
  grossAmount: bigint,
): {
  newYesPool: bigint;
  newNoPool: bigint;
  netAmount: bigint;
  feeAmount: bigint;
  yesPrice: number;
  noPrice: number;
  sharesReceived: bigint;
} {
  const { netAmount, feeAmount } = calculateProtocolFee(grossAmount);

  let newYesPool = yesPool;
  let newNoPool = noPool;

  // Constant-product: user gets shares proportional to their contribution
  // shares = (netAmount * oppositePool) / (samePool + netAmount)
  // This is the standard x*y=k AMM formula for token output
  let sharesReceived: bigint;

  if (outcome === "yes") {
    // Buying YES: add to YES pool
    const totalPool = yesPool + noPool;
    if (totalPool === 0n) {
      sharesReceived = netAmount;
    } else {
      // Shares proportional to contribution relative to total pool
      sharesReceived = (netAmount * totalPool) / yesPool;
    }
    newYesPool = yesPool + netAmount;
  } else {
    const totalPool = yesPool + noPool;
    if (totalPool === 0n) {
      sharesReceived = netAmount;
    } else {
      sharesReceived = (netAmount * totalPool) / noPool;
    }
    newNoPool = noPool + netAmount;
  }

  const { yesPrice, noPrice } = computeAmmPrices(newYesPool, newNoPool);

  return {
    newYesPool,
    newNoPool,
    netAmount,
    feeAmount,
    yesPrice,
    noPrice,
    sharesReceived,
  };
}

/**
 * Simulate a sell trade on the AMM.
 *
 * When a user sells YES shares:
 *   1. SOL is returned from the YES pool proportional to shares
 *   2. 2% fee is deducted from the return
 *   3. YES pool decreases, P(YES) drops
 *
 * @returns Updated pool balances, amounts, and new prices
 */
export function simulateSell(
  yesPool: bigint,
  noPool: bigint,
  outcome: "yes" | "no",
  sharesAmount: bigint,
): {
  newYesPool: bigint;
  newNoPool: bigint;
  grossReturn: bigint;
  netReturn: bigint;
  feeAmount: bigint;
  yesPrice: number;
  noPrice: number;
} {
  const totalPool = yesPool + noPool;
  if (totalPool === 0n) {
    return {
      newYesPool: 0n,
      newNoPool: 0n,
      grossReturn: 0n,
      netReturn: 0n,
      feeAmount: 0n,
      yesPrice: 0.5,
      noPrice: 0.5,
    };
  }

  let grossReturn: bigint;
  let newYesPool = yesPool;
  let newNoPool = noPool;

  if (outcome === "yes") {
    // Return SOL proportional to shares relative to YES pool
    grossReturn = (sharesAmount * yesPool) / totalPool;
    if (grossReturn > yesPool) grossReturn = yesPool;
    newYesPool = yesPool - grossReturn;
  } else {
    grossReturn = (sharesAmount * noPool) / totalPool;
    if (grossReturn > noPool) grossReturn = noPool;
    newNoPool = noPool - grossReturn;
  }

  const { netAmount: netReturn, feeAmount } = calculateProtocolFee(grossReturn);
  const { yesPrice, noPrice } = computeAmmPrices(newYesPool, newNoPool);

  return {
    newYesPool,
    newNoPool,
    grossReturn,
    netReturn,
    feeAmount,
    yesPrice,
    noPrice,
  };
}

/**
 * Calculate the total liquidity in a market (YES pool + NO pool).
 */
export function totalLiquidity(yesPool: bigint, noPool: bigint): bigint {
  return yesPool + noPool;
}

/**
 * Validate that a market can accept trades.
 * Markets must be in ACTIVE status and have non-zero liquidity.
 */
export function canTrade(
  status: string,
  yesPool: bigint,
  noPool: bigint,
): { ok: boolean; reason?: string } {
  if (status !== "active") {
    return { ok: false, reason: `Market is ${status}, trading not allowed` };
  }
  if (yesPool === 0n && noPool === 0n) {
    return { ok: false, reason: "Market has no liquidity" };
  }
  return { ok: true };
}

/**
 * Validate that creator liquidity can be withdrawn.
 * Only allowed after market resolution.
 */
export function canWithdrawLiquidity(
  status: string,
  alreadyWithdrawn: boolean,
): { ok: boolean; reason?: string } {
  if (status !== "resolved") {
    return { ok: false, reason: "Liquidity is locked until market resolution" };
  }
  if (alreadyWithdrawn) {
    return { ok: false, reason: "Liquidity already withdrawn" };
  }
  return { ok: true };
}
