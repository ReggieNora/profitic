/**
 * Devnet Crank — resolves expired rounds and creates new ones in a loop.
 *
 * Usage:
 *   npx ts-node scripts/devnet-crank.ts
 *
 * This runs indefinitely, checking every 10s for rounds that need resolving.
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

const PROGRAM_ID = new PublicKey(
  process.env.BINARY_MARKET_PROGRAM_ID ||
    "2ypR65WzGpXA5tzsMq35neo2pxyN8J1ikmpVWD2qstRj"
);

const CONFIG_SEED = Buffer.from("binary_config");
const ROUND_SEED = Buffer.from("binary_round");

const PYTH_FEEDS: Record<string, string> = {
  SOL: "J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix",
  BTC: "HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANBmJkuKh",
  ETH: "EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9GvYRhgBBTtDH",
};

const ASSETS = ["BTC", "ETH", "SOL"];
const ROUND_DURATION = 300; // 5 min
const LOCK_BUFFER = 30; // 30s
const CHECK_INTERVAL = 10_000; // 10s

// Track current round number per asset
const roundNumbers: Record<string, number> = {};

async function main() {
  const walletPath =
    process.env.WALLET_PATH ||
    path.join(process.env.HOME || "~", ".config/solana/id.json");
  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(Uint8Array.from(secretKey));

  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  const provider = new AnchorProvider(
    connection,
    {
      publicKey: wallet.publicKey,
      signTransaction: async (tx) => { tx.sign(wallet); return tx; },
      signAllTransactions: async (txs) => { txs.forEach(tx => tx.sign(wallet)); return txs; },
    },
    { commitment: "confirmed" }
  );

  // Load IDL
  const idlPath = path.join(__dirname, "../target/idl/binary_market.json");
  let idl: Idl;
  if (fs.existsSync(idlPath)) {
    idl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  } else {
    console.error("IDL not found at", idlPath);
    console.error("Run `anchor build` first to generate the IDL.");
    process.exit(1);
  }

  const program = new Program(idl, PROGRAM_ID, provider);
  const [configPda] = PublicKey.findProgramAddressSync([CONFIG_SEED], PROGRAM_ID);

  console.log("Crank started");
  console.log("Authority:", wallet.publicKey.toBase58());
  console.log("Checking every", CHECK_INTERVAL / 1000, "seconds\n");

  // Find current round numbers by scanning
  for (const asset of ASSETS) {
    let rn = 1;
    while (true) {
      const buf = Buffer.alloc(8);
      buf.writeBigUInt64LE(BigInt(rn));
      const [pda] = PublicKey.findProgramAddressSync(
        [ROUND_SEED, Buffer.from(asset), buf],
        PROGRAM_ID
      );
      const info = await connection.getAccountInfo(pda);
      if (!info) break;
      rn++;
    }
    roundNumbers[asset] = rn - 1;
    console.log(`${asset}: latest round #${roundNumbers[asset]}`);
  }

  // Main loop
  async function tick() {
    const now = Math.floor(Date.now() / 1000);

    for (const asset of ASSETS) {
      const rn = roundNumbers[asset] || 0;
      if (rn === 0) continue;

      const buf = Buffer.alloc(8);
      buf.writeBigUInt64LE(BigInt(rn));
      const [roundPda] = PublicKey.findProgramAddressSync(
        [ROUND_SEED, Buffer.from(asset), buf],
        PROGRAM_ID
      );

      try {
        const roundAccount = await program.account.binaryRoundAccount.fetch(roundPda);
        const endTime = (roundAccount.endTime as BN).toNumber();
        const phase = roundAccount.phase;

        // Check if phase is Betting or Locked (not yet Complete) and time expired
        if (phase && typeof phase === "object" && !("complete" in phase) && now >= endTime) {
          console.log(`\nResolving ${asset}#${rn}...`);
          const pythFeed = new PublicKey(PYTH_FEEDS[asset]);

          const tx = await program.methods
            .resolveRound()
            .accounts({
              round: roundPda,
              config: configPda,
              pythFeed,
              cranker: wallet.publicKey,
            })
            .signers([wallet])
            .rpc();
          console.log(`  Resolved! tx: ${tx}`);

          // Create next round
          const nextRn = rn + 1;
          roundNumbers[asset] = nextRn;
          const nextBuf = Buffer.alloc(8);
          nextBuf.writeBigUInt64LE(BigInt(nextRn));
          const [nextRoundPda] = PublicKey.findProgramAddressSync(
            [ROUND_SEED, Buffer.from(asset), nextBuf],
            PROGRAM_ID
          );

          console.log(`  Creating ${asset}#${nextRn}...`);
          const tx2 = await program.methods
            .createRound(
              asset,
              new BN(nextRn),
              new BN(ROUND_DURATION),
              new BN(LOCK_BUFFER),
              new PublicKey(PYTH_FEEDS[asset])
            )
            .accounts({
              round: nextRoundPda,
              config: configPda,
              authority: wallet.publicKey,
              systemProgram: SystemProgram.programId,
            })
            .signers([wallet])
            .rpc();
          console.log(`  Created! tx: ${tx2}`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Account not found is expected for new deployments
        if (!msg.includes("Account does not exist")) {
          console.error(`Error checking ${asset}#${rn}:`, msg);
        }
      }
    }
  }

  // Run immediately, then on interval
  await tick();
  setInterval(tick, CHECK_INTERVAL);
}

main().catch(console.error);
