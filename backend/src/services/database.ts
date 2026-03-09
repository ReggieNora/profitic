/**
 * Profitic Backend — Supabase Database Service
 *
 * Provides typed query helpers for every table in the schema
 * (markets, trades, user_positions, evidence_logs, comments).
 *
 * Uses @supabase/supabase-js with a service-role key so the indexer
 * can write freely (bypasses RLS).
 *
 * All numeric fields that exceed JS safe-integer range (u64 lamport values)
 * are stored as NUMERIC(20,0) in Postgres and exposed as strings to callers
 * so no precision is silently lost.
 */

import { getSupabase } from "../lib/supabase";
import {
  Market,
  Trade,
  UserPosition,
  EvidenceLog,
  Comment,
  MarketStatus,
  LiquidityProvision,
  TreasuryEntry,
} from "../models/types";

// ---------------------------------------------------------------------------
// Market helpers
// ---------------------------------------------------------------------------

/**
 * Upsert a market row.  Called by the indexer when a `create_market` log is
 * detected and on subsequent state-changing events (trades, resolutions).
 */
export async function upsertMarket(market: Omit<Market, "updated_at">): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("markets").upsert(
    {
      id: market.id,
      address: market.address,
      creator: market.creator,
      question: market.question,
      description: market.description,
      resolution_timestamp: market.resolution_timestamp,
      data_source: market.data_source,
      status: market.status,
      yes_mint: market.yes_mint,
      no_mint: market.no_mint,
      yes_supply: market.yes_supply,
      no_supply: market.no_supply,
      pool_balance: market.pool_balance,
      winning_outcome: market.winning_outcome,
      evidence_url: market.evidence_url,
      proposed_outcome: market.proposed_outcome,
      proposed_evidence_url: market.proposed_evidence_url,
      proposed_evidence_snapshot: market.proposed_evidence_snapshot,
      proposal_timestamp: market.proposal_timestamp,
      challenge_stake: market.challenge_stake,
      created_at: market.created_at,
      yes_price: market.yes_price,
      no_price: market.no_price,
      total_volume: market.total_volume,
    },
    { onConflict: "id" }
  );

  if (error) throw new Error(`[database] upsertMarket failed: ${error.message}`);
}

/**
 * Partially update a market row — typically used when the indexer only needs
 * to patch prices or supply after a trade without a full upsert.
 */
export async function updateMarketFields(
  marketId: number,
  fields: Partial<Market>,
): Promise<void> {
  const updates: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (key !== "id" && key !== "updated_at") {
      updates[key] = value;
    }
  }
  if (Object.keys(updates).length === 0) return;

  const supabase = getSupabase();
  const { error } = await supabase
    .from("markets")
    .update(updates)
    .eq("id", marketId);

  if (error) throw new Error(`[database] updateMarketFields failed: ${error.message}`);
}

/**
 * Fetch a single market by its on-chain ID.
 */
export async function getMarketById(id: number): Promise<Market | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("markets")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    // PGRST116 = row not found — not an error, just null
    if (error.code === "PGRST116") return null;
    throw new Error(`[database] getMarketById failed: ${error.message}`);
  }
  return data as Market;
}

/**
 * Fetch a paginated list of markets, optionally filtered by status.
 * Results are ordered by creation time descending (newest first).
 */
export async function getMarkets(options: {
  status?: MarketStatus;
  page?: number;
  limit?: number;
  search?: string;
}): Promise<{ data: Market[]; total: number }> {
  const { status, page = 1, limit = 20, search } = options;
  const offset = (page - 1) * limit;

  const supabase = getSupabase();

  // Build the query
  let query = supabase
    .from("markets")
    .select("*", { count: "exact" });

  if (status) {
    query = query.eq("status", status);
  }

  if (search) {
    query = query.ilike("question", `%${search}%`);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`[database] getMarkets failed: ${error.message}`);

  return { data: (data as Market[]) || [], total: count ?? 0 };
}

// ---------------------------------------------------------------------------
// Trade helpers
// ---------------------------------------------------------------------------

/**
 * Insert a trade row.  Called once per buy/sell event from the indexer.
 * Uses upsert with ignoreDuplicates so replayed transactions are harmless.
 */
export async function insertTrade(trade: Omit<Trade, "id" | "created_at">): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("trades").upsert(
    {
      market_id: trade.market_id,
      user_address: trade.user_address,
      outcome: trade.outcome,
      side: trade.side,
      amount: trade.amount,
      cost: trade.cost,
      fee: trade.fee,
      tx_signature: trade.tx_signature,
      slot: trade.slot,
    },
    { onConflict: "tx_signature", ignoreDuplicates: true }
  );

  if (error) throw new Error(`[database] insertTrade failed: ${error.message}`);
}

/**
 * Fetch trades for a specific market, newest first.
 */
export async function getTradesByMarket(
  marketId: number,
  options: { page?: number; limit?: number } = {},
): Promise<{ data: Trade[]; total: number }> {
  const { page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;

  const supabase = getSupabase();

  const { data, error, count } = await supabase
    .from("trades")
    .select("*", { count: "exact" })
    .eq("market_id", marketId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`[database] getTradesByMarket failed: ${error.message}`);

  return { data: (data as Trade[]) || [], total: count ?? 0 };
}

// ---------------------------------------------------------------------------
// User position helpers
// ---------------------------------------------------------------------------

/**
 * Upsert a user's position in a market.  After a buy the indexer increments
 * token counts; after a sell it decrements them.
 * Uses a Postgres RPC function for the atomic delta arithmetic.
 */
export async function upsertUserPosition(position: {
  market_id: number;
  user_address: string;
  yes_tokens_delta: string;
  no_tokens_delta: string;
  invested_delta: string;
}): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("upsert_position", {
    p_market_id: position.market_id,
    p_user_address: position.user_address,
    p_yes_delta: position.yes_tokens_delta,
    p_no_delta: position.no_tokens_delta,
    p_invest_delta: position.invested_delta,
  });

  if (error) throw new Error(`[database] upsertUserPosition failed: ${error.message}`);
}

/**
 * Mark a user's position as claimed (after calling claim_winnings on-chain).
 */
export async function markPositionClaimed(
  marketId: number,
  userAddress: string,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("user_positions")
    .update({ claimed: true })
    .eq("market_id", marketId)
    .eq("user_address", userAddress);

  if (error) throw new Error(`[database] markPositionClaimed failed: ${error.message}`);
}

/**
 * Fetch all positions for a wallet address, enriched with market question and status.
 */
export async function getUserPositions(
  userAddress: string,
): Promise<(UserPosition & { market_question: string; market_status: MarketStatus })[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("user_positions")
    .select("*, markets!inner(question, status)")
    .eq("user_address", userAddress)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(`[database] getUserPositions failed: ${error.message}`);

  // Flatten the joined market fields to match the expected return shape
  return ((data as any[]) || []).map((row) => ({
    ...row,
    market_question: row.markets.question,
    market_status: row.markets.status,
    markets: undefined,
  }));
}

/**
 * Fetch a user's trade history across all markets.
 */
export async function getUserTradeHistory(
  userAddress: string,
  options: { page?: number; limit?: number } = {},
): Promise<{ data: (Trade & { market_question: string })[]; total: number }> {
  const { page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;

  const supabase = getSupabase();

  const { data, error, count } = await supabase
    .from("trades")
    .select("*, markets!inner(question)", { count: "exact" })
    .eq("user_address", userAddress)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`[database] getUserTradeHistory failed: ${error.message}`);

  // Flatten the joined market question
  const rows = ((data as any[]) || []).map((row) => ({
    ...row,
    market_question: row.markets.question,
    markets: undefined,
  }));

  return { data: rows, total: count ?? 0 };
}

// ---------------------------------------------------------------------------
// Evidence log helpers
// ---------------------------------------------------------------------------

/**
 * Insert an evidence log entry.  Idempotent via tx_signature uniqueness.
 */
export async function insertEvidenceLog(
  log: Omit<EvidenceLog, "id" | "created_at">,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("evidence_logs").upsert(
    {
      market_id: log.market_id,
      submitter: log.submitter,
      action: log.action,
      outcome: log.outcome,
      evidence_url: log.evidence_url,
      evidence_snapshot: log.evidence_snapshot,
      stake_amount: log.stake_amount,
      tx_signature: log.tx_signature,
      slot: log.slot,
    },
    { onConflict: "tx_signature", ignoreDuplicates: true }
  );

  if (error) throw new Error(`[database] insertEvidenceLog failed: ${error.message}`);
}

/**
 * Fetch evidence logs for a market.
 */
export async function getEvidenceByMarket(
  marketId: number,
): Promise<EvidenceLog[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("evidence_logs")
    .select("*")
    .eq("market_id", marketId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`[database] getEvidenceByMarket failed: ${error.message}`);

  return (data as EvidenceLog[]) || [];
}

// ---------------------------------------------------------------------------
// Comment helpers
// ---------------------------------------------------------------------------

/**
 * Insert a comment and return the created row.
 */
export async function insertComment(comment: {
  market_id: number;
  user_address: string;
  body: string;
}): Promise<Comment> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("comments")
    .insert({
      market_id: comment.market_id,
      user_address: comment.user_address,
      body: comment.body,
    })
    .select()
    .single();

  if (error) throw new Error(`[database] insertComment failed: ${error.message}`);

  return data as Comment;
}

/**
 * Fetch comments for a market, newest first.
 */
export async function getCommentsByMarket(
  marketId: number,
  options: { page?: number; limit?: number } = {},
): Promise<{ data: Comment[]; total: number }> {
  const { page = 1, limit = 50 } = options;
  const offset = (page - 1) * limit;

  const supabase = getSupabase();

  const { data, error, count } = await supabase
    .from("comments")
    .select("*", { count: "exact" })
    .eq("market_id", marketId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw new Error(`[database] getCommentsByMarket failed: ${error.message}`);

  return { data: (data as Comment[]) || [], total: count ?? 0 };
}

// ---------------------------------------------------------------------------
// Liquidity provision helpers
// ---------------------------------------------------------------------------

/**
 * Record a liquidity provision (creator or LP deposit).
 */
export async function upsertLiquidityProvision(provision: {
  market_id: number;
  provider: string;
  yes_amount: string;
  no_amount: string;
  tx_signature?: string;
}): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.rpc("upsert_liquidity_provision", {
    p_market_id: provision.market_id,
    p_provider: provision.provider,
    p_yes_amount: provision.yes_amount,
    p_no_amount: provision.no_amount,
    p_tx_signature: provision.tx_signature || null,
  });

  if (error) throw new Error(`[database] upsertLiquidityProvision failed: ${error.message}`);
}

/**
 * Fetch liquidity provisions for a market.
 */
export async function getLiquidityProvisions(
  marketId: number,
): Promise<LiquidityProvision[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("liquidity_provisions")
    .select("*")
    .eq("market_id", marketId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`[database] getLiquidityProvisions failed: ${error.message}`);
  return (data as LiquidityProvision[]) || [];
}

/**
 * Mark a liquidity provision as withdrawn.
 */
export async function markLiquidityWithdrawn(
  marketId: number,
  provider: string,
): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase
    .from("liquidity_provisions")
    .update({ withdrawn: true })
    .eq("market_id", marketId)
    .eq("provider", provider);

  if (error) throw new Error(`[database] markLiquidityWithdrawn failed: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Treasury helpers
// ---------------------------------------------------------------------------

/**
 * Record a protocol fee payment to the treasury.
 */
export async function insertTreasuryEntry(entry: {
  market_id: number;
  amount: string;
  fee_type?: string;
  tx_signature?: string;
}): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from("treasury").insert({
    market_id: entry.market_id,
    amount: entry.amount,
    fee_type: entry.fee_type || "trade",
    tx_signature: entry.tx_signature || null,
  });

  if (error) throw new Error(`[database] insertTreasuryEntry failed: ${error.message}`);
}

/**
 * Get treasury summary — total fees and recent entries.
 */
export async function getTreasurySummary(): Promise<{
  total_fees: string;
  entries: TreasuryEntry[];
}> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("treasury")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(`[database] getTreasurySummary failed: ${error.message}`);

  const entries = (data as TreasuryEntry[]) || [];
  const total = entries.reduce((sum, e) => sum + BigInt(e.amount), 0n);

  return { total_fees: total.toString(), entries };
}

/**
 * Get trending markets based on recent trading volume.
 * Returns markets sorted by volume in the last 24 hours.
 */
export async function getTrendingMarkets(
  limit: number = 10,
): Promise<Market[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from("markets")
    .select("*")
    .eq("status", "active")
    .order("total_volume", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`[database] getTrendingMarkets failed: ${error.message}`);
  return (data as Market[]) || [];
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/**
 * Quick connectivity check — used by /api/health endpoint.
 */
export async function healthCheck(): Promise<boolean> {
  const supabase = getSupabase();
  const { error } = await supabase.from("markets").select("id").limit(1);
  return !error;
}
