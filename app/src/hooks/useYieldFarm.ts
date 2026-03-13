"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import {
  useYieldFarmProgram,
  deriveFarmConfigPda,
  deriveStakeVaultPda,
  deriveUserStakePda,
} from "./useYieldFarmProgram";

// ── On-chain account shapes ──

export interface OnChainFarmConfig {
  authority: string;
  rewardAuthority: string;
  totalStaked: number;   // lamports
  totalStakers: number;
  totalRewardsDistributed: number;
  paused: boolean;
}

export interface OnChainUserStake {
  user: string;
  stakedAmount: number;  // lamports
  lastStakeTs: number;   // unix seconds
  lastClaimTs: number;   // unix seconds
  pendingRewards: number; // lamports (snapshot — does NOT include newly accrued)
  totalClaimed: number;  // lamports
  streakStartTs: number; // unix seconds
}

// ── Tier logic (mirrors on-chain constants) ──

const TIER_GOLD_MIN = 50_000;
const TIER_SILVER_MIN = 10_000;
const TIERS = [
  { label: "Gold",   minStake: TIER_GOLD_MIN,   weeklyBps: 25 },
  { label: "Silver", minStake: TIER_SILVER_MIN,  weeklyBps: 35 },
  { label: "Bronze", minStake: 1,                weeklyBps: 50 },
];
const STREAK_BONUS_BPS = 5;
const SECONDS_PER_WEEK = 604_800;
const SECONDS_PER_DAY = 86_400;

export function getTierForAmount(lamports: number) {
  for (const t of TIERS) {
    if (lamports >= t.minStake) return t;
  }
  return TIERS[TIERS.length - 1];
}

/** Estimate pending rewards client-side (between on-chain snapshots). */
export function estimatePendingRewards(stake: OnChainUserStake): number {
  if (stake.stakedAmount <= 0) return stake.pendingRewards;
  const now = Math.floor(Date.now() / 1000);
  const elapsed = Math.max(0, now - stake.lastClaimTs);
  const tier = getTierForAmount(stake.stakedAmount);
  const streakMult = stake.streakStartTs > 0
    ? Math.floor((now - stake.streakStartTs) / SECONDS_PER_DAY / 7)
    : 0;
  const totalBps = tier.weeklyBps + STREAK_BONUS_BPS * streakMult;
  const accrued = (stake.stakedAmount * totalBps * elapsed) / (10_000 * SECONDS_PER_WEEK);
  return stake.pendingRewards + accrued;
}

// ── Main hook ──

export function useYieldFarm() {
  const { program } = useYieldFarmProgram();
  const wallet = useWallet();

  const [farmConfig, setFarmConfig] = useState<OnChainFarmConfig | null>(null);
  const [userStake, setUserStake] = useState<OnChainUserStake | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch farm config ──
  const fetchFarmConfig = useCallback(async () => {
    if (!program) return;
    try {
      const [configPda] = deriveFarmConfigPda();
      const raw = await (program.account as any)["farmConfig"].fetch(configPda);
      setFarmConfig({
        authority: raw.authority.toBase58(),
        rewardAuthority: raw.rewardAuthority.toBase58(),
        totalStaked: (raw.totalStaked as BN).toNumber(),
        totalStakers: (raw.totalStakers as BN).toNumber(),
        totalRewardsDistributed: (raw.totalRewardsDistributed as BN).toNumber(),
        paused: raw.paused,
      });
    } catch {
      // Config not initialized yet — expected before first deploy
      setFarmConfig(null);
    }
  }, [program]);

  // ── Fetch user stake ──
  const fetchUserStake = useCallback(async () => {
    if (!program || !wallet.publicKey) return;
    try {
      const [userPda] = deriveUserStakePda(wallet.publicKey);
      const raw = await (program.account as any)["userStake"].fetch(userPda);
      setUserStake({
        user: raw.user.toBase58(),
        stakedAmount: (raw.stakedAmount as BN).toNumber(),
        lastStakeTs: (raw.lastStakeTs as BN).toNumber(),
        lastClaimTs: (raw.lastClaimTs as BN).toNumber(),
        pendingRewards: (raw.pendingRewards as BN).toNumber(),
        totalClaimed: (raw.totalClaimed as BN).toNumber(),
        streakStartTs: (raw.streakStartTs as BN).toNumber(),
      });
    } catch {
      // User hasn't staked yet
      setUserStake(null);
    }
  }, [program, wallet.publicKey]);

  // Auto-fetch on wallet/program change
  useEffect(() => {
    fetchFarmConfig();
    fetchUserStake();
  }, [fetchFarmConfig, fetchUserStake]);

  // ── Stake ──
  const stake = useCallback(async (lamports: number) => {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
    setLoading(true);
    setError(null);
    try {
      const [configPda] = deriveFarmConfigPda();
      const [vaultPda] = deriveStakeVaultPda();
      const [userPda] = deriveUserStakePda(wallet.publicKey);

      const tx = await program.methods
        .stake(new BN(lamports))
        .accounts({
          farmConfig: configPda,
          userStake: userPda,
          stakeVault: vaultPda,
          user: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await fetchFarmConfig();
      await fetchUserStake();
      return tx;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Stake failed";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [program, wallet.publicKey, fetchFarmConfig, fetchUserStake]);

  // ── Unstake ──
  const unstake = useCallback(async (lamports: number) => {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
    setLoading(true);
    setError(null);
    try {
      const [configPda] = deriveFarmConfigPda();
      const [vaultPda] = deriveStakeVaultPda();
      const [userPda] = deriveUserStakePda(wallet.publicKey);

      const tx = await program.methods
        .unstake(new BN(lamports))
        .accounts({
          farmConfig: configPda,
          userStake: userPda,
          stakeVault: vaultPda,
          user: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await fetchFarmConfig();
      await fetchUserStake();
      return tx;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unstake failed";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [program, wallet.publicKey, fetchFarmConfig, fetchUserStake]);

  // ── Claim rewards ──
  const claimRewards = useCallback(async () => {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
    setLoading(true);
    setError(null);
    try {
      const [configPda] = deriveFarmConfigPda();
      const [vaultPda] = deriveStakeVaultPda();
      const [userPda] = deriveUserStakePda(wallet.publicKey);

      const tx = await program.methods
        .claimRewards()
        .accounts({
          farmConfig: configPda,
          userStake: userPda,
          stakeVault: vaultPda,
          user: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      await fetchFarmConfig();
      await fetchUserStake();
      return tx;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [program, wallet.publicKey, fetchFarmConfig, fetchUserStake]);

  return {
    farmConfig,
    userStake,
    loading,
    error,
    stake,
    unstake,
    claimRewards,
    refresh: async () => { await fetchFarmConfig(); await fetchUserStake(); },
  };
}
