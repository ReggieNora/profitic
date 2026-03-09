-- =============================================================================
-- Profitic — AMM Liquidity Pool, Treasury, and Market Lifecycle Upgrades
-- =============================================================================
-- Run with:  psql $DATABASE_URL -f migrations/004_amm_liquidity.sql
--
-- This migration adds:
--   1. AMM pool fields (yes_pool, no_pool) for constant-product pricing
--   2. Liquidity provider tracking
--   3. Protocol treasury fee accumulation
--   4. Market status lifecycle (funding -> active -> resolved)
--   5. Token reward stubs for future implementation

-- ---------------------------------------------------------------------------
-- Extend market_status enum with FUNDING state
-- ---------------------------------------------------------------------------
ALTER TYPE market_status ADD VALUE IF NOT EXISTS 'funding' BEFORE 'active';

-- ---------------------------------------------------------------------------
-- Add AMM pool columns to markets
-- ---------------------------------------------------------------------------

-- YES side of the AMM liquidity pool (lamports)
ALTER TABLE markets ADD COLUMN IF NOT EXISTS yes_pool NUMERIC(20, 0) NOT NULL DEFAULT 0;
-- NO side of the AMM liquidity pool (lamports)
ALTER TABLE markets ADD COLUMN IF NOT EXISTS no_pool NUMERIC(20, 0) NOT NULL DEFAULT 0;
-- Total fees collected by this market (lamports)
ALTER TABLE markets ADD COLUMN IF NOT EXISTS fees_collected NUMERIC(20, 0) NOT NULL DEFAULT 0;
-- Creator's initial YES liquidity deposit (lamports) — locked until resolution
ALTER TABLE markets ADD COLUMN IF NOT EXISTS creator_yes_liquidity NUMERIC(20, 0) NOT NULL DEFAULT 0;
-- Creator's initial NO liquidity deposit (lamports) — locked until resolution
ALTER TABLE markets ADD COLUMN IF NOT EXISTS creator_no_liquidity NUMERIC(20, 0) NOT NULL DEFAULT 0;
-- Whether creator liquidity has been withdrawn after resolution
ALTER TABLE markets ADD COLUMN IF NOT EXISTS creator_liquidity_withdrawn BOOLEAN NOT NULL DEFAULT FALSE;
-- Category tag for the market
ALTER TABLE markets ADD COLUMN IF NOT EXISTS category TEXT;
-- Cover image URL
ALTER TABLE markets ADD COLUMN IF NOT EXISTS cover_image TEXT;

-- ---------------------------------------------------------------------------
-- liquidity_provisions — tracks individual LP deposits
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS liquidity_provisions (
    id              BIGSERIAL PRIMARY KEY,
    market_id       BIGINT NOT NULL REFERENCES markets(id),
    provider        TEXT NOT NULL,
    -- Amount deposited to YES pool (lamports)
    yes_amount      NUMERIC(20, 0) NOT NULL DEFAULT 0,
    -- Amount deposited to NO pool (lamports)
    no_amount       NUMERIC(20, 0) NOT NULL DEFAULT 0,
    -- Share of fees earned (accumulated, lamports)
    fees_earned     NUMERIC(20, 0) NOT NULL DEFAULT 0,
    -- Whether this provision has been withdrawn
    withdrawn       BOOLEAN NOT NULL DEFAULT FALSE,
    -- Solana tx signature for the deposit
    tx_signature    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (market_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_lp_market ON liquidity_provisions (market_id);
CREATE INDEX IF NOT EXISTS idx_lp_provider ON liquidity_provisions (provider);

-- ---------------------------------------------------------------------------
-- treasury — protocol fee accumulation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS treasury (
    id              BIGSERIAL PRIMARY KEY,
    -- Source market
    market_id       BIGINT NOT NULL REFERENCES markets(id),
    -- Fee amount (lamports)
    amount          NUMERIC(20, 0) NOT NULL,
    -- Type of fee
    fee_type        TEXT NOT NULL DEFAULT 'trade',
    -- Solana tx signature
    tx_signature    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_treasury_market ON treasury (market_id);

-- ---------------------------------------------------------------------------
-- token_reward_stubs — architecture for future token rewards
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reward_config (
    id              BIGSERIAL PRIMARY KEY,
    -- Reward type: 'lp', 'trader', 'creator'
    reward_type     TEXT NOT NULL UNIQUE,
    -- Tokens per unit of activity (configurable later)
    rate            NUMERIC(20, 6) NOT NULL DEFAULT 0,
    -- Whether this reward type is active
    enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Pre-populate reward types (disabled by default)
INSERT INTO reward_config (reward_type, rate, enabled) VALUES
    ('lp', 0, FALSE),
    ('trader', 0, FALSE),
    ('creator', 0, FALSE)
ON CONFLICT (reward_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS reward_ledger (
    id              BIGSERIAL PRIMARY KEY,
    user_address    TEXT NOT NULL,
    reward_type     TEXT NOT NULL,
    market_id       BIGINT REFERENCES markets(id),
    -- Pending reward tokens (not yet minted/distributed)
    amount          NUMERIC(20, 6) NOT NULL DEFAULT 0,
    -- Whether this reward has been claimed/minted
    claimed         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rewards_user ON reward_ledger (user_address);
CREATE INDEX IF NOT EXISTS idx_rewards_market ON reward_ledger (market_id);

-- ---------------------------------------------------------------------------
-- Upsert function for liquidity provisions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION upsert_liquidity_provision(
    p_market_id     BIGINT,
    p_provider      TEXT,
    p_yes_amount    NUMERIC(20,0),
    p_no_amount     NUMERIC(20,0),
    p_tx_signature  TEXT DEFAULT NULL
) RETURNS void
LANGUAGE sql
AS $$
    INSERT INTO liquidity_provisions (market_id, provider, yes_amount, no_amount, tx_signature)
    VALUES (p_market_id, p_provider, p_yes_amount, p_no_amount, p_tx_signature)
    ON CONFLICT (market_id, provider) DO UPDATE SET
        yes_amount = liquidity_provisions.yes_amount + p_yes_amount,
        no_amount  = liquidity_provisions.no_amount  + p_no_amount;
$$;

-- ---------------------------------------------------------------------------
-- Auto-update triggers for new tables
-- ---------------------------------------------------------------------------
CREATE TRIGGER trg_lp_updated_at
    BEFORE UPDATE ON liquidity_provisions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_reward_config_updated_at
    BEFORE UPDATE ON reward_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
