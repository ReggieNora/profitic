/**
 * Leaderboard demo data & types for Profitic binary markets.
 *
 * In production this would come from on-chain event indexing.
 * For now we generate realistic-looking demo entries that
 * rotate on Today / This Week / All Time timeframes.
 */

// ── Types ──

export type LeaderboardCategory =
  | "profit"
  | "streak"
  | "biggestWin"
  | "contrarian"
  | "volume";

export type LeaderboardTimeframe = "today" | "week" | "allTime";

export interface LeaderboardEntry {
  wallet: string;
  rank: number;
  /** Profit leaderboard */
  profit?: number; // SOL
  /** Win streak */
  winStreak?: number;
  /** Biggest win */
  betAmount?: number; // SOL
  payout?: number; // SOL
  multiplier?: number;
  /** Contrarian wins */
  contrarianWins?: number;
  /** Volume */
  volume?: number; // SOL
  /** Badges earned */
  badges: Badge[];
  /** Change direction for live notification */
  change?: "up" | "down" | "new";
}

export interface Badge {
  icon: string;
  label: string;
}

// ── Badge definitions ──

export const BADGE_STREAK: Badge = { icon: "\uD83D\uDD25", label: "Streak Master" };
export const BADGE_WHALE: Badge = { icon: "\uD83D\uDC0B", label: "Whale" };
export const BADGE_SNIPER: Badge = { icon: "\uD83C\uDFAF", label: "Sniper" };
export const BADGE_CONTRARIAN: Badge = { icon: "\uD83C\uDFF9", label: "Contrarian" };

// ── Demo wallets (shortened Solana-style) ──

const WALLETS = [
  "8aF9..xK2p",
  "3bTq..mR7x",
  "9cLw..pK4d",
  "5dHv..nM8s",
  "2eJx..kP6w",
  "7fGs..tR1y",
  "4gCn..vU3q",
  "6hDm..wV5r",
  "1iAf..sW7t",
  "0jEh..rX9u",
  "Bk4z..qL2m",
  "Cm8w..yN5v",
  "Dn3x..zA7p",
  "Ep6s..bC9r",
  "Fq1t..cD4w",
  "Gr7u..dE6x",
  "Hs2v..eF8y",
  "It5w..fG3z",
  "Ju9x..gH1a",
  "Kv4y..hI7b",
];

// ── Deterministic-ish random seeded by wallet+category+timeframe ──

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

function badgesFor(
  category: LeaderboardCategory,
  entry: Partial<LeaderboardEntry>
): Badge[] {
  const badges: Badge[] = [];
  if (category === "streak" && (entry.winStreak ?? 0) >= 5)
    badges.push(BADGE_STREAK);
  if (category === "volume" && (entry.volume ?? 0) >= 200)
    badges.push(BADGE_WHALE);
  if (
    category === "biggestWin" &&
    (entry.multiplier ?? 0) >= 3
  )
    badges.push(BADGE_SNIPER);
  if (category === "contrarian" && (entry.contrarianWins ?? 0) >= 5)
    badges.push(BADGE_CONTRARIAN);
  if (category === "profit" && (entry.profit ?? 0) >= 50)
    badges.push(BADGE_SNIPER);
  if (category === "profit" && (entry.profit ?? 0) >= 100)
    badges.push(BADGE_WHALE);
  return badges;
}

// ── Generator per category ──

function generateProfit(
  tf: LeaderboardTimeframe,
  count: number
): LeaderboardEntry[] {
  const scale = tf === "today" ? 1 : tf === "week" ? 5 : 20;
  const rng = seededRandom(`profit-${tf}`);
  return WALLETS.slice(0, count)
    .map((wallet) => {
      const profit = +(rng() * 80 * scale + 2).toFixed(2);
      return { wallet, profit, rank: 0, badges: [] } as LeaderboardEntry;
    })
    .sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0))
    .map((e, i) => ({
      ...e,
      rank: i + 1,
      badges: badgesFor("profit", e),
      change: i < 3 ? ("up" as const) : undefined,
    }));
}

function generateStreak(
  tf: LeaderboardTimeframe,
  count: number
): LeaderboardEntry[] {
  const scale = tf === "today" ? 1 : tf === "week" ? 2 : 4;
  const rng = seededRandom(`streak-${tf}`);
  return WALLETS.slice(0, count)
    .map((wallet) => {
      const winStreak = Math.floor(rng() * 12 * scale) + 1;
      return { wallet, winStreak, rank: 0, badges: [] } as LeaderboardEntry;
    })
    .sort((a, b) => (b.winStreak ?? 0) - (a.winStreak ?? 0))
    .map((e, i) => ({
      ...e,
      rank: i + 1,
      badges: badgesFor("streak", e),
      change: i === 0 ? ("up" as const) : undefined,
    }));
}

function generateBiggestWin(
  tf: LeaderboardTimeframe,
  count: number
): LeaderboardEntry[] {
  const scale = tf === "today" ? 1 : tf === "week" ? 3 : 10;
  const rng = seededRandom(`bigwin-${tf}`);
  return WALLETS.slice(0, count)
    .map((wallet) => {
      const betAmount = +(rng() * 10 * scale + 0.5).toFixed(2);
      const multiplier = +(rng() * 6 + 1.2).toFixed(2);
      const payout = +(betAmount * multiplier).toFixed(2);
      return {
        wallet,
        betAmount,
        payout,
        multiplier,
        rank: 0,
        badges: [],
      } as LeaderboardEntry;
    })
    .sort((a, b) => (b.payout ?? 0) - (a.payout ?? 0))
    .map((e, i) => ({
      ...e,
      rank: i + 1,
      badges: badgesFor("biggestWin", e),
    }));
}

function generateContrarian(
  tf: LeaderboardTimeframe,
  count: number
): LeaderboardEntry[] {
  const scale = tf === "today" ? 1 : tf === "week" ? 3 : 8;
  const rng = seededRandom(`contrarian-${tf}`);
  return WALLETS.slice(0, count)
    .map((wallet) => {
      const contrarianWins = Math.floor(rng() * 10 * scale) + 1;
      return { wallet, contrarianWins, rank: 0, badges: [] } as LeaderboardEntry;
    })
    .sort((a, b) => (b.contrarianWins ?? 0) - (a.contrarianWins ?? 0))
    .map((e, i) => ({
      ...e,
      rank: i + 1,
      badges: badgesFor("contrarian", e),
    }));
}

function generateVolume(
  tf: LeaderboardTimeframe,
  count: number
): LeaderboardEntry[] {
  const scale = tf === "today" ? 1 : tf === "week" ? 5 : 25;
  const rng = seededRandom(`volume-${tf}`);
  return WALLETS.slice(0, count)
    .map((wallet) => {
      const volume = +(rng() * 200 * scale + 10).toFixed(2);
      return { wallet, volume, rank: 0, badges: [] } as LeaderboardEntry;
    })
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .map((e, i) => ({
      ...e,
      rank: i + 1,
      badges: badgesFor("volume", e),
      change: i < 2 ? ("up" as const) : undefined,
    }));
}

// ── Public API ──

export function getLeaderboard(
  category: LeaderboardCategory,
  timeframe: LeaderboardTimeframe,
  count = 15
): LeaderboardEntry[] {
  switch (category) {
    case "profit":
      return generateProfit(timeframe, count);
    case "streak":
      return generateStreak(timeframe, count);
    case "biggestWin":
      return generateBiggestWin(timeframe, count);
    case "contrarian":
      return generateContrarian(timeframe, count);
    case "volume":
      return generateVolume(timeframe, count);
  }
}

// ── Live activity notifications ──

export interface LiveNotification {
  id: string;
  message: string;
  timestamp: number;
}

const NOTIFICATION_TEMPLATES = [
  (w: string, v: string) => `${w} moved to #2 on the Profit Leaderboard after winning ${v} SOL`,
  (w: string, v: string) => `${w} is on a ${v}-win streak!`,
  (w: string, v: string) => `${w} just scored a ${v}x contrarian win!`,
  (w: string, v: string) => `${w} climbed to #${v} on Volume Leaderboard`,
  (w: string, v: string) => `${w} hit a ${v} SOL payout — Biggest Win today!`,
];

export function generateLiveNotification(): LiveNotification {
  const wallet = WALLETS[Math.floor(Math.random() * WALLETS.length)];
  const template =
    NOTIFICATION_TEMPLATES[
      Math.floor(Math.random() * NOTIFICATION_TEMPLATES.length)
    ];
  const values = [
    (Math.random() * 10 + 1).toFixed(1),
    String(Math.floor(Math.random() * 8) + 3),
    (Math.random() * 4 + 1.5).toFixed(1),
    String(Math.floor(Math.random() * 5) + 1),
    (Math.random() * 20 + 5).toFixed(1),
  ];
  const value = values[Math.floor(Math.random() * values.length)];

  return {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    message: template(wallet, value),
    timestamp: Date.now(),
  };
}
