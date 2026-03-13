"use client";

import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Program, AnchorProvider, Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { YIELD_FARM_PROGRAM_ID } from "@/lib/constants";
import { YIELD_FARM_IDL, YieldFarmProgram } from "@/lib/yieldFarmIdl";

// PDA seeds matching the on-chain program
const FARM_CONFIG_SEED = Buffer.from("farm_config");
const STAKE_VAULT_SEED = Buffer.from("stake_vault");
const USER_STAKE_SEED = Buffer.from("user_stake");

export function useYieldFarmProgram() {
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
      YIELD_FARM_IDL as unknown as Idl,
      YIELD_FARM_PROGRAM_ID,
      provider
    ) as unknown as Program<YieldFarmProgram>;
  }, [provider]);

  return { program, provider, connected: wallet.connected };
}

// ── PDA Derivation Helpers ──

export function deriveFarmConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [FARM_CONFIG_SEED],
    YIELD_FARM_PROGRAM_ID
  );
}

export function deriveStakeVaultPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [STAKE_VAULT_SEED],
    YIELD_FARM_PROGRAM_ID
  );
}

export function deriveUserStakePda(userPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [USER_STAKE_SEED, userPubkey.toBuffer()],
    YIELD_FARM_PROGRAM_ID
  );
}
