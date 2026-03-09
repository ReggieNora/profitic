# Supabase Migration Plan (Phase 1 — Database Swap Only)

## Goal
Replace the raw `pg` PostgreSQL connection with `@supabase/supabase-js` in the backend. Keep Express API, WebSocket server, Solana indexer, and all frontend hooks exactly as they are.

---

## Step 1: Install dependencies & env vars
- Add `@supabase/supabase-js` to `/backend`
- Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `/backend/.env.example`
- Remove `pg` and `@types/pg` from `/backend`

**Files:** `backend/package.json`, `backend/.env.example`

## Step 2: Create Supabase client utility
- New file `/backend/src/lib/supabase.ts`
- Exports a service-role Supabase client (bypasses RLS for indexer writes)
- Reads from `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` env vars

**Files:** `backend/src/lib/supabase.ts` (new)

## Step 3: Create DB function for position upserts
- The current `upsertUserPosition()` uses `GREATEST(0, old + delta)` in an `ON CONFLICT` clause
- This atomic delta pattern doesn't map cleanly to the Supabase query builder
- Create a new migration with a Postgres `rpc` function that handles it server-side

**Files:** `migrations/003_position_upsert.sql` (new)

## Step 4: Rewrite database service
Replace all 15 functions in `/backend/src/services/database.ts`:

| Function | Supabase equivalent |
|---|---|
| `getPool()` / `closePool()` | Remove — Supabase client handles connections |
| `upsertMarket()` | `.from('markets').upsert()` |
| `updateMarketFields()` | `.from('markets').update().eq('id', id)` |
| `getMarketById()` | `.from('markets').select().eq('id', id).single()` |
| `getMarkets()` | `.from('markets').select().order().range()` with filters |
| `insertTrade()` | `.from('trades').upsert({ onConflict: 'tx_signature', ignoreDuplicates: true })` |
| `getTradesByMarket()` | `.from('trades').select().eq().order().range()` |
| `getUserTradeHistory()` | `.from('trades').select('*, markets!inner(question)').eq()` |
| `upsertUserPosition()` | `.rpc('upsert_position', { ... })` |
| `markPositionClaimed()` | `.from('user_positions').update().match()` |
| `getUserPositions()` | `.from('user_positions').select('*, markets!inner(question, status, ...)')` |
| `insertEvidenceLog()` | `.from('evidence_logs').upsert({ onConflict: 'tx_signature', ignoreDuplicates: true })` |
| `getEvidenceByMarket()` | `.from('evidence_logs').select().eq().order()` |
| `insertComment()` | `.from('comments').insert().select().single()` |
| `getCommentsByMarket()` | `.from('comments').select().eq().order().range()` |

**Key:** All function signatures stay identical — only internals change. The indexer and routes don't need modification.

**Files:** `backend/src/services/database.ts` (rewrite)

## Step 5: Update backend entry point
- Remove `closePool()` from graceful shutdown
- Health check uses Supabase query instead of raw `pool.query`

**Files:** `backend/src/index.ts` (minor edit)

## Step 6: Run schema in Supabase
- User runs `001_initial.sql`, `002_comments.sql`, and `003_position_upsert.sql` in Supabase SQL editor
- All features (ENUMs, triggers, pg_trgm, NUMERIC(20,0)) are natively supported

---

## What does NOT change
- Express API routes (all endpoints identical)
- WebSocket server (stays as custom `ws`)
- Solana indexer (same function calls, same event parsing)
- Frontend hooks (still call Express API)
- Frontend code (zero changes)

## Files changed summary
| File | Action |
|---|---|
| `backend/package.json` | Add supabase, remove pg |
| `backend/.env.example` | Add SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY |
| `backend/src/lib/supabase.ts` | **New** |
| `backend/src/services/database.ts` | **Rewrite** |
| `backend/src/index.ts` | Minor edit (remove pool cleanup) |
| `migrations/003_position_upsert.sql` | **New** |
