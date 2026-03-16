"use client";

import { useCallback, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { useProgram } from "./useProgram";
import { PROGRAM_ID } from "@/lib/constants";

export interface CreateMarketResult {
  success: boolean;
  marketPubkey?: string;
  txSignature?: string;
  error?: string;
}

/**
 * Hook that sends a real on-chain createMarket transaction
 * against the Profitic program on Solana devnet.
 */
export function useCreateMarket() {
  const { program, provider } = useProgram();
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createMarket = useCallback(
    async (
      question: string,
      description: string,
      resolutionTimestamp: number,
      dataSource: string
    ): Promise<CreateMarketResult> => {
      setError(null);

      if (!program || !provider || !publicKey) {
        const msg = "Wallet not connected";
        setError(msg);
        return { success: false, error: msg };
      }

      setLoading(true);
      try {
        // Fetch platform to get market_count for PDA derivation
        const [platformPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("platform")],
          PROGRAM_ID
        );

        const platformAccount = await (program.account as any).platform.fetch(
          platformPda
        );
        const marketCount = (platformAccount as any).marketCount as anchor.BN;

        // Derive market PDA
        const [marketPda] = PublicKey.findProgramAddressSync(
          [Buffer.from("market"), marketCount.toArrayLike(Buffer, "le", 8)],
          PROGRAM_ID
        );

        // Derive YES/NO mint PDAs
        const [yesMint] = PublicKey.findProgramAddressSync(
          [Buffer.from("yes_mint"), marketPda.toBuffer()],
          PROGRAM_ID
        );
        const [noMint] = PublicKey.findProgramAddressSync(
          [Buffer.from("no_mint"), marketPda.toBuffer()],
          PROGRAM_ID
        );

        // Derive vault PDA
        const [vault] = PublicKey.findProgramAddressSync(
          [Buffer.from("vault"), marketPda.toBuffer()],
          PROGRAM_ID
        );

        // Get treasury from platform
        const treasury = (platformAccount as any).treasury as PublicKey;

        const tx = await program.methods
          .createMarket(
            question,
            description,
            new anchor.BN(resolutionTimestamp),
            dataSource
          )
          .accounts({
            platform: platformPda,
            market: marketPda,
            yesMint,
            noMint,
            vault,
            treasury,
            creator: publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .rpc();

        setLoading(false);
        return {
          success: true,
          marketPubkey: marketPda.toBase58(),
          txSignature: tx,
        };
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Transaction failed";
        console.error("Create market failed:", err);
        setError(msg);
        setLoading(false);
        return { success: false, error: msg };
      }
    },
    [program, provider, publicKey]
  );

  const clearError = useCallback(() => setError(null), []);

  return { createMarket, loading, error, clearError };
}
