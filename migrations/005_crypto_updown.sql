-- =============================================================================
-- Profitic — Crypto Up/Down Market Type
-- =============================================================================
-- Run with:  psql $DATABASE_URL -f migrations/005_crypto_updown.sql
--
-- Adds columns to support short-duration crypto price prediction markets:
--   - market_type: distinguishes 'prediction' vs 'crypto_updown'
--   - crypto_asset, crypto_timeframe, crypto_subtype: crypto market config
--   - strike_price, start_price: price anchors for resolution
--   - oracle_source: which price oracle to use for resolution

-- ---------------------------------------------------------------------------
-- Market type column (default 'prediction' for backward compatibility)
-- ---------------------------------------------------------------------------
ALTER TABLE markets ADD COLUMN IF NOT EXISTS market_type TEXT NOT NULL DEFAULT 'prediction';

-- ---------------------------------------------------------------------------
-- Crypto Up/Down specific fields
-- ---------------------------------------------------------------------------

-- Which crypto asset (BTC, ETH, SOL)
ALTER TABLE markets ADD COLUMN IF NOT EXISTS crypto_asset TEXT;

-- Duration timeframe (5m, 15m, 1h, 4h, 24h)
ALTER TABLE markets ADD COLUMN IF NOT EXISTS crypto_timeframe TEXT;

-- Subtype: 'up_down' or 'price_target'
ALTER TABLE markets ADD COLUMN IF NOT EXISTS crypto_subtype TEXT;

-- Strike price in USD (for price_target subtype)
ALTER TABLE markets ADD COLUMN IF NOT EXISTS strike_price DOUBLE PRECISION;

-- Asset price at market creation (USD)
ALTER TABLE markets ADD COLUMN IF NOT EXISTS start_price DOUBLE PRECISION;

-- Oracle source identifier (e.g. 'pyth', 'chainlink')
ALTER TABLE markets ADD COLUMN IF NOT EXISTS oracle_source TEXT;

-- ---------------------------------------------------------------------------
-- Index for filtering by market type
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_markets_market_type ON markets (market_type);
CREATE INDEX IF NOT EXISTS idx_markets_crypto_asset ON markets (crypto_asset) WHERE crypto_asset IS NOT NULL;
