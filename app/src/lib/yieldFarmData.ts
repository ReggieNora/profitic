/**
 * $PROFIT Yield Farming — staking engine, reward calculator, and liquidity pool.
 *
 * In production this would be on-chain (Solana program + indexer).
 * For now we simulate realistic staking, tiered APY, daily rewards,
 * and liquidity integration with the binary market engine.
 */

// ── Types ──

export interface StakePosition {
  wallet: string;
  stakedAmount: number; // $PROFIT tokens
  stakedAt: number; // unix ms
  lastClaimAt: number; // unix ms
  pendingRewards: number; // unclaimed $PROFIT
  totalClaimed: number; // lifetime claimed $PROFIT
  streakDays: number; // consecutive days staked
}

export interface PoolStats {
  totalStaked: number; // total $PROFIT in pool
  totalStakers: number;
  liquidityAvailable: number; // available for binary markets
  liquidityDeployed: number; // currently backing markets
  totalRewardsDistributed: number;
  poolUtilization: number; // 0-1 ratio
}

export interface RewardTier {
  minStake: number;
  maxStake: number | null;
  weeklyApy: number; // percentage
  label: string;
}

export interface FarmLeaderboardEntry {
  wallet: string;
  rank: number;
  stakedAmount: number;
  totalEarned: number;
  streakDays: number;
  badges: FarmBadge[];
  tier: string;
}

export interface FarmBadge {
  icon: string;
  label: string;
}

export interface RewardHistoryEntry {
  timestamp: number;
  amount: number;
  type: "daily" | "bonus_streak" | "bonus_top_lp" | "bonus_event";
  label: string;
}

export interface StakeEvent {
  id: string;
  wallet: string;
  amount: number;
  type: "stake" | "unstake" | "claim";
  timestamp: number;
}

// ── Constants ──

export const REWARD_TIERS: RewardTier[] = [
  { minStake: 1, maxStake: 10_000, weeklyApy: 0.5, label: "Bronze" },
  { minStake: 10_000, maxStake: 50_000, weeklyApy: 0.35, label: "Silver" },
  { minStake: 50_000, maxStake: null, weeklyApy: 0.25, label: "Gold" },
];

const STREAK_BONUS = 0.05; // 0.05% weekly bonus per 7-day streak
const TOP_LP_BONUS = 0.1; // 0.1% weekly bonus for top 3 LPs
const EVENT_BONUS = 0.08; // 0.08% weekly bonus during special events

// ── Badge definitions ──

const BADGE_DIAMOND_HANDS: FarmBadge = { icon: "\uD83D\uDC8E", label: "Diamond Hands" };
const BADGE_WHALE_LP: FarmBadge = { icon: "\uD83D\uDC0B", label: "Whale LP" };
const BADGE_STREAK_MASTER: FarmBadge = { icon: "\uD83D\uDD25", label: "Streak Master" };
const BADGE_EARLY_FARMER: FarmBadge = { icon: "\uD83C\uDF31", label: "Early Farmer" };
const BADGE_TOP_LP: FarmBadge = { icon: "\uD83C\uDFC6", label: "Top LP" };

// ── Demo wallets ──

const FARM_WALLETS = [
  "7xPq..mK4a", "3bTr..nW8c", "9dLs..pJ2e", "5fHu..kR6g",
  "2hJv..tM9i", "8kNw..sP1j", "4mAx..vQ3l", "6nCy..wS5n",
  "1pEz..rT7o", "0qGa..uU4p", "BrIs..xV6q", "DtKu..yW8r",
  "FvMw..zA1s", "HxOy..bB3t", "JzQa..cC5u", "LbSc..dD7v",
  "NdUe..eE9w", "PfWg..fF2x", "RhYi..gG4y", "TjAk..hH6z",
];

// ── Seeded random ──

function seededRandom(seed: string): () => number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return () => {
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = (h ^ (h >>> 16)) * 0x45d9f3b;
    h = h ^ (h >>> 16);
    return (h >>> 0) / 0xffffffff;
  };
}

// ── Reward Calculation Engine ──

export function getTierForStake(amount: number): RewardTier {
  for (let i = REWARD_TIERS.length - 1; i >= 0; i--) {
    if (amount >= REWARD_TIERS[i].minStake) return REWARD_TIERS[i];
  }
  return REWARD_TIERS[0];
}

export function calculateDailyReward(
  stakedAmount: number,
  streakDays: number = 0,
  isTopLp: boolean = false,
  isEventActive: boolean = false
): number {
  if (stakedAmount <= 0) return 0;

  const tier = getTierForStake(stakedAmount);
  const dailyRate = tier.weeklyApy / 7 / 100;

  let bonusRate = 0;
  // Streak bonus: every 7 consecutive days
  if (streakDays >= 7) {
    bonusRate += (STREAK_BONUS / 7 / 100) * Math.floor(streakDays / 7);
  }
  // Top LP bonus
  if (isTopLp) bonusRate += TOP_LP_BONUS / 7 / 100;
  // Event bonus
  if (isEventActive) bonusRate += EVENT_BONUS / 7 / 100;

  return stakedAmount * (dailyRate + bonusRate);
}

export function calculatePendingRewards(position: StakePosition): number {
  const now = Date.now();
  const elapsed = now - position.lastClaimAt;
  const days = elapsed / (1000 * 60 * 60 * 24);
  return position.pendingRewards + calculateDailyReward(position.stakedAmount, position.streakDays) * days;
}

// ── Pool Stats Generator ──

export function getPoolStats(): PoolStats {
  const rng = seededRandom("pool-stats-v1");
  const totalStaked = 2_847_500 + Math.floor(rng() * 200_000);
  const liquidityDeployed = Math.floor(totalStaked * 0.35);
  const liquidityAvailable = totalStaked - liquidityDeployed;
  const totalRewardsDistributed = 142_350 + Math.floor(rng() * 10_000);

  return {
    totalStaked,
    totalStakers: 1_247 + Math.floor(rng() * 100),
    liquidityAvailable,
    liquidityDeployed,
    totalRewardsDistributed,
    poolUtilization: liquidityDeployed / totalStaked,
  };
}

// ── Demo Stake Positions (simulated stakers) ──

export function getDemoStakers(): StakePosition[] {
  const rng = seededRandom("farm-stakers-v1");
  const now = Date.now();

  return FARM_WALLETS.map((wallet) => {
    const stakedAmount = Math.floor(rng() * 200_000) + 500;
    const daysAgo = Math.floor(rng() * 60) + 1;
    const streakDays = Math.floor(rng() * daysAgo);
    const stakedAt = now - daysAgo * 86400_000;
    const dailyReward = calculateDailyReward(stakedAmount, streakDays);
    const totalClaimed = Math.floor(dailyReward * daysAgo * (0.5 + rng() * 0.4));
    const pendingDays = Math.floor(rng() * 7) + 1;

    return {
      wallet,
      stakedAmount,
      stakedAt,
      lastClaimAt: now - pendingDays * 86400_000,
      pendingRewards: Math.floor(dailyReward * pendingDays * 100) / 100,
      totalClaimed: Math.floor(totalClaimed * 100) / 100,
      streakDays,
    };
  }).sort((a, b) => b.stakedAmount - a.stakedAmount);
}

// ── Farm Leaderboard ──

export function getFarmLeaderboard(): FarmLeaderboardEntry[] {
  const stakers = getDemoStakers();

  return stakers.map((s, i) => {
    const tier = getTierForStake(s.stakedAmount);
    const badges: FarmBadge[] = [];

    if (s.streakDays >= 30) badges.push(BADGE_DIAMOND_HANDS);
    if (s.stakedAmount >= 100_000) badges.push(BADGE_WHALE_LP);
    if (s.streakDays >= 14) badges.push(BADGE_STREAK_MASTER);
    if (i < 3) badges.push(BADGE_TOP_LP);
    if (s.streakDays >= 45) badges.push(BADGE_EARLY_FARMER);

    return {
      wallet: s.wallet,
      rank: i + 1,
      stakedAmount: s.stakedAmount,
      totalEarned: s.totalClaimed + s.pendingRewards,
      streakDays: s.streakDays,
      badges,
      tier: tier.label,
    };
  });
}

// ── Reward History (demo — last 30 days) ──

export function getRewardHistory(wallet?: string): RewardHistoryEntry[] {
  const rng = seededRandom(`reward-history-${wallet || "demo"}`);
  const now = Date.now();
  const entries: RewardHistoryEntry[] = [];

  for (let d = 0; d < 30; d++) {
    const ts = now - d * 86400_000;
    const base = 50 + rng() * 200;
    entries.push({
      timestamp: ts,
      amount: Math.floor(base * 100) / 100,
      type: "daily",
      label: "Daily reward",
    });

    // Streak bonus every 7 days
    if (d % 7 === 0 && d > 0) {
      entries.push({
        timestamp: ts,
        amount: Math.floor(base * 0.1 * 100) / 100,
        type: "bonus_streak",
        label: `${Math.floor(d / 7) * 7}-day streak bonus`,
      });
    }

    // Occasional top LP bonus
    if (rng() < 0.15) {
      entries.push({
        timestamp: ts,
        amount: Math.floor(base * 0.2 * 100) / 100,
        type: "bonus_top_lp",
        label: "Top LP bonus",
      });
    }
  }

  return entries.sort((a, b) => b.timestamp - a.timestamp);
}

// ── Reward Growth Chart Data (for the graph) ──

export interface RewardGrowthPoint {
  day: string;
  cumulative: number;
  daily: number;
}

export function getRewardGrowthData(days: number = 30): RewardGrowthPoint[] {
  const rng = seededRandom("reward-growth-v1");
  const points: RewardGrowthPoint[] = [];
  let cumulative = 0;

  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(Date.now() - d * 86400_000);
    const daily = 3500 + rng() * 2000 + (days - d) * 50; // growing trend
    cumulative += daily;
    points.push({
      day: `${date.getMonth() + 1}/${date.getDate()}`,
      cumulative: Math.floor(cumulative),
      daily: Math.floor(daily),
    });
  }

  return points;
}

// ── Live Stake Events (activity feed) ──

export function generateStakeEvent(): StakeEvent {
  const wallet = FARM_WALLETS[Math.floor(Math.random() * FARM_WALLETS.length)];
  const types: Array<"stake" | "unstake" | "claim"> = ["stake", "stake", "stake", "claim", "unstake"];
  const type = types[Math.floor(Math.random() * types.length)];
  const amount =
    type === "stake" ? Math.floor(Math.random() * 50_000) + 100
    : type === "unstake" ? Math.floor(Math.random() * 20_000) + 50
    : Math.floor(Math.random() * 500) + 10;

  return {
    id: `se-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    wallet,
    amount,
    type,
    timestamp: Date.now(),
  };
}

// ── APY Display Helper ──

export function getApyDisplay(weeklyApy: number): { daily: string; weekly: string; annual: string } {
  const daily = weeklyApy / 7;
  const annual = weeklyApy * 52;
  return {
    daily: daily.toFixed(3) + "%",
    weekly: weeklyApy.toFixed(2) + "%",
    annual: annual.toFixed(1) + "%",
  };
}

// ── Format helpers ──

export function formatProfit(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(2);
}
