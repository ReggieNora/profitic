/**
 * Devnet Setup Script for Yield Farm — run once after deploying the yield_farm program.
 *
 * Usage:
 *   npx ts-node scripts/devnet-setup-farm.ts
 *
 * Prerequisites:
 *   - `anchor build && anchor deploy` completed
 *   - Deployer wallet at ~/.config/solana/id.json must have devnet SOL
 *
 * What it does:
 *   1. Initializes the farm config PDA (sets authority + reward authority)
 *   2. Funds the stake vault with SOL for reward payouts
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

// ── Config ──
const PROGRAM_ID = new PublicKey(
  process.env.YIELD_FARM_PROGRAM_ID ||
    "EyAQAxKyjWbSbf991RftzpXHkcGqgaG2VDLjSUgjE1M6"
);

const FARM_CONFIG_SEED = Buffer.from("farm_config");
const STAKE_VAULT_SEED = Buffer.from("stake_vault");

// How much SOL to seed the vault with for reward payouts (default 2 SOL)
const INITIAL_VAULT_FUND_SOL = parseFloat(
  process.env.VAULT_FUND_SOL || "0.1"
);

async function main() {
  // Load wallet
  const walletPath =
    process.env.WALLET_PATH ||
    path.join(process.env.HOME || "~", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log("Authority:", wallet.publicKey.toBase58());
  console.log("Program: ", PROGRAM_ID.toBase58());

  // Connect
  const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl("devnet");
  const connection = new Connection(rpcUrl, "confirmed");
  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance: ", balance / 1e9, "SOL");

  if (balance < 0.01 * 1e9) {
    console.error("Insufficient balance. Please fund the wallet with devnet SOL.");
    process.exit(1);
  }

  // Load IDL
  let idl: Idl;
  const idlPath = path.join(__dirname, "../target/idl/yield_farm.json");
  if (fs.existsSync(idlPath)) {
    idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
    console.log("Loaded IDL from", idlPath);
  } else {
    // Inline fallback matching the on-chain program
    idl = {
      version: "0.1.0",
      name: "yield_farm",
      instructions: [
        {
          name: "initializeFarm",
          accounts: [
            { name: "farmConfig", isMut: true, isSigner: false },
            { name: "stakeVault", isMut: true, isSigner: false },
            { name: "authority", isMut: true, isSigner: true },
            { name: "systemProgram", isMut: false, isSigner: false },
          ],
          args: [{ name: "rewardAuthority", type: "publicKey" }],
        },
        {
          name: "fundVault",
          accounts: [
            { name: "farmConfig", isMut: false, isSigner: false },
            { name: "stakeVault", isMut: true, isSigner: false },
            { name: "funder", isMut: true, isSigner: true },
            { name: "systemProgram", isMut: false, isSigner: false },
          ],
          args: [{ name: "amount", type: "u64" }],
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
    {
      publicKey: wallet.publicKey,
      signTransaction: async (tx: any) => {
        tx.sign(wallet);
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        txs.forEach((tx: any) => tx.sign(wallet));
        return txs;
      },
    },
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
      if (err.signature) {
        sig = err.signature;
        console.log("  Tx sent (confirmation timed out, polling via CLI):", sig);
      } else {
        throw err;
      }
    }
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

  // ── Derive PDAs ──
  const [farmConfigPda] = PublicKey.findProgramAddressSync(
    [FARM_CONFIG_SEED],
    PROGRAM_ID
  );
  const [stakeVaultPda] = PublicKey.findProgramAddressSync(
    [STAKE_VAULT_SEED],
    PROGRAM_ID
  );

  console.log("\nFarm Config PDA:", farmConfigPda.toBase58());
  console.log("Stake Vault PDA:", stakeVaultPda.toBase58());

  // ── Step 1: Initialize Farm ──
  const configAccount = await connection.getAccountInfo(farmConfigPda);
  if (configAccount) {
    console.log("\nFarm config already initialized.");
  } else {
    console.log("\nInitializing farm config...");
    // Use deployer as both authority and reward authority for devnet
    const tx = await sendAndConfirmViaCli(
      program.methods
        .initializeFarm(wallet.publicKey)
        .accounts({
          farmConfig: farmConfigPda,
          stakeVault: stakeVaultPda,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([wallet])
    );
    console.log("Farm initialized! tx:", tx);
  }

  // ── Step 2: Fund the vault ──
  const vaultBalance = await connection.getBalance(stakeVaultPda);
  const fundLamports = Math.floor(INITIAL_VAULT_FUND_SOL * 1e9);
  console.log(`\nVault balance: ${vaultBalance / 1e9} SOL`);

  if (vaultBalance < fundLamports) {
    const needed = fundLamports - vaultBalance;
    console.log(`Funding vault with ${needed / 1e9} SOL...`);
    const tx = await sendAndConfirmViaCli(
      program.methods
        .fundVault(new BN(needed))
        .accounts({
          farmConfig: farmConfigPda,
          stakeVault: stakeVaultPda,
          funder: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([wallet])
    );
    console.log("Vault funded! tx:", tx);
  } else {
    console.log("Vault already has sufficient funds.");
  }

  // ── Done ──
  const finalVault = await connection.getBalance(stakeVaultPda);
  console.log("\n=== Devnet Farm Setup Complete ===");
  console.log("Farm Config:", farmConfigPda.toBase58());
  console.log("Stake Vault:", stakeVaultPda.toBase58());
  console.log("Vault balance:", finalVault / 1e9, "SOL");
  console.log("\nUsers can now stake SOL via the /farm page.");
}

main().catch(console.error);
