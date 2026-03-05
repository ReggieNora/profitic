/**
 * Profitic Backend - TypeScript Type Definitions
 *
 * These interfaces mirror the on-chain Solana program state (state.rs)
 * and define the shapes used throughout the backend indexer and API.
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/**
 * Market lifecycle status. Maps directly to the on-chain MarketStatus enum.
 *   Active             -> open for trading
 *   ProposedResolution -> AI/admin proposed an outcome, dispute window open
 *   Resolved           -> winning outcome determined, claims allowed
 *   Cancelled          -> market voided, funds returned
 */
export enum MarketStatus {
  Active = "active",
  ProposedResolution = "proposed_resolution",
  Resolved = "resolved",
  Cancelled = "cancelled",
}

/**
 * Side of a trade: buying or selling outcome tokens.
 */
export enum TradeSide {
  Buy = "buy",
  Sell = "sell",
}

/**
 * Outcome for a binary market: YES (0) or NO (1).
 */
export enum Outcome {
  Yes = 0,
  No = 1,
}

// ---------------------------------------------------------------------------
// Database Row Interfaces (what Postgres stores / returns)
// ---------------------------------------------------------------------------

/**
 * A prediction market as stored in the `markets` table.
 * Fields align with the on-chain Market account plus derived pricing data.
 */
export interface Market {
  /** On-chain sequential market ID */
  id: number;
  /** Solana public key of the market PDA */
  address: string;
  /** Wallet that created the market */
  creator: string;
  /** The prediction question */
  question: string;
  /** Longer description / context */
  description: string;
  /** Unix timestamp (seconds) when the market becomes resolvable */
  resolution_timestamp: number;
  /** URL or description of the data source used for resolution */
  data_source: string;
  /** Current lifecycle status */
  status: MarketStatus;
  /** SPL token mint address for YES outcome tokens */
  yes_mint: string;
  /** SPL token mint address for NO outcome tokens */
  no_mint: string;
  /** Total YES tokens in circulation (raw u64, 6 decimals) */
  yes_supply: string;
  /** Total NO tokens in circulation (raw u64, 6 decimals) */
  no_supply: string;
  /** Total SOL locked in the pool vault (lamports) */
  pool_balance: string;
  /** Winning outcome after resolution (null while active) */
  winning_outcome: number | null;
  /** Evidence URL provided at resolution */
  evidence_url: string | null;
  /** Proposed outcome during AI-assisted resolution */
  proposed_outcome: number | null;
  /** Proposed evidence URL */
  proposed_evidence_url: string | null;
  /** Proposed evidence snapshot */
  proposed_evidence_snapshot: string | null;
  /** When the proposal was made (unix seconds) */
  proposal_timestamp: number | null;
  /** Total SOL staked in challenges against proposal */
  challenge_stake: string;
  /** Market creation timestamp (unix seconds) */
  created_at: number;
  /** Derived: current YES token price in SOL */
  yes_price: number;
  /** Derived: current NO token price in SOL */
  no_price: number;
  /** Total trading volume in lamports */
  total_volume: string;
  /** When the row was last updated */
  updated_at: Date;
}

/**
 * A single trade (buy or sell) as stored in the `trades` table.
 */
export interface Trade {
  /** Auto-incremented primary key */
  id: number;
  /** Market ID this trade belongs to */
  market_id: number;
  /** Trader's wallet address */
  user_address: string;
  /** Which outcome was traded (0=YES, 1=NO) */
  outcome: Outcome;
  /** Buy or sell */
  side: TradeSide;
  /** Number of outcome tokens traded (raw u64) */
  amount: string;
  /** SOL cost or return in lamports */
  cost: string;
  /** Fee paid in lamports */
  fee: string;
  /** Solana transaction signature */
  tx_signature: string;
  /** Slot the transaction was confirmed in */
  slot: number;
  /** When the trade was recorded */
  created_at: Date;
}

/**
 * Aggregated user position in a market, stored in `user_positions`.
 */
export interface UserPosition {
  /** Composite key: market_id + user_address */
  id: number;
  /** Market ID */
  market_id: number;
  /** User's wallet address */
  user_address: string;
  /** YES tokens held (raw u64) */
  yes_tokens: string;
  /** NO tokens held (raw u64) */
  no_tokens: string;
  /** Total SOL spent acquiring positions (lamports) */
  total_invested: string;
  /** Whether winnings have been claimed (post-resolution) */
  claimed: boolean;
  /** Last updated */
  updated_at: Date;
}

/**
 * Evidence submitted during resolution or challenges.
 * Stored in `evidence_logs` for an immutable audit trail.
 */
export interface EvidenceLog {
  id: number;
  market_id: number;
  /** Who submitted the evidence (admin, AI proposer, or challenger) */
  submitter: string;
  /** The type of evidence action */
  action: "resolve" | "propose" | "challenge";
  /** Proposed or confirmed outcome */
  outcome: number;
  /** URL to the evidence */
  evidence_url: string;
  /** Optional snapshot of evidence data */
  evidence_snapshot: string | null;
  /** Stake amount for challenges (lamports, 0 for non-challenges) */
  stake_amount: string;
  /** Solana transaction signature */
  tx_signature: string;
  slot: number;
  created_at: Date;
}

// ---------------------------------------------------------------------------
// API Response Wrappers
// ---------------------------------------------------------------------------

/**
 * Standard paginated API response.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Market detail response includes the market plus recent trades.
 */
export interface MarketDetailResponse {
  market: Market;
  recent_trades: Trade[];
}

/**
 * A user's positions across all markets.
 */
export interface UserPositionResponse {
  positions: (UserPosition & { market_question: string; market_status: MarketStatus })[];
}

/**
 * A user's trade history.
 */
export interface UserHistoryResponse {
  trades: (Trade & { market_question: string })[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// WebSocket Message Types
// ---------------------------------------------------------------------------

/**
 * Messages broadcast over the WebSocket to connected clients.
 */
export type WsMessage =
  | { type: "trade"; data: Trade }
  | { type: "market_update"; data: Partial<Market> & { id: number } }
  | { type: "market_created"; data: Market }
  | { type: "market_resolved"; data: { id: number; winning_outcome: number; evidence_url: string } }
  | { type: "price_update"; data: { market_id: number; yes_price: number; no_price: number } };

// ---------------------------------------------------------------------------
// Indexer Internal Types
// ---------------------------------------------------------------------------

/**
 * Parsed event extracted from Solana transaction logs.
 * The indexer converts raw program log lines into these typed events.
 */
export type IndexerEvent =
  | {
      kind: "market_created";
      marketId: number;
      question: string;
      slot: number;
      txSignature: string;
    }
  | {
      kind: "tokens_bought";
      outcome: Outcome;
      amount: number;
      cost: number;
      fee: number;
      slot: number;
      txSignature: string;
    }
  | {
      kind: "tokens_sold";
      outcome: Outcome;
      amount: number;
      returnAmount: number;
      fee: number;
      slot: number;
      txSignature: string;
    }
  | {
      kind: "market_resolved";
      marketId: number;
      winningOutcome: Outcome;
      slot: number;
      txSignature: string;
    }
  | {
      kind: "resolution_proposed";
      marketId: number;
      proposedOutcome: Outcome;
      evidenceUrl: string;
      slot: number;
      txSignature: string;
    }
  | {
      kind: "resolution_challenged";
      marketId: number;
      stakeAmount: number;
      slot: number;
      txSignature: string;
    };
