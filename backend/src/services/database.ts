/**
 * Profitic Backend — Postgres Database Service
 *
 * Manages the connection pool and provides typed query helpers for every
 * table in the schema (markets, trades, user_positions, evidence_logs).
 *
 * All numeric fields that exceed JS safe-integer range (u64 lamport values)
 * are stored as NUMERIC(20,0) in Postgres and exposed as strings to callers
 * so no precision is silently lost.
 */

import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";
import {
  Market,
  Trade,
  UserPosition,
  EvidenceLog,
  MarketStatus,
  TradeSide,
  Outcome,
} from "../models/types";

// ---------------------------------------------------------------------------
// Pool singleton
// ---------------------------------------------------------------------------

/** Shared connection pool — initialised lazily via `getPool()`. */
let pool: Pool | null = null;

/**
 * Return (and lazily create) the shared Postgres connection pool.
 * Reads `DATABASE_URL` from the environment.
 */
export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    pool = new Pool({
      connectionString,
      // Sensible defaults — override via DATABASE_URL query params if needed.
      max: 20,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    // Surface unexpected pool errors to the process log rather than swallow.
    pool.on("error", (err) => {
      console.error("[database] Unexpected pool error:", err);
    });
  }
  return pool;
}

/**
 * Run a single parameterised query against the pool.
 * Shorthand so callers don't need to import Pool directly.
 */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

/**
 * Acquire a dedicated client for use inside a transaction.
 * Caller MUST call `client.release()` when done.
 */
export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

/**
 * Gracefully shut down the pool (call on SIGTERM / SIGINT).
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log("[database] Connection pool closed");
  }
}

// ---------------------------------------------------------------------------
// Market helpers
// ---------------------------------------------------------------------------

/**
 * Upsert a market row.  Called by the indexer when a `create_market` log is
 * detected and on subsequent state-changing events (trades, resolutions).
 */
export async function upsertMarket(market: Omit<Market, "updated_at">): Promise<void> {
  await query(
    `INSERT INTO markets (
        id, address, creator, question, description,
        resolution_timestamp, data_source, status,
        yes_mint, no_mint, yes_supply, no_supply, pool_balance,
        winning_outcome, evidence_url,
        proposed_outcome, proposed_evidence_url, proposed_evidence_snapshot,
        proposal_timestamp, challenge_stake, created_at,
        yes_price, no_price, total_volume
     ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24
     )
     ON CONFLICT (id) DO UPDATE SET
        status                    = EXCLUDED.status,
        yes_supply                = EXCLUDED.yes_supply,
        no_supply                 = EXCLUDED.no_supply,
        pool_balance              = EXCLUDED.pool_balance,
        winning_outcome           = EXCLUDED.winning_outcome,
        evidence_url              = EXCLUDED.evidence_url,
        proposed_outcome          = EXCLUDED.proposed_outcome,
        proposed_evidence_url     = EXCLUDED.proposed_evidence_url,
        proposed_evidence_snapshot= EXCLUDED.proposed_evidence_snapshot,
        proposal_timestamp        = EXCLUDED.proposal_timestamp,
        challenge_stake           = EXCLUDED.challenge_stake,
        yes_price                 = EXCLUDED.yes_price,
        no_price                  = EXCLUDED.no_price,
        total_volume              = EXCLUDED.total_volume`,
    [
      market.id,
      market.address,
      market.creator,
      market.question,
      market.description,
      market.resolution_timestamp,
      market.data_source,
      market.status,
      market.yes_mint,
      market.no_mint,
      market.yes_supply,
      market.no_supply,
      market.pool_balance,
      market.winning_outcome,
      market.evidence_url,
      market.proposed_outcome,
      market.proposed_evidence_url,
      market.proposed_evidence_snapshot,
      market.proposal_timestamp,
      market.challenge_stake,
      market.created_at,
      market.yes_price,
      market.no_price,
      market.total_volume,
    ],
  );
}

/**
 * Partially update a market row — typically used when the indexer only needs
 * to patch prices or supply after a trade without a full upsert.
 */
export async function updateMarketFields(
  marketId: number,
  fields: Partial<Market>,
): Promise<void> {
  const entries = Object.entries(fields).filter(
    ([key]) => key !== "id" && key !== "updated_at",
  );
  if (entries.length === 0) return;

  // Build a dynamic SET clause: "col1 = $2, col2 = $3, ..."
  const setClauses = entries.map(([key], i) => `${key} = $${i + 2}`).join(", ");
  const values: unknown[] = [marketId, ...entries.map(([, v]) => v)];

  await query(`UPDATE markets SET ${setClauses} WHERE id = $1`, values);
}

/**
 * Fetch a single market by its on-chain ID.
 */
export async function getMarketById(id: number): Promise<Market | null> {
  const { rows } = await query<Market>("SELECT * FROM markets WHERE id = $1", [id]);
  return rows[0] ?? null;
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
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status) {
    params.push(status);
    conditions.push(`status = $${params.length}`);
  }

  if (search) {
    params.push(search);
    conditions.push(`question ILIKE '%' || $${params.length} || '%'`);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Total count for pagination metadata.
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM markets ${whereClause}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  // Data page.
  const offset = (page - 1) * limit;
  params.push(limit, offset);
  const dataResult = await query<Market>(
    `SELECT * FROM markets ${whereClause}
     ORDER BY created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return { data: dataResult.rows, total };
}

// ---------------------------------------------------------------------------
// Trade helpers
// ---------------------------------------------------------------------------

/**
 * Insert a trade row.  Called once per buy/sell event from the indexer.
 * Uses ON CONFLICT DO NOTHING so replayed transactions are harmless.
 */
export async function insertTrade(trade: Omit<Trade, "id" | "created_at">): Promise<void> {
  await query(
    `INSERT INTO trades (
        market_id, user_address, outcome, side, amount, cost, fee, tx_signature, slot
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (tx_signature) DO NOTHING`,
    [
      trade.market_id,
      trade.user_address,
      trade.outcome,
      trade.side,
      trade.amount,
      trade.cost,
      trade.fee,
      trade.tx_signature,
      trade.slot,
    ],
  );
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

  const countResult = await query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM trades WHERE market_id = $1",
    [marketId],
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await query<Trade>(
    `SELECT * FROM trades WHERE market_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [marketId, limit, offset],
  );

  return { data: dataResult.rows, total };
}

// ---------------------------------------------------------------------------
// User position helpers
// ---------------------------------------------------------------------------

/**
 * Upsert a user's position in a market.  After a buy the indexer increments
 * token counts; after a sell it decrements them.
 */
export async function upsertUserPosition(position: {
  market_id: number;
  user_address: string;
  yes_tokens_delta: string;
  no_tokens_delta: string;
  invested_delta: string;
}): Promise<void> {
  await query(
    `INSERT INTO user_positions (market_id, user_address, yes_tokens, no_tokens, total_invested)
     VALUES ($1, $2, GREATEST(0, $3::NUMERIC), GREATEST(0, $4::NUMERIC), GREATEST(0, $5::NUMERIC))
     ON CONFLICT (market_id, user_address) DO UPDATE SET
        yes_tokens     = GREATEST(0, user_positions.yes_tokens + $3::NUMERIC),
        no_tokens      = GREATEST(0, user_positions.no_tokens  + $4::NUMERIC),
        total_invested = GREATEST(0, user_positions.total_invested + $5::NUMERIC)`,
    [
      position.market_id,
      position.user_address,
      position.yes_tokens_delta,
      position.no_tokens_delta,
      position.invested_delta,
    ],
  );
}

/**
 * Mark a user's position as claimed (after calling claim_winnings on-chain).
 */
export async function markPositionClaimed(
  marketId: number,
  userAddress: string,
): Promise<void> {
  await query(
    "UPDATE user_positions SET claimed = TRUE WHERE market_id = $1 AND user_address = $2",
    [marketId, userAddress],
  );
}

/**
 * Fetch all positions for a wallet address, enriched with market question and status.
 */
export async function getUserPositions(
  userAddress: string,
): Promise<(UserPosition & { market_question: string; market_status: MarketStatus })[]> {
  const { rows } = await query<
    UserPosition & { market_question: string; market_status: MarketStatus }
  >(
    `SELECT up.*, m.question AS market_question, m.status AS market_status
     FROM user_positions up
     JOIN markets m ON m.id = up.market_id
     WHERE up.user_address = $1
     ORDER BY up.updated_at DESC`,
    [userAddress],
  );
  return rows;
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

  const countResult = await query<{ count: string }>(
    "SELECT COUNT(*) AS count FROM trades WHERE user_address = $1",
    [userAddress],
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const { rows } = await query<Trade & { market_question: string }>(
    `SELECT t.*, m.question AS market_question
     FROM trades t
     JOIN markets m ON m.id = t.market_id
     WHERE t.user_address = $1
     ORDER BY t.created_at DESC
     LIMIT $2 OFFSET $3`,
    [userAddress, limit, offset],
  );

  return { data: rows, total };
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
  await query(
    `INSERT INTO evidence_logs (
        market_id, submitter, action, outcome, evidence_url,
        evidence_snapshot, stake_amount, tx_signature, slot
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (tx_signature) DO NOTHING`,
    [
      log.market_id,
      log.submitter,
      log.action,
      log.outcome,
      log.evidence_url,
      log.evidence_snapshot,
      log.stake_amount,
      log.tx_signature,
      log.slot,
    ],
  );
}

/**
 * Fetch evidence logs for a market.
 */
export async function getEvidenceByMarket(
  marketId: number,
): Promise<EvidenceLog[]> {
  const { rows } = await query<EvidenceLog>(
    "SELECT * FROM evidence_logs WHERE market_id = $1 ORDER BY created_at DESC",
    [marketId],
  );
  return rows;
}
