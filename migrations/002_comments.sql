-- =============================================================================
-- Profitic — Comments table for market discussions
-- =============================================================================
-- Run with:  psql $DATABASE_URL -f migrations/002_comments.sql

CREATE TABLE IF NOT EXISTS comments (
    id              BIGSERIAL PRIMARY KEY,
    market_id       BIGINT NOT NULL REFERENCES markets(id),
    user_address    TEXT NOT NULL,
    body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_market ON comments (market_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments (user_address, created_at DESC);
