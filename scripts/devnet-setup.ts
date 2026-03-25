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
// Configure proxy for Node.js native fetch (undici)
const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || "";
if (proxyUrl) {
  const { ProxyAgent, setGlobalDispatcher } = require("undici");
  setGlobalDispatcher(new ProxyAgent(proxyUrl));
}
// @ts-ignore
const fetch = global.fetch;
// ── Config ──
const PROGRAM_ID = new PublicKey(
  process.env.BINARY_MARKET_PROGRAM_ID ||
    "5YwWnHt7k3hriR4HkJUZMzoEoQ5Tsbo8RyNo6rHfpXAr"
);

const CONFIG_SEED = Buffer.from("binary_config");
const ROUND_SEED = Buffer.from("binary_round");

// Pyth devnet feed addresses (SOL/USD, BTC/USD, ETH/USD)
const PYTH_FEEDS: Record<string, string> = {
  SOL: "J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix",
  BTC: "HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANBmJkuKh",
  ETH: "EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9GvYRhgBBTtDH",
};

// Pyth Hermes feed IDs for fetching live prices
const PYTH_HERMES_IDS: Record<string, string> = {
  BTC: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  ETH: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  SOL: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
};

async function fetchPythPrice(asset: string): Promise<number> {
  const feedId = PYTH_HERMES_IDS[asset];
  if (!feedId) return 0;
  try {
    const resp = await fetch(
      `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedId}`
    );
    const data = await resp.json();
    const parsed = data?.parsed?.[0]?.price;
    if (!parsed) return 0;
    const price = Number(parsed.price) * Math.pow(10, Number(parsed.expo));
    return price > 0 ? price : 0;
  } catch {
    return 0;
  }
}

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
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
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
  if (false && fs.existsSync(idlPath)) {
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
            { name: "startPrice", type: "u64" },
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
    { publicKey: wallet.publicKey, signTransaction: async (tx: any) => { tx.sign(wallet); return tx; }, signAllTransactions: async (txs: any[]) => { txs.forEach((tx: any) => tx.sign(wallet)); return txs; } } as any,
    { commitment: "confirmed", skipPreflight: true, preflightCommitment: "processed" }
  );
  const program = new Program(idl, PROGRAM_ID, provider);

  // Helper: send tx and confirm via CLI polling (avoids WS timeout)
  const { execSync } = require("child_process");
  const solanaPath = "/root/.local/share/solana/install/active_release/bin/solana";

  async function sendAndConfirmViaCli(methodBuilder: any): Promise<string> {
    let sig: string;
    try {
      sig = await methodBuilder.rpc({ skipPreflight: true });
    } catch (err: any) {
      // Extract signature from timeout error
      if (err.signature) {
        sig = err.signature;
        console.log("  Tx sent (confirmation timed out, polling via CLI):", sig);
      } else {
        throw err;
      }
    }

    // Poll for confirmation via CLI
    for (let i = 0; i < 30; i++) {
      try {
        const result = execSync(`${solanaPath} confirm ${sig} 2>&1`, { encoding: "utf-8" }).trim();
        if (result.includes("Finalized") || result.includes("Confirmed")) {
          console.log("  Confirmed:", result);
          return sig;
        }
      } catch {}
      await new Promise((r: any) => setTimeout(r, 2000));
    }
    console.log("  Warning: could not confirm tx, but it may have succeeded");
    return sig!;
  }

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
    await sendAndConfirmViaCli(
      program.methods
        .initializeConfig(FEE_BPS)
        .accounts({
          config: configPda,
          authority: wallet.publicKey,
          treasury: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([wallet])
    );
    console.log("Config initialized!");
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

    // Fetch current price from Pyth Hermes API
    const priceUsd = await fetchPythPrice(asset);
    const startPriceBn = new BN(Math.round(priceUsd * 1e8));
    console.log(`Creating round ${asset}#${roundNumber} (start: $${priceUsd})...`);
    await sendAndConfirmViaCli(
      program.methods
        .createRound(
          asset,
          new BN(roundNumber),
          new BN(300),  // 5 min duration
          new BN(30),   // 30s lock buffer
          startPriceBn, // caller-provided price
        )
        .accounts({
          round: roundPda,
          config: configPda,
          payer: wallet.publicKey,
          pythFeed: new PublicKey(feedAddr),
          systemProgram: SystemProgram.programId,
        })
        .signers([wallet])
    );
    console.log(`  Round ${asset}#${roundNumber} created!`);
  }

  console.log("\nDevnet setup complete!");
  console.log("Config PDA:", configPda.toBase58());
}

main().catch(console.error);
