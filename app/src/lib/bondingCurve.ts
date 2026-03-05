import { BONDING_CURVE_K } from "./constants";

/**
 * Bonding curve price calculations for the Profitic prediction market.
 *
 * Uses a constant-product (LMSR-inspired) bonding curve:
 *   price_yes = yes_shares / (yes_shares + no_shares)
 *   price_no  = no_shares  / (yes_shares + no_shares)
 *
 * Cost to buy `amount` shares of an outcome is computed via the logarithmic
 * market scoring rule (LMSR):
 *   cost = k * ln( (e^(q_yes/k) + e^(q_no/k)) after ) - k * ln( ... before )
 *
 * For simplicity on the client we approximate with the constant-product formula.
 */

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
  // Use log-sum-exp trick for numerical stability
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
 * Simulates buying incremental YES shares and recording the price at each step.
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
