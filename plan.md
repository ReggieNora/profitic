# Devnet Testing Plan: Wire Up Binary Market On-Chain

## Current State
- **Anchor programs exist** — `binary_market` (place_bet, resolve_round, claim_winnings) and `profitic` (prediction markets)
- **Frontend is simulated** — `placeBet` updates local React state, claim shows `alert()`
- **useProgram hook exists** — but points to main `profitic` program, not `binary_market`
- **Program IDs are placeholders** — `BinMkt1111...`, `Prof1t1c1111...`
- **No binary_market IDL** in the frontend
- **Already on devnet RPC** — `https://api.devnet.solana.com`

## What We're Testing
Binary UP/DOWN rounds on devnet: connect wallet → place bet (real SOL transfer) → round resolves → claim winnings (real SOL payout).

---

## Step 1: Build & Deploy Binary Market Program to Devnet
- Run `anchor build` to compile the binary_market program
- Run `anchor deploy` to devnet (requires a funded deployer wallet)
- Capture the real program ID from deployment output
- Update `Anchor.toml` with the new program ID
- Generate the IDL file from the build

## Step 2: Add Binary Market IDL & Hook to Frontend
- Copy the generated IDL JSON from `target/idl/binary_market.json` into `app/src/lib/binaryMarketIdl.ts`
- Update `app/src/lib/constants.ts` with the real binary_market program ID
- Create `app/src/hooks/useBinaryProgram.ts` — similar to existing `useProgram.ts` but for the binary_market program

## Step 3: Initialize Platform Config (One-Time Admin Setup)
- Create a script or admin UI action to call `initialize_config(fee_bps: 200)` on-chain
- This creates the global BinaryConfig PDA that all rounds reference
- Only needs to run once per deployment

## Step 4: Wire Up Round Creation
- Currently rounds are created client-side in `useBinaryMarkets.ts` as local objects
- Add on-chain round creation: when a new round starts, call `create_round(asset, round_number, duration, lock_buffer, pyth_feed)`
- The round PDA is derived from `[ROUND_SEED, asset.as_bytes(), round_number.to_le_bytes()]`
- For devnet testing, the admin/crank wallet creates rounds

## Step 5: Wire Up Bet Placement (Core Change)
- In `useBinaryMarkets.ts`, update `placeBet` to:
  1. Derive the round PDA from asset + round_number
  2. Derive the bet PDA from `[BET_SEED, round.key(), user.key(), total_bets.to_le_bytes()]`
  3. Call `program.methods.placeBet(side, amount_lamports).accounts({...}).rpc()`
  4. On success, update local state as before (optimistic UI)
  5. On failure, show error toast and revert
- The program's `place_bet` does a `SystemProgram::transfer` from user → round escrow
- Amount flows: UI (SOL) → hook converts to lamports → on-chain transfer

## Step 6: Wire Up Round Resolution
- Add a crank/resolver that calls `resolve_round` when `clock.unix_timestamp >= end_time`
- For devnet testing, this can be a simple setInterval in the frontend or a backend script
- The program reads Pyth oracle price to determine UP/DOWN outcome
- Note: Current program has placeholder Pyth reading — may need to use real Pyth devnet feeds

## Step 7: Wire Up Claim Winnings
- In profile page or post-round UI, replace `alert()` with actual `claim_winnings` call
- Derive round PDA + bet PDA
- Call `program.methods.claimWinnings().accounts({...}).rpc()`
- Pro-rata payout: `(pool_after_fee * user_bet / winning_pool)` sent from round escrow → user

## Step 8: Add SOL Balance Display
- Use `connection.getBalance(publicKey)` to show actual wallet balance
- Show balance in Navbar next to wallet button
- Validate bet amount against balance before submitting
- Add "Max" button that uses actual balance minus rent reserve

## Step 9: Add Devnet Airdrop Button
- Add a "Get Devnet SOL" button in the UI (only visible on devnet)
- Calls `connection.requestAirdrop(publicKey, 2 * LAMPORTS_PER_SOL)`
- Helps testers get started without external faucet

---

## Key Risks & Decisions
- **Pyth devnet feeds**: The binary_market program references Pyth for price at resolution. Need to verify Pyth feed IDs work on devnet (they have separate devnet feed addresses)
- **Round creation authority**: Who creates rounds? Currently client-side. For devnet, a crank wallet or the admin can auto-create them
- **Transaction confirmation UX**: Need loading states and error handling for wallet signing popups
- **Rent costs**: Each bet PDA costs ~0.002 SOL in rent. Factor this into minimum bet amounts
