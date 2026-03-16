"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
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
 */
export function useTrade() {
  const { program, provider } = useProgram();
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      setError(null);
      setLastTx(null);

      if (!program || !provider || !publicKey) {
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
        const preInstructions: anchor.web3.TransactionInstruction[] = [];
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

        const tx = await program.methods
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
          .preInstructions(preInstructions)
          .rpc();

        setLastTx(tx);
        setLoading(false);
        return { success: true, txSignature: tx };
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Transaction failed";
        console.error("Buy tokens failed:", err);
        setError(msg);
        setLoading(false);
        return { success: false, error: msg };
      }
    },
    [program, provider, publicKey, connection]
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
      setError(null);
      setLastTx(null);

      if (!program || !provider || !publicKey) {
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

        const tx = await program.methods
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
          .rpc();

        setLastTx(tx);
        setLoading(false);
        return { success: true, txSignature: tx };
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Transaction failed";
        console.error("Sell tokens failed:", err);
        setError(msg);
        setLoading(false);
        return { success: false, error: msg };
      }
    },
    [program, provider, publicKey, connection]
  );

  const clearError = useCallback(() => setError(null), []);

  return { buyShares, sellShares, loading, lastTx, error, clearError };
}
