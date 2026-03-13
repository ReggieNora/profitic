/**
 * Devnet Setup Script — run once after deploying the binary_market program.
 *
 * Usage:
 *   npx ts-node scripts/devnet-setup.ts
 *
 * Prerequisites:
 *   - `anchor build && anchor deploy` completed
 *   - Update BINARY_MARKET_PROGRAM_ID below with real program ID from deploy output
 *   - Deployer wallet at ~/.config/solana/id.json must have devnet SOL
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  clusterApiUrl,
} from "@solana/web3.js";
import { AnchorProvider, Program, Idl, BN } from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

// ── Config ──
const PROGRAM_ID = new PublicKey(
  process.env.BINARY_MARKET_PROGRAM_ID ||
    "BinMkt11111111111111111111111111111111111111"
);

const CONFIG_SEED = Buffer.from("binary_config");
const ROUND_SEED = Buffer.from("binary_round");

// Pyth devnet feed addresses (SOL/USD, BTC/USD, ETH/USD)
const PYTH_FEEDS: Record<string, string> = {
  SOL: "J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix",
  BTC: "HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANBmJkuKh",
  ETH: "EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9GvYRhgBBTtDH",
};

const FEE_BPS = 200; // 2%

async function main() {
  // Load wallet
  const walletPath =
    process.env.WALLET_PATH ||
    path.join(process.env.HOME || "~", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log("Authority:", wallet.publicKey.toBase58());
  console.log("Program:", PROGRAM_ID.toBase58());

  // Connect
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  if (balance < 0.1 * 1e9) {
    console.log("Requesting airdrop...");
    const sig = await connection.requestAirdrop(wallet.publicKey, 2 * 1e9);
    await connection.confirmTransaction(sig);
    console.log("Airdrop confirmed");
  }

  // Load IDL — try from target/idl first, fallback to inline
  let idl: Idl;
  const idlPath = path.join(__dirname, "../target/idl/binary_market.json");
  if (fs.existsSync(idlPath)) {
    idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
    console.log("Loaded IDL from", idlPath);
  } else {
    // Use inline IDL (matches the frontend binaryMarketIdl.ts)
    idl = {
      version: "0.1.0",
      name: "binary_market",
      instructions: [
        {
          name: "initializeConfig",
          accounts: [
            { name: "config", isMut: true, isSigner: false },
            { name: "authority", isMut: true, isSigner: true },
            { name: "treasury", isMut: false, isSigner: false },
            { name: "systemProgram", isMut: false, isSigner: false },
          ],
          args: [{ name: "feeBps", type: "u16" }],
        },
        {
          name: "createRound",
          accounts: [
            { name: "round", isMut: true, isSigner: false },
            { name: "config", isMut: true, isSigner: false },
            { name: "authority", isMut: true, isSigner: true },
            { name: "systemProgram", isMut: false, isSigner: false },
          ],
          args: [
            { name: "asset", type: "string" },
            { name: "roundNumber", type: "u64" },
            { name: "duration", type: "i64" },
            { name: "lockBuffer", type: "i64" },
            { name: "pythFeed", type: "publicKey" },
          ],
        },
      ],
      accounts: [],
      types: [],
      errors: [],
    } as unknown as Idl;
    console.log("Using inline IDL (no target/idl found)");
  }

  const provider = new AnchorProvider(
    connection,
    { publicKey: wallet.publicKey, signTransaction: async (tx) => { tx.sign(wallet); return tx; }, signAllTransactions: async (txs) => { txs.forEach(tx => tx.sign(wallet)); return txs; } },
    { commitment: "confirmed" }
  );
  const program = new Program(idl, PROGRAM_ID, provider);

  // ── Step 1: Initialize Config ──
  const [configPda] = PublicKey.findProgramAddressSync(
    [CONFIG_SEED],
    PROGRAM_ID
  );

  const configAccount = await connection.getAccountInfo(configPda);
  if (configAccount) {
    console.log("\nConfig already initialized at", configPda.toBase58());
  } else {
    console.log("\nInitializing config...");
    const tx = await program.methods
      .initializeConfig(FEE_BPS)
      .accounts({
        config: configPda,
        authority: wallet.publicKey,
        treasury: wallet.publicKey, // use deployer as treasury for testing
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet])
      .rpc();
    console.log("Config initialized! tx:", tx);
  }

  // ── Step 2: Create initial rounds (one per asset) ──
  for (const [asset, feedAddr] of Object.entries(PYTH_FEEDS)) {
    const roundNumber = 1;
    const roundBuf = Buffer.alloc(8);
    roundBuf.writeBigUInt64LE(BigInt(roundNumber));

    const [roundPda] = PublicKey.findProgramAddressSync(
      [ROUND_SEED, Buffer.from(asset), roundBuf],
      PROGRAM_ID
    );

    const existing = await connection.getAccountInfo(roundPda);
    if (existing) {
      console.log(`Round ${asset}#${roundNumber} already exists at`, roundPda.toBase58());
      continue;
    }

    console.log(`Creating round ${asset}#${roundNumber}...`);
    const tx = await program.methods
      .createRound(
        asset,
        new BN(roundNumber),
        new BN(300),  // 5 min duration
        new BN(30),   // 30s lock buffer
        new PublicKey(feedAddr)
      )
      .accounts({
        round: roundPda,
        config: configPda,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([wallet])
      .rpc();
    console.log(`  Round created! tx: ${tx}`);
  }

  console.log("\nDevnet setup complete!");
  console.log("Config PDA:", configPda.toBase58());
}

main().catch(console.error);
