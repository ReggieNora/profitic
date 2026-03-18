"use client";

import { useCallback, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { useProgram } from "./useProgram";
import { PROGRAM_ID } from "@/lib/constants";
import { solToLamports } from "@/lib/bondingCurve";

export interface TradeResult {
  success: boolean;
  txSignature?: string;
  error?: string;
}

/**
 * Hook that sends real on-chain buyTokens / sellTokens transactions
 * against the Profitic program on Solana devnet.
 *
 * Uses wallet.sendTransaction (signs + sends atomically) to avoid
 * repeated wallet popups that can occur with signTransaction + sendRawTransaction.
 */
export function useTrade() {
  const { program, provider } = useProgram();
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pendingRef = useRef(false);

  /**
   * Buy outcome tokens on an on-chain market.
   * @param marketPubkey - The public key string of the on-chain market account
   * @param outcome - "yes" or "no"
   * @param amountSol - Amount in SOL to spend (used as token amount parameter)
   * @param slippagePct - Slippage tolerance (default 5%)
   */
  const buyShares = useCallback(
    async (
      marketPubkey: string,
      outcome: "yes" | "no",
      amountSol: number,
      slippagePct = 5
    ): Promise<TradeResult> => {
      // Prevent double-submission
      if (pendingRef.current) {
        return { success: false, error: "Transaction already in progress" };
      }

      setError(null);
      setLastTx(null);

      if (!program || !provider || !publicKey || !connected) {
        const msg = "Wallet not connected";
        setError(msg);
        return { success: false, error: msg };
      }

      // Validate market public key
      let marketKey: PublicKey;
      try {
        marketKey = new PublicKey(marketPubkey);
      } catch {
        const msg =
          "Invalid market address. This is a demo market — create a real market on-chain to trade.";
        setError(msg);
        return { success: false, error: msg };
      }

      // Check if this is a demo/fake market key
      if (marketPubkey.startsWith("Demo")) {
        const msg =
          "This is a demo market. Create a real on-chain market to place bets with real SOL.";
        setError(msg);
        return { success: false, error: msg };
      }

      setLoading(true);
      pendingRef.current = true;
      try {
        const outcomeIndex: number = outcome === "yes" ? 0 : 1;
        const amountLamports = solToLamports(amountSol);
        // Allow slippage on max cost
        const maxCost = new anchor.BN(
          Math.ceil(amountLamports * (1 + slippagePct / 100))
        );

        // Fetch market to get mint addresses
        const marketAccount = await (program.account as any).market.fetch(marketKey);
        const market = marketAccount as any;
        const outcomeMint: PublicKey =
          outcomeIndex === 0 ? market.yesMint : market.noMint;

        // Derive PDAs
        const [platformPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("platform")],
          PROGRAM_ID
        );

        const [vault] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), marketKey.toBuffer()],
          PROGRAM_ID
        );

        const [userPosition] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("position"),
            marketKey.toBuffer(),
            publicKey.toBuffer(),
          ],
          PROGRAM_ID
        );

        // Get or create user's ATA for the outcome token
        const userTokenAccount = getAssociatedTokenAddressSync(
          outcomeMint,
          publicKey
        );

        // Check if ATA exists, create if needed
        const ataInfo = await connection.getAccountInfo(userTokenAccount);
        const preInstructions: TransactionInstruction[] = [];
        if (!ataInfo) {
          preInstructions.push(
            createAssociatedTokenAccountInstruction(
              publicKey,
              userTokenAccount,
              publicKey,
              outcomeMint
            )
          );
        }

        // Fetch treasury from platform
        const platformAccount = await (program.account as any).platform.fetch(
          platformPda
        );
        const treasury = (platformAccount as any).treasury as PublicKey;

        // Build the transaction instruction via Anchor, then send via
        // wallet adapter's sendTransaction to avoid double-signing popups.
        const ix = await program.methods
          .buyTokens(outcomeIndex, new anchor.BN(amountLamports), maxCost)
          .accounts({
            platform: platformPda,
            market: marketKey,
            outcomeMint,
            userTokenAccount,
            vault,
            treasury,
            userPosition,
            buyer: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        const tx = new Transaction();
        for (const pre of preInstructions) {
          tx.add(pre);
        }
        tx.add(ix);
        tx.feePayer = publicKey;
        tx.recentBlockhash = (
          await connection.getLatestBlockhash("confirmed")
        ).blockhash;

        // sendTransaction signs + sends in one step — single wallet popup
        const signature = await sendTransaction(tx, connection, {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        });

        // Wait for confirmation
        await connection.confirmTransaction(signature, "confirmed");

        setLastTx(signature);
        setLoading(false);
        pendingRef.current = false;
        return { success: true, txSignature: signature };
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Transaction failed";
        console.error("Buy tokens failed:", err);
        setError(msg);
        setLoading(false);
        pendingRef.current = false;
        return { success: false, error: msg };
      }
    },
    [program, provider, publicKey, connected, connection, sendTransaction]
  );

  /**
   * Sell outcome tokens on an on-chain market.
   */
  const sellShares = useCallback(
    async (
      marketPubkey: string,
      outcome: "yes" | "no",
      amountSol: number,
      slippagePct = 5
    ): Promise<TradeResult> => {
      if (pendingRef.current) {
        return { success: false, error: "Transaction already in progress" };
      }

      setError(null);
      setLastTx(null);

      if (!program || !provider || !publicKey || !connected) {
        const msg = "Wallet not connected";
        setError(msg);
        return { success: false, error: msg };
      }

      let marketKey: PublicKey;
      try {
        marketKey = new PublicKey(marketPubkey);
      } catch {
        const msg = "Invalid market address.";
        setError(msg);
        return { success: false, error: msg };
      }

      if (marketPubkey.startsWith("Demo")) {
        const msg =
          "This is a demo market. Create a real on-chain market to trade.";
        setError(msg);
        return { success: false, error: msg };
      }

      setLoading(true);
      pendingRef.current = true;
      try {
        const outcomeIndex: number = outcome === "yes" ? 0 : 1;
        const amountLamports = solToLamports(amountSol);
        const minReturn = new anchor.BN(
          Math.floor(amountLamports * (1 - slippagePct / 100))
        );

        // Fetch market to get mint addresses
        const marketAccount = await (program.account as any).market.fetch(marketKey);
        const market = marketAccount as any;
        const outcomeMint: PublicKey =
          outcomeIndex === 0 ? market.yesMint : market.noMint;

        // Derive PDAs
        const [platformPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("platform")],
          PROGRAM_ID
        );

        const [vault] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), marketKey.toBuffer()],
          PROGRAM_ID
        );

        // Get user's ATA for the outcome token
        const userTokenAccount = getAssociatedTokenAddressSync(
          outcomeMint,
          publicKey
        );

        // Fetch treasury from platform
        const platformAccount = await (program.account as any).platform.fetch(
          platformPda
        );
        const treasury = (platformAccount as any).treasury as PublicKey;

        const ix = await program.methods
          .sellTokens(outcomeIndex, new anchor.BN(amountLamports), minReturn)
          .accounts({
            platform: platformPda,
            market: marketKey,
            outcomeMint,
            userTokenAccount,
            vault,
            treasury,
            seller: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();

        const tx = new Transaction();
        tx.add(ix);
        tx.feePayer = publicKey;
        tx.recentBlockhash = (
          await connection.getLatestBlockhash("confirmed")
        ).blockhash;

        const signature = await sendTransaction(tx, connection, {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        });

        await connection.confirmTransaction(signature, "confirmed");

        setLastTx(signature);
        setLoading(false);
        pendingRef.current = false;
        return { success: true, txSignature: signature };
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Transaction failed";
        console.error("Sell tokens failed:", err);
        setError(msg);
        setLoading(false);
        pendingRef.current = false;
        return { success: false, error: msg };
      }
    },
    [program, provider, publicKey, connected, connection, sendTransaction]
  );

  const clearError = useCallback(() => setError(null), []);

  return { buyShares, sellShares, loading, lastTx, error, clearError };
}
