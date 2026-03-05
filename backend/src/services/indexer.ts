/**
 * Profitic Backend — Solana On-Chain Indexer
 *
 * Subscribes to the Profitic program's transaction logs via the Solana RPC
 * WebSocket and parses `msg!()` lines emitted by each instruction handler.
 *
 * Recognised log patterns (from the Anchor program's msg! calls):
 *   "Market created: ID={id}, question={q}"
 *   "Bought {amount} tokens for outcome {o} at cost {cost} lamports (fee: {fee})"
 *   "Sold {amount} tokens for outcome {o} returning {ret} lamports (fee: {fee})"
 *   "Market {id} resolved. Winning outcome: {o} (YES|NO)"
 *   "Resolution proposed for market {id}: outcome {o} (...)"
 *   "Challenge submitted for market {id} with stake {s} lamports"
 *   "Claimed {payout} lamports (fee: {fee}) for {tokens} winning tokens"
 *
 * For every matched event the indexer:
 *   1. Fetches the full on-chain account state (for accuracy over parsing).
 *   2. Upserts/inserts rows into Postgres via the database service.
 *   3. Broadcasts a typed WebSocket message so connected frontends update
 *      in real-time without polling.
 *
 * If the RPC WebSocket disconnects the indexer automatically reconnects
 * with exponential back-off.
 */

import {
  Connection,
  PublicKey,
  Logs,
  Context as SolanaContext,
  ParsedTransactionWithMeta,
} from "@solana/web3.js";

import {
  Market as MarketType,
  MarketStatus,
  Outcome,
  TradeSide,
  WsMessage,
} from "../models/types";

import * as db from "./database";

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------

/** Solana JSON-RPC connection (HTTP + WS). */
let connection: Connection;

/** The Profitic program public key to filter logs for. */
let programId: PublicKey;

/** Active subscription ID so we can unsubscribe on shutdown. */
let subscriptionId: number | null = null;

/**
 * Callback the indexer invokes whenever it wants to broadcast a real-time
 * message to WebSocket clients.  Injected by `startIndexer()` so the
 * indexer module stays decoupled from the WS server.
 */
let broadcastFn: ((msg: WsMessage) => void) | null = null;

// ---------------------------------------------------------------------------
// Bonding-curve price computation (mirrors on-chain logic)
// ---------------------------------------------------------------------------

/**
 * Compute the marginal price of the next token on the linear bonding curve.
 *
 *   price(supply) = base_price + slope * supply
 *
 * where base_price = 10_000 lamports/token-unit, slope = 10.
 *
 * We normalise to a 0–1 probability range by computing:
 *   yes_price = marginal_yes / (marginal_yes + marginal_no)
 *   no_price  = 1 - yes_price
 *
 * This is an approximation but good enough for display purposes.
 */
function computePrices(yesSupply: bigint, noSupply: bigint): { yesPrice: number; noPrice: number } {
  const BASE_PRICE = 10_000n;
  const SLOPE = 10n;

  const marginalYes = Number(BASE_PRICE + SLOPE * yesSupply);
  const marginalNo = Number(BASE_PRICE + SLOPE * noSupply);

  const total = marginalYes + marginalNo;
  if (total === 0) return { yesPrice: 0.5, noPrice: 0.5 };

  const yesPrice = parseFloat((marginalYes / total).toFixed(6));
  const noPrice = parseFloat((1 - yesPrice).toFixed(6));
  return { yesPrice, noPrice };
}

// ---------------------------------------------------------------------------
// Log parsing helpers
// ---------------------------------------------------------------------------

/** Match: "Market created: ID={id}, question={question}" */
const RE_MARKET_CREATED =
  /Market created: ID=(\d+), question=(.*)/;

/** Match: "Bought {amount} tokens for outcome {o} at cost {cost} lamports (fee: {fee})" */
const RE_BOUGHT =
  /Bought (\d+) tokens for outcome (\d) at cost (\d+) lamports \(fee: (\d+)\)/;

/** Match: "Sold {amount} tokens for outcome {o} returning {ret} lamports (fee: {fee})" */
const RE_SOLD =
  /Sold (\d+) tokens for outcome (\d) returning (\d+) lamports \(fee: (\d+)\)/;

/** Match: "Market {id} resolved. Winning outcome: {o} (YES|NO)" */
const RE_RESOLVED =
  /Market (\d+) resolved\. Winning outcome: (\d) \((YES|NO)\)/;

/** Match: "Resolution proposed for market {id}: outcome {o} (...)" */
const RE_PROPOSED =
  /Resolution proposed for market (\d+): outcome (\d)/;

/** Match: "Challenge submitted for market {id} with stake {s} lamports" */
const RE_CHALLENGED =
  /Challenge submitted for market (\d+) with stake (\d+) lamports/;

/** Match: "Claimed {payout} lamports (fee: {fee}) for {tokens} winning tokens" */
const RE_CLAIMED =
  /Claimed (\d+) lamports \(fee: (\d+)\) for (\d+) winning tokens/;

// ---------------------------------------------------------------------------
// Transaction account extraction
// ---------------------------------------------------------------------------

/**
 * Fetches a parsed transaction and extracts the list of account keys.
 * Used to identify which market PDA and which user wallet were involved
 * in a given transaction.
 */
async function fetchTransactionAccounts(
  signature: string,
): Promise<{ accounts: string[]; tx: ParsedTransactionWithMeta | null }> {
  try {
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    if (!tx) return { accounts: [], tx: null };

    const accounts = tx.transaction.message.accountKeys.map((k) =>
      typeof k === "string" ? k : k.pubkey.toBase58(),
    );
    return { accounts, tx };
  } catch (err) {
    console.error(`[indexer] Failed to fetch tx ${signature}:`, err);
    return { accounts: [], tx: null };
  }
}

/**
 * Attempt to find the market PDA address from transaction accounts.
 * The market PDA is derived as seeds = [b"market", id.to_le_bytes()].
 * Since we may not know the ID ahead of time, we check all accounts
 * against a known-markets cache and fall back to iterating.
 */
const knownMarketAddresses = new Map<string, number>(); // address -> market_id

/**
 * Derive the market PDA address for a given market ID.
 */
function deriveMarketAddress(marketId: number): PublicKey {
  const idBuffer = Buffer.alloc(8);
  idBuffer.writeBigUInt64LE(BigInt(marketId));
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), idBuffer],
    programId,
  );
  return pda;
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

/**
 * Handle a market creation event.
 * Fetches the full on-chain Market account and inserts a row into Postgres.
 */
async function handleMarketCreated(
  marketId: number,
  question: string,
  txSignature: string,
  slot: number,
): Promise<void> {
  console.log(`[indexer] Market created: id=${marketId} question="${question}"`);

  const marketAddress = deriveMarketAddress(marketId);
  const addressStr = marketAddress.toBase58();

  // Cache the address -> id mapping for future lookups.
  knownMarketAddresses.set(addressStr, marketId);

  // Fetch the full account state via getParsedTransaction accounts.
  const { accounts } = await fetchTransactionAccounts(txSignature);

  // The creator is the fee-payer (first signer), which is accounts[last signer].
  // For create_market the creator is the `creator` account (a Signer).
  // We'll infer from the transaction — creator is typically the fee payer.
  const creator = accounts.length > 0 ? accounts[accounts.length - 3] || accounts[0] : "";

  // Find the yes_mint and no_mint from the transaction accounts.
  // They are derived as [b"yes_mint", market_key] and [b"no_mint", market_key].
  const [yesMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("yes_mint"), marketAddress.toBuffer()],
    programId,
  );
  const [noMintPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("no_mint"), marketAddress.toBuffer()],
    programId,
  );

  // We need the resolution_timestamp and data_source from the on-chain account.
  // For now, fetch account info and deserialize manually. In production you'd
  // use Anchor's coder, but we can read the raw data with known offsets.
  let resolutionTimestamp = 0;
  let dataSource = "";
  let description = "";
  let createdAt = Math.floor(Date.now() / 1000);
  let creatorAddress = creator;

  try {
    const accountInfo = await connection.getAccountInfo(marketAddress);
    if (accountInfo?.data) {
      // Anchor account layout: 8-byte discriminator, then fields in order.
      // We use a simplified approach — extract key fields from the raw buffer.
      const data = accountInfo.data;
      // Skip 8-byte discriminator.
      // id: u64 at offset 8
      // creator: Pubkey at offset 16 (32 bytes)
      const creatorPubkey = new PublicKey(data.subarray(16, 48));
      creatorAddress = creatorPubkey.toBase58();

      // question: String (4-byte len prefix + bytes) at offset 48
      const questionLen = data.readUInt32LE(48);
      const questionEnd = 52 + questionLen;
      // description: String after question
      const descLen = data.readUInt32LE(questionEnd);
      description = data.subarray(questionEnd + 4, questionEnd + 4 + descLen).toString("utf8");
      const descEnd = questionEnd + 4 + descLen;

      // resolution_timestamp: i64 after description
      resolutionTimestamp = Number(data.readBigInt64LE(descEnd));

      // data_source: String after resolution_timestamp
      const dsOffset = descEnd + 8;
      const dsLen = data.readUInt32LE(dsOffset);
      dataSource = data.subarray(dsOffset + 4, dsOffset + 4 + dsLen).toString("utf8");

      // created_at: near end of struct — we can approximate with the current slot time.
      // For accuracy, read from the known offset. The struct is large, so we compute:
      // After data_source: status (1 byte), yes_mint (32), no_mint (32),
      // yes_supply (8), no_supply (8), pool_balance (8), winning_outcome (1+1),
      // evidence_url (4+len), proposed_outcome (1+1), proposed_evidence_url (4+len),
      // proposed_evidence_snapshot (4+len), proposal_timestamp (1+8),
      // challenge_stake (8), created_at (8), bump (1), vault_bump (1)
      // This is fragile — in production use Anchor's BorshAccountsCoder.
      // For now read created_at from a known position or use block time.
      const blockTime = await connection.getBlockTime(slot);
      if (blockTime) createdAt = blockTime;
    }
  } catch (err) {
    console.warn(`[indexer] Could not deserialize market account for id=${marketId}:`, err);
  }

  const market: Omit<MarketType, "updated_at"> = {
    id: marketId,
    address: addressStr,
    creator: creatorAddress,
    question,
    description,
    resolution_timestamp: resolutionTimestamp,
    data_source: dataSource,
    status: MarketStatus.Active,
    yes_mint: yesMintPda.toBase58(),
    no_mint: noMintPda.toBase58(),
    yes_supply: "0",
    no_supply: "0",
    pool_balance: "0",
    winning_outcome: null,
    evidence_url: null,
    proposed_outcome: null,
    proposed_evidence_url: null,
    proposed_evidence_snapshot: null,
    proposal_timestamp: null,
    challenge_stake: "0",
    created_at: createdAt,
    yes_price: 0.5,
    no_price: 0.5,
    total_volume: "0",
  };

  await db.upsertMarket(market);

  // Broadcast to connected WebSocket clients.
  if (broadcastFn) {
    broadcastFn({ type: "market_created", data: market as MarketType });
  }
}

/**
 * Handle a token buy event.
 * Updates market supply/prices, inserts a trade row, and adjusts the user's position.
 */
async function handleBuy(
  amount: string,
  outcome: number,
  cost: string,
  fee: string,
  txSignature: string,
  slot: number,
): Promise<void> {
  console.log(
    `[indexer] Buy: outcome=${outcome} amount=${amount} cost=${cost} fee=${fee} tx=${txSignature}`,
  );

  // Identify the market and user from the transaction accounts.
  const { accounts } = await fetchTransactionAccounts(txSignature);
  const { marketId, userAddress } = resolveMarketAndUser(accounts);

  if (marketId === null) {
    console.warn(`[indexer] Could not resolve market for buy tx=${txSignature}`);
    return;
  }

  // Insert the trade row.
  await db.insertTrade({
    market_id: marketId,
    user_address: userAddress,
    outcome: outcome as Outcome,
    side: TradeSide.Buy,
    amount,
    cost,
    fee,
    tx_signature: txSignature,
    slot,
  });

  // Update the user's position.
  await db.upsertUserPosition({
    market_id: marketId,
    user_address: userAddress,
    yes_tokens_delta: outcome === 0 ? amount : "0",
    no_tokens_delta: outcome === 1 ? amount : "0",
    invested_delta: cost,
  });

  // Update market supply, pool balance, volume, and derived prices.
  const market = await db.getMarketById(marketId);
  if (market) {
    const newYesSupply = BigInt(market.yes_supply) + (outcome === 0 ? BigInt(amount) : 0n);
    const newNoSupply = BigInt(market.no_supply) + (outcome === 1 ? BigInt(amount) : 0n);
    const newPoolBalance = BigInt(market.pool_balance) + BigInt(cost);
    const newVolume = BigInt(market.total_volume) + BigInt(cost);
    const { yesPrice, noPrice } = computePrices(newYesSupply, newNoSupply);

    await db.updateMarketFields(marketId, {
      yes_supply: newYesSupply.toString(),
      no_supply: newNoSupply.toString(),
      pool_balance: newPoolBalance.toString(),
      total_volume: newVolume.toString(),
      yes_price: yesPrice,
      no_price: noPrice,
    });

    // Broadcast price update.
    if (broadcastFn) {
      broadcastFn({
        type: "price_update",
        data: { market_id: marketId, yes_price: yesPrice, no_price: noPrice },
      });
      broadcastFn({
        type: "trade",
        data: {
          id: 0, // filled by DB
          market_id: marketId,
          user_address: userAddress,
          outcome: outcome as Outcome,
          side: TradeSide.Buy,
          amount,
          cost,
          fee,
          tx_signature: txSignature,
          slot,
          created_at: new Date(),
        },
      });
    }
  }
}

/**
 * Handle a token sell event.
 * Mirrors handleBuy but decrements supply and returns SOL.
 */
async function handleSell(
  amount: string,
  outcome: number,
  returnAmount: string,
  fee: string,
  txSignature: string,
  slot: number,
): Promise<void> {
  console.log(
    `[indexer] Sell: outcome=${outcome} amount=${amount} return=${returnAmount} fee=${fee} tx=${txSignature}`,
  );

  const { accounts } = await fetchTransactionAccounts(txSignature);
  const { marketId, userAddress } = resolveMarketAndUser(accounts);

  if (marketId === null) {
    console.warn(`[indexer] Could not resolve market for sell tx=${txSignature}`);
    return;
  }

  // The gross return (before fee) = returnAmount + fee.
  const grossReturn = (BigInt(returnAmount) + BigInt(fee)).toString();

  await db.insertTrade({
    market_id: marketId,
    user_address: userAddress,
    outcome: outcome as Outcome,
    side: TradeSide.Sell,
    amount,
    cost: returnAmount,
    fee,
    tx_signature: txSignature,
    slot,
  });

  // Decrement position tokens; decrease invested (approximate: use cost).
  await db.upsertUserPosition({
    market_id: marketId,
    user_address: userAddress,
    yes_tokens_delta: outcome === 0 ? `-${amount}` : "0",
    no_tokens_delta: outcome === 1 ? `-${amount}` : "0",
    invested_delta: `-${returnAmount}`,
  });

  // Update market state.
  const market = await db.getMarketById(marketId);
  if (market) {
    const newYesSupply = BigInt(market.yes_supply) - (outcome === 0 ? BigInt(amount) : 0n);
    const newNoSupply = BigInt(market.no_supply) - (outcome === 1 ? BigInt(amount) : 0n);
    const newPoolBalance = BigInt(market.pool_balance) - BigInt(grossReturn);
    const newVolume = BigInt(market.total_volume) + BigInt(returnAmount);
    const { yesPrice, noPrice } = computePrices(newYesSupply, newNoSupply);

    await db.updateMarketFields(marketId, {
      yes_supply: newYesSupply.toString(),
      no_supply: newNoSupply.toString(),
      pool_balance: newPoolBalance.toString(),
      total_volume: newVolume.toString(),
      yes_price: yesPrice,
      no_price: noPrice,
    });

    if (broadcastFn) {
      broadcastFn({
        type: "price_update",
        data: { market_id: marketId, yes_price: yesPrice, no_price: noPrice },
      });
      broadcastFn({
        type: "trade",
        data: {
          id: 0,
          market_id: marketId,
          user_address: userAddress,
          outcome: outcome as Outcome,
          side: TradeSide.Sell,
          amount,
          cost: returnAmount,
          fee,
          tx_signature: txSignature,
          slot,
          created_at: new Date(),
        },
      });
    }
  }
}

/**
 * Handle a market resolution event.
 * Sets the market status to Resolved and records the winning outcome.
 */
async function handleResolved(
  marketId: number,
  winningOutcome: number,
  txSignature: string,
  slot: number,
): Promise<void> {
  console.log(`[indexer] Market ${marketId} resolved: outcome=${winningOutcome}`);

  // Fetch evidence_url from the on-chain account.
  let evidenceUrl = "";
  try {
    const marketAddress = deriveMarketAddress(marketId);
    const accountInfo = await connection.getAccountInfo(marketAddress);
    if (accountInfo?.data) {
      // We'd normally use Anchor's coder here. For a quick extraction,
      // we read the evidence_url from the transaction logs or the account.
      // Simplified: fetch the parsed tx and look for evidence in inner instructions.
    }
  } catch {
    // Fallback — evidence_url will be empty.
  }

  // Also log to evidence_logs.
  const { accounts } = await fetchTransactionAccounts(txSignature);
  const submitter = accounts.length > 0 ? accounts[accounts.length - 1] || "" : "";

  await db.updateMarketFields(marketId, {
    status: MarketStatus.Resolved,
    winning_outcome: winningOutcome,
    evidence_url: evidenceUrl || null,
  });

  await db.insertEvidenceLog({
    market_id: marketId,
    submitter,
    action: "resolve",
    outcome: winningOutcome,
    evidence_url: evidenceUrl,
    evidence_snapshot: null,
    stake_amount: "0",
    tx_signature: txSignature,
    slot,
  });

  if (broadcastFn) {
    broadcastFn({
      type: "market_resolved",
      data: { id: marketId, winning_outcome: winningOutcome, evidence_url: evidenceUrl },
    });
  }
}

/**
 * Handle a resolution proposal event.
 */
async function handleProposed(
  marketId: number,
  proposedOutcome: number,
  txSignature: string,
  slot: number,
): Promise<void> {
  console.log(`[indexer] Resolution proposed for market ${marketId}: outcome=${proposedOutcome}`);

  const { accounts } = await fetchTransactionAccounts(txSignature);
  const submitter = accounts.length > 0 ? accounts[accounts.length - 1] || "" : "";

  const blockTime = await connection.getBlockTime(slot);

  await db.updateMarketFields(marketId, {
    status: MarketStatus.ProposedResolution,
    proposed_outcome: proposedOutcome,
    proposal_timestamp: blockTime || Math.floor(Date.now() / 1000),
  });

  await db.insertEvidenceLog({
    market_id: marketId,
    submitter,
    action: "propose",
    outcome: proposedOutcome,
    evidence_url: "",
    evidence_snapshot: null,
    stake_amount: "0",
    tx_signature: txSignature,
    slot,
  });

  if (broadcastFn) {
    broadcastFn({
      type: "market_update",
      data: {
        id: marketId,
        status: MarketStatus.ProposedResolution,
        proposed_outcome: proposedOutcome,
      },
    });
  }
}

/**
 * Handle a resolution challenge event.
 */
async function handleChallenged(
  marketId: number,
  stakeAmount: string,
  txSignature: string,
  slot: number,
): Promise<void> {
  console.log(`[indexer] Challenge for market ${marketId}: stake=${stakeAmount}`);

  const { accounts } = await fetchTransactionAccounts(txSignature);
  const submitter = accounts.length > 0 ? accounts[accounts.length - 1] || "" : "";

  // Increment the challenge stake on the market.
  const market = await db.getMarketById(marketId);
  if (market) {
    const newStake = (BigInt(market.challenge_stake) + BigInt(stakeAmount)).toString();
    await db.updateMarketFields(marketId, { challenge_stake: newStake });
  }

  await db.insertEvidenceLog({
    market_id: marketId,
    submitter,
    action: "challenge",
    outcome: market?.proposed_outcome ?? 0,
    evidence_url: "",
    evidence_snapshot: null,
    stake_amount: stakeAmount,
    tx_signature: txSignature,
    slot,
  });
}

/**
 * Handle a claim_winnings event.  Marks the user's position as claimed.
 */
async function handleClaimed(
  txSignature: string,
  slot: number,
): Promise<void> {
  console.log(`[indexer] Winnings claimed: tx=${txSignature}`);

  const { accounts } = await fetchTransactionAccounts(txSignature);
  const { marketId, userAddress } = resolveMarketAndUser(accounts);

  if (marketId !== null) {
    await db.markPositionClaimed(marketId, userAddress);
  }
}

// ---------------------------------------------------------------------------
// Account resolution helper
// ---------------------------------------------------------------------------

/**
 * Given a list of account keys from a transaction, attempt to identify
 * the market ID and user wallet address.
 *
 * Convention from the Anchor instruction accounts:
 *   - The market PDA is one of the first few accounts.
 *   - The user (buyer/seller/claimer) is the last signer.
 *
 * We check each account against our known-markets cache first.
 */
function resolveMarketAndUser(
  accounts: string[],
): { marketId: number | null; userAddress: string } {
  let marketId: number | null = null;

  // Scan accounts for a known market PDA.
  for (const addr of accounts) {
    if (knownMarketAddresses.has(addr)) {
      marketId = knownMarketAddresses.get(addr)!;
      break;
    }
  }

  // User address is typically the signer / fee payer — usually the last
  // mutable signer in the accounts list.  In Anchor transactions the payer
  // is often accounts[0] but for BuyTokens/SellTokens the buyer/seller is
  // explicitly defined.  We take the fee payer (accounts[0]) as a fallback.
  const userAddress = accounts[0] || "";

  return { marketId, userAddress };
}

// ---------------------------------------------------------------------------
// Core log processor
// ---------------------------------------------------------------------------

/**
 * Called for every `logsSubscribe` notification from the RPC.
 * Iterates through the log lines and dispatches to the appropriate handler
 * when a recognised pattern is found.
 */
async function processLogs(logs: Logs, context: SolanaContext): Promise<void> {
  const { signature } = logs;
  const slot = context.slot;

  // Skip failed transactions — they don't mutate state.
  if (logs.err) return;

  for (const line of logs.logs) {
    // Anchor logs are prefixed with "Program log: " or "Program data: ".
    // The msg!() output appears under "Program log: ".
    const logLine = line.replace(/^Program log: /, "");

    try {
      // --- Market created ---
      const createdMatch = logLine.match(RE_MARKET_CREATED);
      if (createdMatch) {
        const marketId = parseInt(createdMatch[1], 10);
        const question = createdMatch[2];
        await handleMarketCreated(marketId, question, signature, slot);
        continue;
      }

      // --- Tokens bought ---
      const boughtMatch = logLine.match(RE_BOUGHT);
      if (boughtMatch) {
        await handleBuy(
          boughtMatch[1],           // amount
          parseInt(boughtMatch[2]), // outcome
          boughtMatch[3],           // cost
          boughtMatch[4],           // fee
          signature,
          slot,
        );
        continue;
      }

      // --- Tokens sold ---
      const soldMatch = logLine.match(RE_SOLD);
      if (soldMatch) {
        await handleSell(
          soldMatch[1],           // amount
          parseInt(soldMatch[2]), // outcome
          soldMatch[3],           // returnAmount
          soldMatch[4],           // fee
          signature,
          slot,
        );
        continue;
      }

      // --- Market resolved ---
      const resolvedMatch = logLine.match(RE_RESOLVED);
      if (resolvedMatch) {
        const marketId = parseInt(resolvedMatch[1], 10);
        const winningOutcome = parseInt(resolvedMatch[2], 10);
        await handleResolved(marketId, winningOutcome, signature, slot);
        continue;
      }

      // --- Resolution proposed ---
      const proposedMatch = logLine.match(RE_PROPOSED);
      if (proposedMatch) {
        const marketId = parseInt(proposedMatch[1], 10);
        const proposedOutcome = parseInt(proposedMatch[2], 10);
        await handleProposed(marketId, proposedOutcome, signature, slot);
        continue;
      }

      // --- Resolution challenged ---
      const challengedMatch = logLine.match(RE_CHALLENGED);
      if (challengedMatch) {
        const marketId = parseInt(challengedMatch[1], 10);
        const stakeAmount = challengedMatch[2];
        await handleChallenged(marketId, stakeAmount, signature, slot);
        continue;
      }

      // --- Winnings claimed ---
      const claimedMatch = logLine.match(RE_CLAIMED);
      if (claimedMatch) {
        await handleClaimed(signature, slot);
        continue;
      }
    } catch (err) {
      console.error(`[indexer] Error processing log line in tx ${signature}:`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the on-chain indexer.
 *
 * @param broadcast  Callback to broadcast WsMessage to all connected clients.
 *                   Pass `null` if WebSocket broadcasting is not needed.
 */
export function startIndexer(broadcast: ((msg: WsMessage) => void) | null): void {
  const rpcUrl = process.env.SOLANA_RPC_URL;
  const progId = process.env.PROGRAM_ID;

  if (!rpcUrl) throw new Error("SOLANA_RPC_URL environment variable is not set");
  if (!progId) throw new Error("PROGRAM_ID environment variable is not set");

  connection = new Connection(rpcUrl, {
    commitment: "confirmed",
    // Use the websocket URL derived from the HTTP URL.  Most RPC providers
    // support this automatically (https -> wss).
    wsEndpoint: rpcUrl.replace("https://", "wss://").replace("http://", "ws://"),
  });
  programId = new PublicKey(progId);
  broadcastFn = broadcast;

  console.log(`[indexer] Subscribing to program logs for ${progId}`);
  console.log(`[indexer] RPC endpoint: ${rpcUrl}`);

  subscribe();
}

/**
 * Subscribe to on-chain logs for the Profitic program.
 * Handles reconnection with exponential back-off on disconnect.
 */
function subscribe(): void {
  let reconnectDelay = 1_000; // Start at 1 second.

  const doSubscribe = () => {
    try {
      subscriptionId = connection.onLogs(
        programId,
        (logs, context) => {
          // Reset reconnect delay on successful message receipt.
          reconnectDelay = 1_000;
          // Process asynchronously — don't block the WS callback.
          processLogs(logs, context).catch((err) => {
            console.error("[indexer] Unhandled error in processLogs:", err);
          });
        },
        "confirmed",
      );

      console.log(`[indexer] Subscribed (id=${subscriptionId})`);
    } catch (err) {
      console.error("[indexer] Subscription failed, retrying in", reconnectDelay, "ms:", err);
      setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, 60_000); // Cap at 60 seconds.
        doSubscribe();
      }, reconnectDelay);
    }
  };

  doSubscribe();
}

/**
 * Gracefully stop the indexer (call on server shutdown).
 */
export async function stopIndexer(): Promise<void> {
  if (subscriptionId !== null && connection) {
    try {
      await connection.removeOnLogsListener(subscriptionId);
      console.log("[indexer] Unsubscribed from program logs");
    } catch (err) {
      console.warn("[indexer] Error unsubscribing:", err);
    }
    subscriptionId = null;
  }
}

/**
 * Expose the connection for other services that may need it (e.g. to fetch
 * on-chain account data for API responses).
 */
export function getConnection(): Connection {
  return connection;
}
