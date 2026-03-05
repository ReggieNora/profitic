-- =============================================================================
-- Profitic Prediction Market — Initial Database Schema
-- =============================================================================
-- Run with:  psql $DATABASE_URL -f migrations/001_initial.sql
--
-- This schema mirrors the on-chain Solana program state and adds derived
-- fields (prices, volumes) that are expensive to compute on-chain but
-- trivial to maintain in Postgres via the indexer.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extension: enable pg_trgm for future full-text search on market questions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- ENUM types
-- ---------------------------------------------------------------------------

-- Market lifecycle status — matches the on-chain MarketStatus enum exactly.
CREATE TYPE market_status AS ENUM (
    'active',
    'proposed_resolution',
    'resolved',
    'cancelled'
);

-- Trade direction.
CREATE TYPE trade_side AS ENUM ('buy', 'sell');

-- Evidence action type for the audit trail.
CREATE TYPE evidence_action AS ENUM ('resolve', 'propose', 'challenge');

-- ---------------------------------------------------------------------------
-- markets
-- ---------------------------------------------------------------------------
-- One row per prediction market. The indexer upserts this on every relevant
-- on-chain event (creation, trade, resolution).
CREATE TABLE IF NOT EXISTS markets (
    -- On-chain sequential market ID (from Platform.market_count).
    id              BIGINT PRIMARY KEY,
    -- Solana public key of the market PDA account.
    address         TEXT NOT NULL UNIQUE,
    -- Creator wallet address.
    creator         TEXT NOT NULL,
    -- The prediction question (max 256 chars on-chain).
    question        TEXT NOT NULL,
    -- Longer description / context (max 512 chars on-chain).
    description     TEXT NOT NULL DEFAULT '',
    -- Unix timestamp (seconds) when the market becomes resolvable.
    resolution_timestamp BIGINT NOT NULL,
    -- URL or description of the data source used for resolution.
    data_source     TEXT NOT NULL DEFAULT '',
    -- Current lifecycle status.
    status          market_status NOT NULL DEFAULT 'active',
    -- SPL token mint public key for YES outcome tokens.
    yes_mint        TEXT NOT NULL,
    -- SPL token mint public key for NO outcome tokens.
    no_mint         TEXT NOT NULL,
    -- Total YES tokens in circulation (raw u64, 6 decimals).
    yes_supply      NUMERIC(20, 0) NOT NULL DEFAULT 0,
    -- Total NO tokens in circulation (raw u64, 6 decimals).
    no_supply       NUMERIC(20, 0) NOT NULL DEFAULT 0,
    -- Total SOL locked in the pool vault (lamports).
    pool_balance    NUMERIC(20, 0) NOT NULL DEFAULT 0,
    -- Winning outcome after resolution (NULL while active). 0 = YES, 1 = NO.
    winning_outcome SMALLINT,
    -- Evidence URL provided at resolution.
    evidence_url    TEXT,
    -- Proposed outcome during AI-assisted resolution.
    proposed_outcome SMALLINT,
    -- Proposed evidence URL.
    proposed_evidence_url TEXT,
    -- Proposed evidence snapshot.
    proposed_evidence_snapshot TEXT,
    -- When the proposal was made (unix seconds).
    proposal_timestamp BIGINT,
    -- Total SOL staked in challenges against proposal (lamports).
    challenge_stake NUMERIC(20, 0) NOT NULL DEFAULT 0,
    -- Market creation timestamp (unix seconds, from on-chain Clock).
    created_at      BIGINT NOT NULL,
    -- Derived: current YES token price in SOL (computed by indexer).
    yes_price       DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    -- Derived: current NO token price in SOL.
    no_price        DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    -- Accumulated trading volume in lamports.
    total_volume    NUMERIC(20, 0) NOT NULL DEFAULT 0,
    -- Row-level bookkeeping.
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index on status for filtering active/resolved markets.
CREATE INDEX IF NOT EXISTS idx_markets_status ON markets (status);
-- Index on creator for "my markets" queries.
CREATE INDEX IF NOT EXISTS idx_markets_creator ON markets (creator);
-- GIN trigram index on question for full-text search.
CREATE INDEX IF NOT EXISTS idx_markets_question_trgm ON markets USING gin (question gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- trades
-- ---------------------------------------------------------------------------
-- One row per buy or sell. Immutable audit log — never updated or deleted.
CREATE TABLE IF NOT EXISTS trades (
    id              BIGSERIAL PRIMARY KEY,
    -- FK to markets.id.
    market_id       BIGINT NOT NULL REFERENCES markets(id),
    -- Trader's wallet address.
    user_address    TEXT NOT NULL,
    -- Which outcome was traded (0 = YES, 1 = NO).
    outcome         SMALLINT NOT NULL CHECK (outcome IN (0, 1)),
    -- Buy or sell.
    side            trade_side NOT NULL,
    -- Number of outcome tokens traded (raw u64).
    amount          NUMERIC(20, 0) NOT NULL,
    -- SOL cost or return in lamports.
    cost            NUMERIC(20, 0) NOT NULL,
    -- Fee paid in lamports.
    fee             NUMERIC(20, 0) NOT NULL DEFAULT 0,
    -- Solana transaction signature (base-58).
    tx_signature    TEXT NOT NULL UNIQUE,
    -- Slot the transaction was confirmed in.
    slot            BIGINT NOT NULL,
    -- When the trade was indexed.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching trades by market (with recency ordering).
CREATE INDEX IF NOT EXISTS idx_trades_market_id ON trades (market_id, created_at DESC);
-- Index for fetching a user's trade history.
CREATE INDEX IF NOT EXISTS idx_trades_user ON trades (user_address, created_at DESC);
-- Index on slot for gap detection during reindexing.
CREATE INDEX IF NOT EXISTS idx_trades_slot ON trades (slot);

-- ---------------------------------------------------------------------------
-- user_positions
-- ---------------------------------------------------------------------------
-- Aggregated position per (market, user). The indexer updates this on every
-- trade so the API can return current holdings without on-chain lookups.
CREATE TABLE IF NOT EXISTS user_positions (
    id              BIGSERIAL PRIMARY KEY,
    market_id       BIGINT NOT NULL REFERENCES markets(id),
    user_address    TEXT NOT NULL,
    -- YES tokens currently held (raw u64).
    yes_tokens      NUMERIC(20, 0) NOT NULL DEFAULT 0,
    -- NO tokens currently held (raw u64).
    no_tokens       NUMERIC(20, 0) NOT NULL DEFAULT 0,
    -- Total SOL spent acquiring positions (lamports).
    total_invested  NUMERIC(20, 0) NOT NULL DEFAULT 0,
    -- Whether winnings have been claimed (post-resolution).
    claimed         BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each user has at most one position per market.
    UNIQUE (market_id, user_address)
);

-- Index for "all positions for a user" queries.
CREATE INDEX IF NOT EXISTS idx_positions_user ON user_positions (user_address);

-- ---------------------------------------------------------------------------
-- evidence_logs
-- ---------------------------------------------------------------------------
-- Immutable audit trail for resolution-related actions (proposals,
-- resolutions, challenges). Used for dispute review and transparency.
CREATE TABLE IF NOT EXISTS evidence_logs (
    id              BIGSERIAL PRIMARY KEY,
    market_id       BIGINT NOT NULL REFERENCES markets(id),
    -- Who submitted the evidence (admin, AI proposer, or challenger wallet).
    submitter       TEXT NOT NULL,
    -- The type of evidence action.
    action          evidence_action NOT NULL,
    -- Proposed or confirmed outcome (0 = YES, 1 = NO).
    outcome         SMALLINT NOT NULL CHECK (outcome IN (0, 1)),
    -- URL to the evidence.
    evidence_url    TEXT NOT NULL,
    -- Optional snapshot of evidence data at the time of submission.
    evidence_snapshot TEXT,
    -- Stake amount for challenges (lamports, 0 for non-challenges).
    stake_amount    NUMERIC(20, 0) NOT NULL DEFAULT 0,
    -- Solana transaction signature.
    tx_signature    TEXT NOT NULL UNIQUE,
    -- Slot the transaction was confirmed in.
    slot            BIGINT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fetching evidence by market.
CREATE INDEX IF NOT EXISTS idx_evidence_market ON evidence_logs (market_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Helper: auto-update updated_at on row modification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_markets_updated_at
    BEFORE UPDATE ON markets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_positions_updated_at
    BEFORE UPDATE ON user_positions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
