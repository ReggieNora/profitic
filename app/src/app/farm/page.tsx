"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  REWARD_TIERS,
  getPoolStats,
  getFarmLeaderboard,
  getRewardGrowthData,
  getRewardHistory,
  getApyDisplay,
  formatProfit,
  generateStakeEvent,
  type PoolStats,
  type FarmLeaderboardEntry,
  type RewardGrowthPoint,
  type RewardHistoryEntry,
  type StakeEvent,
} from "@/lib/yieldFarmData";
import { useYieldFarm, getTierForAmount, estimatePendingRewards } from "@/hooks/useYieldFarm";
import { LAMPORTS_PER_SOL } from "@/lib/constants";

// ── Tab type ──
type FarmTab = "stake" | "rewards" | "pool" | "leaderboard";

const TABS: { value: FarmTab; label: string; icon: string }[] = [
  { value: "stake", label: "Stake", icon: "\u26A1" },
  { value: "rewards", label: "Rewards", icon: "\uD83D\uDCB0" },
  { value: "pool", label: "Pool", icon: "\uD83C\uDF0A" },
  { value: "leaderboard", label: "Top LPs", icon: "\uD83C\uDFC6" },
];

export default function YieldFarmPage() {
  const { publicKey } = useWallet();
  const [activeTab, setActiveTab] = useState<FarmTab>("stake");

  // ── On-chain farm hook ──
  const {
    farmConfig,
    userStake: onChainStake,
    loading: txLoading,
    error: txError,
    stake: onChainStakeFn,
    unstake: onChainUnstakeFn,
    claimRewards: onChainClaimFn,
  } = useYieldFarm();

  // Derive user-facing values from on-chain state
  const userStake = onChainStake?.stakedAmount ?? 0;
  const totalClaimed = onChainStake?.totalClaimed ?? 0;
  const streakDays = onChainStake && onChainStake.streakStartTs > 0
    ? Math.floor((Date.now() / 1000 - onChainStake.streakStartTs) / 86400)
    : 0;

  const [stakeInput, setStakeInput] = useState("");

  // ── Pool & data (still demo until indexer is built) ──
  const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<FarmLeaderboardEntry[]>([]);
  const [growthData, setGrowthData] = useState<RewardGrowthPoint[]>([]);
  const [rewardHistory, setRewardHistory] = useState<RewardHistoryEntry[]>([]);
  const [liveEvents, setLiveEvents] = useState<StakeEvent[]>([]);

  // ── Animation states ──
  const [stakeSuccess, setStakeSuccess] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [rewardTick, setRewardTick] = useState(0);
  const rewardRef = useRef<HTMLSpanElement>(null);

  // ── Live-estimated pending rewards (ticks every second) ──
  const [pendingRewards, setPendingRewards] = useState(0);

  useEffect(() => {
    if (!onChainStake || onChainStake.stakedAmount <= 0) {
      setPendingRewards(0);
      return;
    }
    const tick = () => {
      const est = estimatePendingRewards(onChainStake);
      setPendingRewards(Math.floor(est * 10000) / 10000);
      setRewardTick((t) => t + 1);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [onChainStake]);

  // Override pool stats with on-chain config when available
  useEffect(() => {
    if (farmConfig) {
      setPoolStats((prev) => {
        const base = prev ?? getPoolStats();
        return {
          ...base,
          totalStaked: farmConfig.totalStaked,
          totalStakers: farmConfig.totalStakers,
          totalRewardsDistributed: farmConfig.totalRewardsDistributed,
        };
      });
    } else {
      setPoolStats(getPoolStats());
    }
    setLeaderboard(getFarmLeaderboard());
    setGrowthData(getRewardGrowthData(30));
    setRewardHistory(getRewardHistory(publicKey?.toBase58()));
  }, [publicKey, farmConfig]);

  // Live activity events
  useEffect(() => {
    const spawn = () => {
      const ev = generateStakeEvent();
      setLiveEvents((prev) => [ev, ...prev].slice(0, 8));
    };
    spawn();
    const interval = setInterval(spawn, 4000 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, []);

  // ── Handlers (call on-chain, fall back to simulation) ──
  const handleStake = useCallback(async () => {
    const amount = parseFloat(stakeInput);
    if (!amount || amount <= 0) return;
    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
    try {
      await onChainStakeFn(lamports);
      setStakeInput("");
      setStakeSuccess(true);
      setTimeout(() => setStakeSuccess(false), 2000);
    } catch (err) {
      console.error("Stake failed:", err);
    }
  }, [stakeInput, onChainStakeFn]);

  const handleUnstake = useCallback(async () => {
    if (userStake <= 0) return;
    const inputAmt = parseFloat(stakeInput);
    const solAmount = inputAmt > 0 ? inputAmt : userStake / LAMPORTS_PER_SOL;
    const lamports = Math.floor(solAmount * LAMPORTS_PER_SOL);
    const actual = Math.min(lamports, userStake);
    try {
      await onChainUnstakeFn(actual);
      setStakeInput("");
    } catch (err) {
      console.error("Unstake failed:", err);
    }
  }, [stakeInput, userStake, onChainUnstakeFn]);

  const handleClaim = useCallback(async () => {
    if (pendingRewards <= 0) return;
    try {
      await onChainClaimFn();
      setClaimSuccess(true);
      setTimeout(() => setClaimSuccess(false), 2000);
    } catch (err) {
      console.error("Claim failed:", err);
    }
  }, [pendingRewards, onChainClaimFn]);

  const tier = getTierForAmount(userStake);
  const userTier = { label: tier.label, weeklyApy: tier.weeklyBps / 100 };
  const apyDisplay = getApyDisplay(userTier.weeklyApy);

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] w-full bg-transparent pb-24">
      {/* Animated background glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-80 w-[600px] -translate-x-1/2 rounded-full bg-primary-500/10 blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 -right-20 h-60 w-60 rounded-full bg-emerald-500/8 blur-[100px]" />
      </div>

      {/* Header */}
      <div className="relative px-4 pt-6 pb-2 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-primary-500 text-lg">
            {"\uD83C\uDF3E"}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white sm:text-3xl">
              Yield Farm
            </h1>
            <p className="text-sm text-white/40">
              Stake $PROFIT to earn rewards & power markets
            </p>
          </div>
        </div>
      </div>

      {/* Transaction status */}
      {(txLoading || txError) && (
        <div className={`relative mx-4 mt-2 rounded-xl border px-3 py-2 text-xs sm:mx-6 ${
          txError
            ? "border-red-500/30 bg-red-500/10 text-red-400"
            : "border-primary-500/30 bg-primary-500/10 text-primary-300"
        }`}>
          {txLoading ? "Sending transaction..." : txError}
        </div>
      )}

      {/* Live activity ticker */}
      <div className="relative mx-4 mt-3 overflow-hidden rounded-xl border border-white/5 bg-surface-300/60 sm:mx-6">
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <div className="flex-1 overflow-hidden">
            {liveEvents.length > 0 && (
              <p className="truncate text-xs text-white/60 animate-slide-in">
                <span className="font-mono text-white/80">{liveEvents[0].wallet}</span>
                {" "}
                <span className={
                  liveEvents[0].type === "stake" ? "text-emerald-400"
                  : liveEvents[0].type === "claim" ? "text-yellow-400"
                  : "text-red-400"
                }>
                  {liveEvents[0].type === "stake" ? "staked" : liveEvents[0].type === "claim" ? "claimed" : "unstaked"}
                </span>
                {" "}
                <span className="font-bold text-white/90">
                  {formatProfit(liveEvents[0].amount)} $PROFIT
                </span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="feed-scroll flex gap-2 overflow-x-auto px-4 py-4 sm:px-6">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95 ${
              activeTab === tab.value
                ? "bg-white text-black shadow-lg"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        {activeTab === "stake" && (
          <StakeSection
            userStake={userStake / LAMPORTS_PER_SOL}
            pendingRewards={pendingRewards / LAMPORTS_PER_SOL}
            totalClaimed={totalClaimed / LAMPORTS_PER_SOL}
            streakDays={streakDays}
            stakeInput={stakeInput}
            setStakeInput={setStakeInput}
            onStake={handleStake}
            onUnstake={handleUnstake}
            onClaim={handleClaim}
            stakeSuccess={stakeSuccess}
            claimSuccess={claimSuccess}
            tier={userTier}
            apyDisplay={apyDisplay}
            rewardTick={rewardTick}
            rewardRef={rewardRef}
            connected={!!publicKey}
          />
        )}

        {activeTab === "rewards" && (
          <RewardsSection
            rewardHistory={rewardHistory}
            pendingRewards={pendingRewards / LAMPORTS_PER_SOL}
            totalClaimed={totalClaimed / LAMPORTS_PER_SOL}
            onClaim={handleClaim}
            claimSuccess={claimSuccess}
          />
        )}

        {activeTab === "pool" && (
          <PoolSection
            poolStats={poolStats}
            growthData={growthData}
          />
        )}

        {activeTab === "leaderboard" && (
          <LeaderboardSection leaderboard={leaderboard} />
        )}
      </div>

      {/* Info box */}
      <div className="mx-auto mt-6 max-w-2xl px-4 sm:px-6">
        <div className="rounded-2xl border border-primary-500/20 bg-primary-500/5 p-4">
          <p className="text-xs leading-relaxed text-white/50">
            <span className="font-bold text-primary-300">How it works:</span>{" "}
            Providing $PROFIT liquidity keeps binary markets active and earns you rewards.
            Your staked tokens back market liquidity — when one side of a binary market is underfunded,
            the LP pool fills in. When markets resolve, payouts draw from the pool proportionally.
            Higher stakes earn lower APY rates to keep distribution fair, and streak bonuses
            reward long-term commitment.
          </p>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// STAKE SECTION
// ═══════════════════════════════════════════

function StakeSection({
  userStake, pendingRewards, totalClaimed, streakDays,
  stakeInput, setStakeInput,
  onStake, onUnstake, onClaim,
  stakeSuccess, claimSuccess,
  tier, apyDisplay, rewardTick, rewardRef, connected,
}: {
  userStake: number;
  pendingRewards: number;
  totalClaimed: number;
  streakDays: number;
  stakeInput: string;
  setStakeInput: (v: string) => void;
  onStake: () => void;
  onUnstake: () => void;
  onClaim: () => void;
  stakeSuccess: boolean;
  claimSuccess: boolean;
  tier: { label: string; weeklyApy: number };
  apyDisplay: { daily: string; weekly: string; annual: string };
  rewardTick: number;
  rewardRef: React.RefObject<HTMLSpanElement>;
  connected: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* APY Tiers */}
      <div className="rounded-2xl border border-white/5 bg-surface-300/60 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Reward Tiers
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {REWARD_TIERS.map((t) => {
            const apy = getApyDisplay(t.weeklyApy);
            const isActive = tier.label === t.label && userStake > 0;
            return (
              <div
                key={t.label}
                className={`rounded-xl border p-3 text-center transition-all ${
                  isActive
                    ? "border-emerald-500/40 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                    : "border-white/5 bg-white/5"
                }`}
              >
                <p className="text-[10px] font-medium uppercase tracking-wider text-white/40">
                  {t.label}
                </p>
                <p className={`mt-1 text-lg font-black ${isActive ? "text-emerald-400" : "text-white/80"}`}>
                  {apy.annual}
                </p>
                <p className="text-[10px] text-white/30">
                  {t.maxStake ? `${formatProfit(t.minStake)}–${formatProfit(t.maxStake)}` : `${formatProfit(t.minStake)}+`}
                </p>
                <p className="text-[10px] text-white/30">{apy.weekly}/wk</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stake Input */}
      <div className="rounded-2xl border border-white/5 bg-surface-300/60 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Stake $PROFIT
        </h3>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              value={stakeInput}
              onChange={(e) => setStakeInput(e.target.value)}
              placeholder="Amount..."
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white placeholder-white/20 outline-none transition-all focus:border-primary-400/50 focus:ring-1 focus:ring-primary-400/30"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-white/30">$PROFIT</span>
          </div>
        </div>

        {/* Quick amount buttons */}
        <div className="mt-2 flex gap-2">
          {[1000, 5000, 10000, 50000].map((amt) => (
            <button
              key={amt}
              onClick={() => setStakeInput(amt.toString())}
              className="flex-1 rounded-lg bg-white/5 py-1.5 text-[10px] font-semibold text-white/50 transition-all hover:bg-white/10 hover:text-white/80 active:scale-95"
            >
              {formatProfit(amt)}
            </button>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            onClick={onStake}
            disabled={!stakeInput || parseFloat(stakeInput) <= 0}
            className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all active:scale-95 ${
              stakeSuccess
                ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
                : "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 disabled:opacity-30 disabled:shadow-none"
            }`}
          >
            {stakeSuccess ? "\u2713 Staked!" : "Stake $PROFIT"}
          </button>
          {userStake > 0 && (
            <button
              onClick={onUnstake}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/60 transition-all hover:bg-white/10 hover:text-white active:scale-95"
            >
              Unstake
            </button>
          )}
        </div>

        {!connected && (
          <p className="mt-2 text-center text-xs text-white/30">
            Connect wallet to start staking
          </p>
        )}
      </div>

      {/* Current Position */}
      {userStake > 0 && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-emerald-400/60">
            Your Position
          </h3>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-[10px] text-white/40">Staked</p>
              <p className="text-lg font-black text-white">
                {formatProfit(userStake)}
              </p>
              <p className="text-[10px] text-white/30">$PROFIT</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-[10px] text-white/40">APY</p>
              <p className="text-lg font-black text-emerald-400">
                {apyDisplay.annual}
              </p>
              <p className="text-[10px] text-white/30">{tier.label} tier</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-[10px] text-white/40">Pending</p>
              <p className="text-lg font-black text-yellow-400">
                <span key={rewardTick} className="animate-reward-tick">
                  {pendingRewards.toFixed(4)}
                </span>
              </p>
              <p className="text-[10px] text-white/30">$PROFIT</p>
            </div>
            <div className="rounded-xl bg-white/5 p-3">
              <p className="text-[10px] text-white/40">Streak</p>
              <p className="text-lg font-black text-orange-400">
                {streakDays}d {streakDays >= 7 && "\uD83D\uDD25"}
              </p>
              <p className="text-[10px] text-white/30">consecutive</p>
            </div>
          </div>

          <button
            onClick={onClaim}
            disabled={pendingRewards <= 0}
            className={`mt-3 w-full rounded-xl py-3 text-sm font-bold transition-all active:scale-95 ${
              claimSuccess
                ? "bg-yellow-500 text-black shadow-lg shadow-yellow-500/30"
                : "bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/30 disabled:opacity-30 disabled:shadow-none"
            }`}
          >
            {claimSuccess ? "\u2713 Claimed!" : `Claim ${pendingRewards.toFixed(4)} $PROFIT`}
          </button>
        </div>
      )}

      {/* Total claimed */}
      {totalClaimed > 0 && (
        <div className="rounded-xl border border-white/5 bg-surface-300/40 px-4 py-3 text-center">
          <p className="text-xs text-white/40">Total Claimed</p>
          <p className="text-xl font-black text-emerald-400">{formatProfit(totalClaimed)} $PROFIT</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// REWARDS SECTION
// ═══════════════════════════════════════════

function RewardsSection({
  rewardHistory, pendingRewards, totalClaimed, onClaim, claimSuccess,
}: {
  rewardHistory: RewardHistoryEntry[];
  pendingRewards: number;
  totalClaimed: number;
  onClaim: () => void;
  claimSuccess: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/5 bg-surface-300/60 p-4 text-center">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Pending</p>
          <p className="mt-1 text-xl font-black text-yellow-400">{pendingRewards.toFixed(4)}</p>
          <p className="text-[10px] text-white/30">$PROFIT</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-surface-300/60 p-4 text-center">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Total Claimed</p>
          <p className="mt-1 text-xl font-black text-emerald-400">{formatProfit(totalClaimed)}</p>
          <p className="text-[10px] text-white/30">$PROFIT</p>
        </div>
      </div>

      {/* Claim button */}
      {pendingRewards > 0 && (
        <button
          onClick={onClaim}
          className={`w-full rounded-xl py-3 text-sm font-bold transition-all active:scale-95 ${
            claimSuccess
              ? "bg-yellow-500 text-black"
              : "bg-gradient-to-r from-yellow-500 to-amber-500 text-black shadow-lg shadow-yellow-500/20"
          }`}
        >
          {claimSuccess ? "\u2713 Claimed!" : `Claim ${pendingRewards.toFixed(4)} $PROFIT`}
        </button>
      )}

      {/* Reward history */}
      <div className="rounded-2xl border border-white/5 bg-surface-300/60 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Reward History
        </h3>
        <div className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
          {rewardHistory.slice(0, 30).map((entry, i) => {
            const date = new Date(entry.timestamp);
            const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
            const typeColors: Record<string, string> = {
              daily: "text-emerald-400",
              bonus_streak: "text-orange-400",
              bonus_top_lp: "text-yellow-400",
              bonus_event: "text-purple-400",
            };
            const typeBgs: Record<string, string> = {
              daily: "bg-emerald-500/10",
              bonus_streak: "bg-orange-500/10",
              bonus_top_lp: "bg-yellow-500/10",
              bonus_event: "bg-purple-500/10",
            };

            return (
              <div
                key={`${entry.timestamp}-${i}`}
                className="flex items-center justify-between rounded-xl bg-white/[0.03] px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${typeBgs[entry.type]} ${typeColors[entry.type]}`}>
                    {entry.type === "daily" ? "DAILY" : "BONUS"}
                  </span>
                  <span className="text-xs text-white/60">{entry.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold ${typeColors[entry.type]}`}>
                    +{entry.amount.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-white/30">{dateStr}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// POOL SECTION
// ═══════════════════════════════════════════

function PoolSection({
  poolStats, growthData,
}: {
  poolStats: PoolStats | null;
  growthData: RewardGrowthPoint[];
}) {
  if (!poolStats) return null;

  const utilizationPct = Math.round(poolStats.poolUtilization * 100);

  return (
    <div className="flex flex-col gap-4">
      {/* Pool stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Total Staked" value={formatProfit(poolStats.totalStaked)} unit="$PROFIT" color="text-white" />
        <StatCard label="Total Stakers" value={poolStats.totalStakers.toLocaleString()} color="text-primary-300" />
        <StatCard label="Available Liquidity" value={formatProfit(poolStats.liquidityAvailable)} unit="$PROFIT" color="text-emerald-400" />
        <StatCard label="Deployed to Markets" value={formatProfit(poolStats.liquidityDeployed)} unit="$PROFIT" color="text-blue-400" />
        <StatCard label="Rewards Distributed" value={formatProfit(poolStats.totalRewardsDistributed)} unit="$PROFIT" color="text-yellow-400" />
        <div className="rounded-2xl border border-white/5 bg-surface-300/60 p-4 text-center">
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Pool Utilization</p>
          <div className="mt-2 flex items-center justify-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-primary-500 transition-all duration-1000"
                style={{ width: `${utilizationPct}%` }}
              />
            </div>
            <span className="text-sm font-bold text-white/80">{utilizationPct}%</span>
          </div>
        </div>
      </div>

      {/* Reward growth chart */}
      <div className="rounded-2xl border border-white/5 bg-surface-300/60 p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-white/40">
          Cumulative Rewards Growth (30d)
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growthData}>
              <defs>
                <linearGradient id="reward-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => formatProfit(v)}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  background: "rgba(0,0,0,0.9)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
                formatter={(value: number) => [`${formatProfit(value)} $PROFIT`, "Cumulative"]}
                labelStyle={{ color: "rgba(255,255,255,0.5)" }}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#reward-grad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* How liquidity works */}
      <div className="rounded-2xl border border-white/5 bg-surface-300/60 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-white/40">
          How LP Pools Work
        </h3>
        <div className="flex flex-col gap-2 text-xs text-white/50 leading-relaxed">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-emerald-400">{"\u25B6"}</span>
            <span>Pools back binary markets when one side is underfunded</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-blue-400">{"\u25B6"}</span>
            <span>When a market resolves, payouts pull from the LP pool proportionally</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-yellow-400">{"\u25B6"}</span>
            <span>Pool liquidity adjusts automatically as $PROFIT is staked or withdrawn</span>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-purple-400">{"\u25B6"}</span>
            <span>Resolution uses Pyth Network oracle data for BTC, ETH, SOL and CoinGecko for trending tokens</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit, color }: {
  label: string; value: string; unit?: string; color: string;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-surface-300/60 p-4 text-center">
      <p className="text-[10px] text-white/40 uppercase tracking-wider">{label}</p>
      <p className={`mt-1 text-xl font-black ${color}`}>{value}</p>
      {unit && <p className="text-[10px] text-white/30">{unit}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════
// LEADERBOARD SECTION
// ═══════════════════════════════════════════

function LeaderboardSection({ leaderboard }: { leaderboard: FarmLeaderboardEntry[] }) {
  const medals: Record<number, string> = { 1: "\uD83E\uDD47", 2: "\uD83E\uDD48", 3: "\uD83E\uDD49" };

  return (
    <div className="flex flex-col gap-4">
      {/* Podium — top 3 */}
      {leaderboard.length >= 3 && (
        <div className="flex items-end justify-center gap-3">
          {[leaderboard[1], leaderboard[0], leaderboard[2]].map((entry, idx) => {
            const place = [2, 1, 3][idx];
            const heights: Record<number, string> = { 1: "h-36", 2: "h-28", 3: "h-24" };
            const sizes: Record<number, string> = { 1: "w-28 sm:w-32", 2: "w-24 sm:w-28", 3: "w-24 sm:w-28" };
            const glows: Record<number, string> = {
              1: "shadow-yellow-500/20 border-yellow-500/30",
              2: "shadow-gray-400/10 border-gray-400/20",
              3: "shadow-orange-700/10 border-orange-700/20",
            };

            return (
              <div key={entry.wallet} className={`flex ${heights[place]} ${sizes[place]} flex-col items-center justify-end`}>
                <div className={`flex w-full flex-col items-center rounded-2xl border bg-surface-300/80 p-3 shadow-lg backdrop-blur-sm transition-all hover:scale-105 ${glows[place]}`}>
                  <span className="text-2xl leading-none">{medals[place]}</span>
                  <span className="mt-1.5 max-w-full truncate font-mono text-[11px] text-white/80">
                    {entry.wallet}
                  </span>
                  <p className="mt-1 text-xs font-bold text-emerald-400">
                    {formatProfit(entry.stakedAmount)}
                  </p>
                  <p className="text-[9px] text-white/30">{entry.tier}</p>
                  {entry.badges.length > 0 && (
                    <div className="mt-1 flex gap-0.5">
                      {entry.badges.map((b) => (
                        <span key={b.label} className="text-xs" title={b.label}>{b.icon}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List (rank 4+) */}
      <div className="flex flex-col gap-2">
        {leaderboard.slice(3).map((entry) => (
          <div
            key={entry.wallet}
            className="flex items-center gap-3 rounded-2xl border border-white/5 bg-surface-300/60 px-4 py-3 transition-all hover:border-white/10 hover:bg-surface-200/60"
          >
            <span className="w-7 shrink-0 text-center text-sm font-bold text-white/30">
              {entry.rank}
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-mono text-sm text-white/90">
                {entry.wallet}
              </span>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-white/40">
                  {entry.tier}
                </span>
                {entry.streakDays >= 7 && (
                  <span className="text-[10px] text-orange-400">
                    {"\uD83D\uDD25"} {entry.streakDays}d
                  </span>
                )}
                {entry.badges.map((b) => (
                  <span key={b.label} className="text-[10px]" title={b.label}>{b.icon}</span>
                ))}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-bold text-emerald-400">
                {formatProfit(entry.stakedAmount)}
              </p>
              <p className="text-[10px] text-white/30">
                earned {formatProfit(entry.totalEarned)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Bonus info */}
      <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-yellow-400/60">
          Bonus Rewards
        </h3>
        <div className="flex flex-col gap-1.5 text-xs text-white/50">
          <div className="flex items-center justify-between">
            <span>{"\uD83D\uDD25"} 7-day Streak Bonus</span>
            <span className="font-bold text-orange-400">+0.05%/wk per streak</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{"\uD83C\uDFC6"} Top 3 LP Bonus</span>
            <span className="font-bold text-yellow-400">+0.10%/wk</span>
          </div>
          <div className="flex items-center justify-between">
            <span>{"\uD83C\uDF89"} Special Event Bonus</span>
            <span className="font-bold text-purple-400">+0.08%/wk</span>
          </div>
        </div>
      </div>
    </div>
  );
}
