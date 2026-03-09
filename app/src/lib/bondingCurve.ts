import { BONDING_CURVE_K } from "./constants";
import { PROTOCOL_FEE_BPS } from "@/types";

/**
 * AMM-based pricing for the Profitic prediction market.
 *
 * Uses a constant-product pool-ratio model:
 *   P(YES) = yes_pool / (yes_pool + no_pool)
 *   P(NO)  = no_pool  / (yes_pool + no_pool)
 *
 * Every trade charges a 2% protocol fee before updating pools.
 *
 * Legacy LMSR functions are preserved for bonding curve chart display.
 */

// ---------------------------------------------------------------------------
// AMM Pool-Ratio Pricing (primary pricing model)
// ---------------------------------------------------------------------------

/** Compute YES probability from AMM pool balances */
export function ammYesProbability(yesPool: number, noPool: number): number {
  const total = yesPool + noPool;
  if (total === 0) return 0.5;
  return yesPool / total;
}

/** Compute NO probability from AMM pool balances */
export function ammNoProbability(yesPool: number, noPool: number): number {
  return 1 - ammYesProbability(yesPool, noPool);
}

/**
 * Calculate the protocol fee for a trade amount.
 * Returns { netAmount, feeAmount }
 */
export function calculateProtocolFee(grossAmount: number): {
  netAmount: number;
  feeAmount: number;
} {
  const feeAmount = Math.floor((grossAmount * PROTOCOL_FEE_BPS) / 10_000);
  const netAmount = grossAmount - feeAmount;
  return { netAmount, feeAmount };
}

/**
 * Simulate a buy trade on the AMM.
 * Returns the new pool state and estimated shares received.
 */
export function ammSimulateBuy(
  yesPool: number,
  noPool: number,
  outcome: "yes" | "no",
  grossAmount: number,
): {
  newYesPool: number;
  newNoPool: number;
  netAmount: number;
  feeAmount: number;
  yesPrice: number;
  noPrice: number;
  estimatedShares: number;
} {
  const { netAmount, feeAmount } = calculateProtocolFee(grossAmount);

  let newYesPool = yesPool;
  let newNoPool = noPool;
  let estimatedShares: number;

  if (outcome === "yes") {
    const totalPool = yesPool + noPool;
    estimatedShares = totalPool > 0 ? (netAmount * totalPool) / yesPool : netAmount;
    newYesPool = yesPool + netAmount;
  } else {
    const totalPool = yesPool + noPool;
    estimatedShares = totalPool > 0 ? (netAmount * totalPool) / noPool : netAmount;
    newNoPool = noPool + netAmount;
  }

  const yesPrice = ammYesProbability(newYesPool, newNoPool);
  const noPrice = 1 - yesPrice;

  return { newYesPool, newNoPool, netAmount, feeAmount, yesPrice, noPrice, estimatedShares };
}

/**
 * Simulate a sell trade on the AMM.
 * Returns the estimated SOL return after fees.
 */
export function ammSimulateSell(
  yesPool: number,
  noPool: number,
  outcome: "yes" | "no",
  sharesAmount: number,
): {
  newYesPool: number;
  newNoPool: number;
  grossReturn: number;
  netReturn: number;
  feeAmount: number;
  yesPrice: number;
  noPrice: number;
} {
  const totalPool = yesPool + noPool;
  if (totalPool === 0) {
    return {
      newYesPool: 0, newNoPool: 0, grossReturn: 0,
      netReturn: 0, feeAmount: 0, yesPrice: 0.5, noPrice: 0.5,
    };
  }

  let grossReturn: number;
  let newYesPool = yesPool;
  let newNoPool = noPool;

  if (outcome === "yes") {
    grossReturn = Math.min((sharesAmount * yesPool) / totalPool, yesPool);
    newYesPool = yesPool - grossReturn;
  } else {
    grossReturn = Math.min((sharesAmount * noPool) / totalPool, noPool);
    newNoPool = noPool - grossReturn;
  }

  const { netAmount: netReturn, feeAmount } = calculateProtocolFee(grossReturn);
  const yesPrice = ammYesProbability(newYesPool, newNoPool);
  const noPrice = 1 - yesPrice;

  return { newYesPool, newNoPool, grossReturn, netReturn, feeAmount, yesPrice, noPrice };
}

// ---------------------------------------------------------------------------
// Legacy LMSR functions (kept for bonding curve chart)
// ---------------------------------------------------------------------------

/** Current probability (0-1) for YES given share counts */
export function yesProbability(yesShares: number, noShares: number): number {
  const total = yesShares + noShares;
  if (total === 0) return 0.5;
  return yesShares / total;
}

/** Current probability (0-1) for NO given share counts */
export function noProbability(yesShares: number, noShares: number): number {
  return 1 - yesProbability(yesShares, noShares);
}

/**
 * LMSR cost function.
 * C(q) = k * ln(e^(q_yes/k) + e^(q_no/k))
 */
function lmsrCost(yesShares: number, noShares: number, k: number): number {
  const maxQ = Math.max(yesShares / k, noShares / k);
  const sum =
    Math.exp(yesShares / k - maxQ) + Math.exp(noShares / k - maxQ);
  return k * (maxQ + Math.log(sum));
}

/**
 * Cost to buy `amount` shares of a given outcome.
 * Returns cost in the same unit as shares (lamports).
 */
export function calculateBuyCost(
  yesShares: number,
  noShares: number,
  outcome: "yes" | "no",
  amount: number,
  k: number = BONDING_CURVE_K
): number {
  const costBefore = lmsrCost(yesShares, noShares, k);

  const newYes = outcome === "yes" ? yesShares + amount : yesShares;
  const newNo = outcome === "no" ? noShares + amount : noShares;

  const costAfter = lmsrCost(newYes, newNo, k);
  return Math.max(0, costAfter - costBefore);
}

/**
 * Return from selling `amount` shares of a given outcome.
 * Returns the SOL returned to the seller.
 */
export function calculateSellReturn(
  yesShares: number,
  noShares: number,
  outcome: "yes" | "no",
  amount: number,
  k: number = BONDING_CURVE_K
): number {
  const costBefore = lmsrCost(yesShares, noShares, k);

  const newYes = outcome === "yes" ? yesShares - amount : yesShares;
  const newNo = outcome === "no" ? noShares - amount : noShares;

  if (newYes < 0 || newNo < 0) return 0;

  const costAfter = lmsrCost(newYes, newNo, k);
  return Math.max(0, costBefore - costAfter);
}

/**
 * Marginal price of the next share for a given outcome.
 * price = e^(q_outcome/k) / (e^(q_yes/k) + e^(q_no/k))
 */
export function marginalPrice(
  yesShares: number,
  noShares: number,
  outcome: "yes" | "no",
  k: number = BONDING_CURVE_K
): number {
  const maxQ = Math.max(yesShares / k, noShares / k);
  const expYes = Math.exp(yesShares / k - maxQ);
  const expNo = Math.exp(noShares / k - maxQ);
  const total = expYes + expNo;

  return outcome === "yes" ? expYes / total : expNo / total;
}

/**
 * Generate price curve data points for charting.
 */
export function generatePriceCurve(
  yesShares: number,
  noShares: number,
  points: number = 50,
  k: number = BONDING_CURVE_K
): Array<{ shares: number; yesPrice: number; noPrice: number }> {
  const data: Array<{ shares: number; yesPrice: number; noPrice: number }> = [];
  const maxShares = Math.max(yesShares + noShares, 200);
  const step = maxShares / points;

  for (let i = 0; i <= points; i++) {
    const currentYes = i * step;
    const currentNo = maxShares - currentYes;
    data.push({
      shares: Math.round(currentYes),
      yesPrice: Number(marginalPrice(currentYes, currentNo, "yes", k).toFixed(4)),
      noPrice: Number(marginalPrice(currentYes, currentNo, "no", k).toFixed(4)),
    });
  }

  return data;
}

/** Format lamports to SOL with fixed decimals */
export function lamportsToSol(lamports: number): number {
  return lamports / 1_000_000_000;
}

/** Format SOL to lamports */
export function solToLamports(sol: number): number {
  return Math.round(sol * 1_000_000_000);
}

/** Format a probability (0-1) as a percentage string */
export function formatProbability(prob: number): string {
  return `${(prob * 100).toFixed(1)}%`;
}

/** Format SOL amount for display */
export function formatSol(sol: number): string {
  if (sol >= 1000) return `${(sol / 1000).toFixed(1)}k SOL`;
  if (sol >= 1) return `${sol.toFixed(2)} SOL`;
  return `${sol.toFixed(4)} SOL`;
}
