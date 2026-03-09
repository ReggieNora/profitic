-- ---------------------------------------------------------------------------
-- 003: Server-side function for atomic position upserts with delta arithmetic
-- ---------------------------------------------------------------------------
-- Called via Supabase .rpc('upsert_position', { ... }) from the indexer.
-- Handles the INSERT ... ON CONFLICT pattern with GREATEST(0, old + delta)
-- that can't be expressed cleanly through the Supabase query builder.

CREATE OR REPLACE FUNCTION upsert_position(
  p_market_id   BIGINT,
  p_user_address TEXT,
  p_yes_delta   NUMERIC(20,0),
  p_no_delta    NUMERIC(20,0),
  p_invest_delta NUMERIC(20,0)
) RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO user_positions (market_id, user_address, yes_tokens, no_tokens, total_invested)
  VALUES (
    p_market_id,
    p_user_address,
    GREATEST(0, p_yes_delta),
    GREATEST(0, p_no_delta),
    GREATEST(0, p_invest_delta)
  )
  ON CONFLICT (market_id, user_address) DO UPDATE SET
    yes_tokens     = GREATEST(0, user_positions.yes_tokens + p_yes_delta),
    no_tokens      = GREATEST(0, user_positions.no_tokens  + p_no_delta),
    total_invested = GREATEST(0, user_positions.total_invested + p_invest_delta);
$$;
