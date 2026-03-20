"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useBinaryMarkets, UserBet, CompletedRound, PendingClaim } from "@/hooks/useBinaryMarkets";
import { useSolBalance } from "@/hooks/useSolBalance";

function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatSolAmount(lamports: number): string {
  const sol = lamports / 1_000_000_000;
  if (sol >= 1000) return `${(sol / 1000).toFixed(1)}k SOL`;
  if (sol >= 1) return `${sol.toFixed(2)} SOL`;
  if (sol >= 0.01) return `${sol.toFixed(4)} SOL`;
  return `${sol.toFixed(6)} SOL`;
}

export default function ProfilePage() {
  const { connected, publicKey } = useWallet();
  const { balance } = useSolBalance();
  const {
    userBets,
    roundHistory,
    lastPayout,
    demoBalance,
    claimWinnings,
    txPending,
    markets,
    pendingClaims,
    retryClaimWinnings,
  } = useBinaryMarkets();
  const [tab, setTab] = useState<"active" | "history" | "stats">("active");
  const [claimError, setClaimError] = useState<string | null>(null);

  // Flatten all completed rounds from history
  const allCompletedRounds: CompletedRound[] = Object.values(roundHistory).flat();
  allCompletedRounds.sort((a, b) => b.endTime - a.endTime); // newest first

  // Calculate stats from completed rounds where user had bets
  const totalRoundsParticipated = allCompletedRounds.filter(
    (r) => r.totalBets > 0
  ).length;

  if (!connected) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center animate-fade-up">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-primary">
          <svg
            className="h-10 w-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
            />
          </svg>
        </div>
        <h1 className="mb-2 text-2xl font-bold text-white">Connect Wallet</h1>
        <p className="mb-2 text-sm text-gray-400">
          Your wallet is your identity on Profitic.
        </p>
        <p className="mb-6 text-xs text-gray-500">
          No email or password needed. Just connect and start predicting.
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  const walletAddr = publicKey?.toBase58() || "";

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-24 sm:max-w-2xl sm:px-6 md:pb-6">
      {/* Profile Header */}
      <div className="mb-6 animate-fade-up">
        <div className="flex items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-primary ring-2 ring-primary-500/30 sm:h-20 sm:w-20">
            <span className="text-xl font-black text-white sm:text-2xl">
              {walletAddr.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white truncate">
                {shortenAddress(walletAddr)}
              </h1>
              <button
                onClick={() => navigator.clipboard.writeText(walletAddr)}
                className="shrink-0 rounded-lg p-1 text-gray-500 transition-colors hover:text-white active:scale-90"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
              </button>
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="text-xs text-gray-500">Solana Predictor</p>
              <span className="rounded-md bg-yellow-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-yellow-400">
                Devnet
              </span>
            </div>
            <a
              href={`https://explorer.solana.com/address/${walletAddr}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 text-[11px] text-primary-400 hover:underline"
            >
              View on Solana Explorer
            </a>
          </div>
        </div>
      </div>

      {/* Balance & Stats */}
      <div className="mb-6 grid grid-cols-3 gap-2 animate-fade-up" style={{ animationDelay: "60ms" }}>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-3 text-center">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Balance</p>
          <p className="mt-1 text-lg font-black text-white">
            {balance !== null ? `${balance.toFixed(2)}` : "..."}
          </p>
          <p className="text-[10px] text-gray-600">SOL</p>
        </div>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-3 text-center">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Active Bets</p>
          <p className="mt-1 text-lg font-black text-primary-400">{userBets.length}</p>
          <p className="text-[10px] text-gray-600">open positions</p>
        </div>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-3 text-center">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Rounds</p>
          <p className="mt-1 text-lg font-black text-white">{allCompletedRounds.length}</p>
          <p className="text-[10px] text-gray-600">completed</p>
        </div>
      </div>

      {/* Last Payout Banner */}
      {lastPayout && (
        <div
          className={`mb-6 rounded-2xl border p-4 animate-fade-up ${
            lastPayout.won
              ? "border-green-500/20 bg-green-500/10"
              : "border-red-500/20 bg-red-500/10"
          }`}
          style={{ animationDelay: "90ms" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Last Result</p>
              <p className={`text-xl font-black ${lastPayout.won ? "text-green-400" : "text-red-400"}`}>
                {lastPayout.won ? "+" : "-"}{lastPayout.amount.toFixed(4)} SOL
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                lastPayout.won
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              {lastPayout.won ? "WON" : "LOST"}
            </span>
          </div>
        </div>
      )}

      {/* Claim error */}
      {claimError && (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          {claimError}
        </div>
      )}

      {/* Pending on-chain claims */}
      {pendingClaims.length > 0 && (
        <div className="mb-4 space-y-2 animate-fade-up">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-yellow-400">
            Unclaimed Winnings
          </h3>
          {pendingClaims.map((claim) => (
            <div
              key={claim.marketId}
              className="flex items-center justify-between rounded-xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3"
            >
              <div>
                <span className="text-sm font-semibold text-white">
                  {claim.asset} Round #{claim.roundNumber}
                </span>
                <span className="ml-2 text-xs text-green-400">
                  +{claim.payoutSol.toFixed(4)} SOL
                </span>
              </div>
              <button
                onClick={async () => {
                  setClaimError(null);
                  try {
                    await retryClaimWinnings(claim);
                  } catch (err: unknown) {
                    setClaimError(err instanceof Error ? err.message : "Claim failed");
                  }
                }}
                disabled={txPending}
                className="rounded-lg bg-green-600 px-4 py-1.5 text-xs font-bold text-white transition-all hover:bg-green-500 active:scale-95 disabled:opacity-50"
              >
                {txPending ? "Claiming..." : "Claim"}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl bg-surface-400 p-1 animate-fade-up" style={{ animationDelay: "120ms" }}>
        {(
          [
            { key: "active", label: "Active Bets", count: userBets.length },
            { key: "history", label: "Round History", count: allCompletedRounds.length },
            { key: "stats", label: "Stats", count: 0 },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all duration-200 active:scale-95 ${
              tab === t.key
                ? "bg-surface-200 text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary-600/30 px-1 text-[10px] text-primary-300">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-3 stagger-children">
        {tab === "active" && (
          userBets.length === 0 ? (
            <EmptyState
              title="No active bets"
              subtitle={
                <>
                  Place bets on the{" "}
                  <Link href="/" className="text-primary-400 hover:underline">
                    home feed
                  </Link>
                  .
                </>
              }
            />
          ) : (
            userBets.map((bet) => {
              const market = markets.find((m) => m.id === bet.marketId);
              return (
                <ActiveBetCard
                  key={bet.marketId}
                  bet={bet}
                  marketLabel={market ? `${market.asset.symbol} ${market.intervalLabel}` : bet.marketId}
                  phase={market?.phase || "betting"}
                  entryPrice={market?.entryPrice}
                  timeRemaining={market ? Math.max(0, market.endTime - Math.floor(Date.now() / 1000)) : 0}
                />
              );
            })
          )
        )}

        {tab === "history" && (
          allCompletedRounds.length === 0 ? (
            <EmptyState
              title="No completed rounds yet"
              subtitle="Rounds will appear here after they resolve."
            />
          ) : (
            allCompletedRounds.slice(0, 50).map((round) => (
              <CompletedRoundCard key={round.id} round={round} />
            ))
          )
        )}

        {tab === "stats" && (
          <StatsPanel
            completedRounds={allCompletedRounds}
            activeBets={userBets}
            balance={balance}
          />
        )}
      </div>
    </div>
  );
}

function EmptyState({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-surface-50/50 bg-surface-300 py-12 text-center">
      <p className="text-sm font-medium text-gray-400">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-gray-500">{subtitle}</p>}
    </div>
  );
}

function ActiveBetCard({
  bet,
  marketLabel,
  phase,
  entryPrice,
  timeRemaining,
}: {
  bet: UserBet;
  marketLabel: string;
  phase: string;
  entryPrice?: number;
  timeRemaining: number;
}) {
  const amountSol = bet.amount / 1_000_000_000;
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;

  return (
    <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-4 transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white">{marketLabel}</p>
          {entryPrice && (
            <p className="mt-0.5 text-[11px] text-gray-500">
              Entry: ${entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            phase === "betting"
              ? "bg-green-500/20 text-green-400"
              : phase === "locked"
              ? "bg-yellow-500/20 text-yellow-400"
              : "bg-gray-500/20 text-gray-400"
          }`}
        >
          {phase}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <span
          className={`rounded-lg px-2 py-1 font-bold ${
            bet.side === "up"
              ? "bg-green-500/15 text-green-400"
              : "bg-red-500/15 text-red-400"
          }`}
        >
          {bet.side.toUpperCase()}
        </span>
        <span className="font-medium text-white">{amountSol.toFixed(4)} SOL</span>
        {timeRemaining > 0 && (
          <span className="text-gray-500">
            {minutes}:{seconds.toString().padStart(2, "0")} left
          </span>
        )}
      </div>
    </div>
  );
}

function CompletedRoundCard({ round }: { round: CompletedRound }) {
  const totalPoolSol = round.totalPool / 1_000_000_000;
  const feeSol = round.feeCollected / 1_000_000_000;
  const priceDiff = round.finalPrice - round.entryPrice;
  const priceDiffPct = round.entryPrice > 0 ? ((priceDiff / round.entryPrice) * 100).toFixed(2) : "0.00";

  return (
    <div
      className={`rounded-2xl border p-4 transition-all duration-200 ${
        round.outcome === "up"
          ? "border-green-500/10 bg-surface-300"
          : round.outcome === "down"
          ? "border-red-500/10 bg-surface-300"
          : "border-surface-50/50 bg-surface-300"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">
            {round.asset.symbol} {round.intervalLabel}
          </p>
          <p className="mt-0.5 text-[11px] text-gray-500">
            Round #{round.roundNumber} &middot; {new Date(round.endTime * 1000).toLocaleTimeString()}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
            round.outcome === "up"
              ? "bg-green-500/20 text-green-400"
              : round.outcome === "down"
              ? "bg-red-500/20 text-red-400"
              : "bg-yellow-500/20 text-yellow-400"
          }`}
        >
          {round.outcome}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <span className="text-gray-500">
          ${round.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          {" → "}
          ${round.finalPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        <span className={`font-bold ${priceDiff >= 0 ? "text-green-400" : "text-red-400"}`}>
          {priceDiff >= 0 ? "+" : ""}{priceDiffPct}%
        </span>
        {totalPoolSol > 0 && (
          <span className="text-gray-500">
            Pool: {totalPoolSol.toFixed(4)} SOL
          </span>
        )}
        <span className="text-gray-600">
          {round.totalBets} bet{round.totalBets !== 1 ? "s" : ""}
        </span>
      </div>
    </div>
  );
}

function StatsPanel({
  completedRounds,
  activeBets,
  balance,
}: {
  completedRounds: CompletedRound[];
  activeBets: UserBet[];
  balance: number | null;
}) {
  const totalRounds = completedRounds.length;
  const upRounds = completedRounds.filter((r) => r.outcome === "up").length;
  const downRounds = completedRounds.filter((r) => r.outcome === "down").length;
  const totalVolume = completedRounds.reduce((sum, r) => sum + r.totalPool, 0);
  const totalFees = completedRounds.reduce((sum, r) => sum + r.feeCollected, 0);
  const totalBetsPlaced = completedRounds.reduce((sum, r) => sum + r.totalBets, 0);

  // Assets breakdown
  const assetStats: Record<string, { rounds: number; volume: number }> = {};
  for (const r of completedRounds) {
    const sym = r.asset.symbol;
    if (!assetStats[sym]) assetStats[sym] = { rounds: 0, volume: 0 };
    assetStats[sym].rounds++;
    assetStats[sym].volume += r.totalPool;
  }

  const activeBetTotal = activeBets.reduce((sum, b) => sum + b.amount, 0);

  return (
    <div className="space-y-4">
      {/* Overview */}
      <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-5 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          Session Overview
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <StatItem label="Wallet Balance" value={balance !== null ? `${balance.toFixed(2)} SOL` : "..."} />
          <StatItem label="Active Bets" value={`${activeBets.length} (${(activeBetTotal / 1e9).toFixed(4)} SOL)`} />
          <StatItem label="Rounds Observed" value={totalRounds.toString()} />
          <StatItem label="Total Bets Placed" value={totalBetsPlaced.toString()} />
          <StatItem label="Total Volume" value={`${(totalVolume / 1e9).toFixed(4)} SOL`} />
          <StatItem label="Fees Collected" value={`${(totalFees / 1e9).toFixed(6)} SOL`} />
        </div>
      </div>

      {/* Outcome Distribution */}
      {totalRounds > 0 && (
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-5 space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            Outcome Distribution
          </h3>
          <div className="flex gap-3">
            <div className="flex-1 rounded-xl bg-green-500/10 p-3 text-center">
              <p className="text-2xl font-black text-green-400">{upRounds}</p>
              <p className="text-[10px] text-gray-500">UP</p>
            </div>
            <div className="flex-1 rounded-xl bg-red-500/10 p-3 text-center">
              <p className="text-2xl font-black text-red-400">{downRounds}</p>
              <p className="text-[10px] text-gray-500">DOWN</p>
            </div>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-green-500"
              style={{ width: `${totalRounds > 0 ? (upRounds / totalRounds) * 100 : 50}%` }}
            />
          </div>
          <p className="text-[10px] text-gray-600 text-center">
            {totalRounds > 0 ? ((upRounds / totalRounds) * 100).toFixed(0) : 50}% UP / {totalRounds > 0 ? ((downRounds / totalRounds) * 100).toFixed(0) : 50}% DOWN
          </p>
        </div>
      )}

      {/* Per-Asset */}
      {Object.keys(assetStats).length > 0 && (
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-5 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
            By Asset
          </h3>
          {Object.entries(assetStats)
            .sort((a, b) => b[1].rounds - a[1].rounds)
            .map(([sym, stats]) => (
              <div key={sym} className="flex items-center justify-between rounded-xl bg-surface-400/50 px-3 py-2">
                <span className="text-sm font-bold text-white">{sym}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-gray-400">{stats.rounds} rounds</span>
                  <span className="text-gray-500">{(stats.volume / 1e9).toFixed(4)} SOL</span>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-0.5 text-sm font-bold text-white">{value}</p>
    </div>
  );
}
