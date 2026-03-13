"use client";

import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { BINARY_MARKET_PROGRAM_ID } from "@/lib/constants";
import { BINARY_MARKET_IDL, BinaryMarketProgram } from "@/lib/binaryMarketIdl";

// PDA seeds matching the on-chain program
const CONFIG_SEED = Buffer.from("binary_config");
const ROUND_SEED = Buffer.from("binary_round");
const BET_SEED = Buffer.from("binary_bet");

export function useBinaryProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const provider = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
      return null;
    }
    return new AnchorProvider(
      connection,
      {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      },
      { commitment: "confirmed" }
    );
  }, [connection, wallet.publicKey, wallet.signTransaction, wallet.signAllTransactions]);

  const program = useMemo(() => {
    if (!provider) return null;
    return new Program(
      BINARY_MARKET_IDL as unknown as Idl,
      BINARY_MARKET_PROGRAM_ID,
      provider
    ) as unknown as Program<BinaryMarketProgram>;
  }, [provider]);

  return { program, provider, connected: wallet.connected };
}

// ── PDA derivation helpers ──

export function deriveConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [CONFIG_SEED],
    BINARY_MARKET_PROGRAM_ID
  );
}

export function deriveRoundPda(
  asset: string,
  roundNumber: number | bigint
): [PublicKey, number] {
  const roundBuf = Buffer.alloc(8);
  roundBuf.writeBigUInt64LE(BigInt(roundNumber));
  return PublicKey.findProgramAddressSync(
    [ROUND_SEED, Buffer.from(asset), roundBuf],
    BINARY_MARKET_PROGRAM_ID
  );
}

export function deriveBetPda(
  roundPda: PublicKey,
  userPubkey: PublicKey,
  totalBets: number
): [PublicKey, number] {
  const betsBuf = Buffer.alloc(4);
  betsBuf.writeUInt32LE(totalBets);
  return PublicKey.findProgramAddressSync(
    [BET_SEED, roundPda.toBuffer(), userPubkey.toBuffer(), betsBuf],
    BINARY_MARKET_PROGRAM_ID
  );
}
