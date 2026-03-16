"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { useProgram } from "./useProgram";
import { solToLamports } from "@/lib/bondingCurve";

export interface TradeResult {
  success: boolean;
  txSignature?: string;
  error?: string;
}

/**
 * Hook that sends real on-chain buyShares / sellShares transactions
 * against the Profitic program on Solana devnet.
 */
export function useTrade() {
  const { program, provider } = useProgram();
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [loading, setLoading] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Buy shares on an on-chain market.
   * @param marketPubkey - The public key string of the on-chain market account
   * @param outcome - "yes" or "no"
   * @param amountSol - Amount in SOL to spend
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
        const msg = "Invalid market address. This is a demo market — create a real market on-chain to trade.";
        setError(msg);
        return { success: false, error: msg };
      }

      // Check if this is a demo/fake market key
      if (marketPubkey.startsWith("Demo")) {
        const msg = "This is a demo market. Create a real on-chain market to place bets with real SOL.";
        setError(msg);
        return { success: false, error: msg };
      }

      setLoading(true);
      try {
        const amountLamports = solToLamports(amountSol);
        // Allow slippage on max cost
        const maxCost = new anchor.BN(
          Math.ceil(amountLamports * (1 + slippagePct / 100))
        );

        const outcomeEnum = outcome === "yes" ? { yes: {} } : { no: {} };

        // Derive PDAs
        const [marketVault] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), marketKey.toBuffer()],
          program.programId
        );

        const [userPosition] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("position"),
            marketKey.toBuffer(),
            publicKey.toBuffer(),
          ],
          program.programId
        );

        const tx = await program.methods
          .buyShares(outcomeEnum, new anchor.BN(amountLamports), maxCost)
          .accounts({
            market: marketKey,
            buyer: publicKey,
            marketVault,
            userPosition,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        setLastTx(tx);
        setLoading(false);
        return { success: true, txSignature: tx };
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Transaction failed";
        console.error("Buy shares failed:", err);
        setError(msg);
        setLoading(false);
        return { success: false, error: msg };
      }
    },
    [program, provider, publicKey]
  );

  /**
   * Sell shares on an on-chain market.
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
        const msg = "This is a demo market. Create a real on-chain market to trade.";
        setError(msg);
        return { success: false, error: msg };
      }

      setLoading(true);
      try {
        const amountLamports = solToLamports(amountSol);
        const minReturn = new anchor.BN(
          Math.floor(amountLamports * (1 - slippagePct / 100))
        );

        const outcomeEnum = outcome === "yes" ? { yes: {} } : { no: {} };

        const [marketVault] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), marketKey.toBuffer()],
          program.programId
        );

        const [userPosition] = PublicKey.findProgramAddressSync(
          [
            Buffer.from("position"),
            marketKey.toBuffer(),
            publicKey.toBuffer(),
          ],
          program.programId
        );

        const tx = await program.methods
          .sellShares(outcomeEnum, new anchor.BN(amountLamports), minReturn)
          .accounts({
            market: marketKey,
            seller: publicKey,
            marketVault,
            userPosition,
            systemProgram: SystemProgram.programId,
          })
          .rpc();

        setLastTx(tx);
        setLoading(false);
        return { success: true, txSignature: tx };
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Transaction failed";
        console.error("Sell shares failed:", err);
        setError(msg);
        setLoading(false);
        return { success: false, error: msg };
      }
    },
    [program, provider, publicKey]
  );

  const clearError = useCallback(() => setError(null), []);

  return { buyShares, sellShares, loading, lastTx, error, clearError };
}
