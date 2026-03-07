"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Position } from "@/types";
import { formatSol, lamportsToSol } from "@/lib/bondingCurve";

// Demo positions for development
function getDemoPositions(): Position[] {
  return [
    {
      marketId: "demo-1",
      market: {
        id: "demo-1",
        publicKey: "Demo1111",
        question: "Will Bitcoin exceed $100,000 by end of Q1 2026?",
        description: "",
        creator: "",
        resolutionDate: Math.floor(Date.now() / 1000) + 86400 * 30,
        dataSourceUrl: "",
        outcome: "unresolved",
        yesShares: 15000,
        noShares: 10000,
        totalVolume: 50_000_000_000,
        liquidityPool: 25_000_000_000,
        yesPrice: 0.6,
        noPrice: 0.4,
        resolved: false,
        createdAt: 0,
      },
      outcome: "yes",
      shares: 500,
      avgPrice: 0.55,
      currentValue: 300_000_000,
      pnl: 25_000_000,
      claimable: false,
      claimed: false,
    },
    {
      marketId: "demo-2",
      market: {
        id: "demo-2",
        publicKey: "Demo2222",
        question: "Will Ethereum implement full danksharding in 2026?",
        description: "",
        creator: "",
        resolutionDate: Math.floor(Date.now() / 1000) + 86400 * 90,
        dataSourceUrl: "",
        outcome: "unresolved",
        yesShares: 8000,
        noShares: 22000,
        totalVolume: 30_000_000_000,
        liquidityPool: 15_000_000_000,
        yesPrice: 0.267,
        noPrice: 0.733,
        resolved: false,
        createdAt: 0,
      },
      outcome: "no",
      shares: 300,
      avgPrice: 0.7,
      currentValue: 220_000_000,
      pnl: 10_000_000,
      claimable: false,
      claimed: false,
    },
    {
      marketId: "demo-resolved",
      market: {
        id: "demo-resolved",
        publicKey: "DemoR111",
        question: "Will SOL exceed $200 in January 2026?",
        description: "",
        creator: "",
        resolutionDate: Math.floor(Date.now() / 1000) - 86400 * 5,
        dataSourceUrl: "",
        outcome: "yes",
        yesShares: 20000,
        noShares: 5000,
        totalVolume: 60_000_000_000,
        liquidityPool: 0,
        yesPrice: 1,
        noPrice: 0,
        resolved: true,
        resolvedOutcome: "yes",
        createdAt: 0,
      },
      outcome: "yes",
      shares: 200,
      avgPrice: 0.65,
      currentValue: 200_000_000,
      pnl: 70_000_000,
      claimable: true,
      claimed: false,
    },
  ];
}

function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function ProfilePage() {
  const { connected, publicKey } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"predictions" | "active" | "settled">("predictions");
  const [isFollowing, setIsFollowing] = useState(false);

  useEffect(() => {
    if (connected) {
      setLoading(true);
      setTimeout(() => {
        setPositions(getDemoPositions());
        setLoading(false);
      }, 500);
    }
  }, [connected]);

  const activePositions = positions.filter(
    (p) => !p.market?.resolved && !p.claimed
  );
  const claimablePositions = positions.filter(
    (p) => p.claimable && !p.claimed
  );
  const settledPositions = positions.filter(
    (p) => p.claimed || p.market?.resolved
  );

  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const claimableValue = claimablePositions.reduce(
    (sum, p) => sum + p.currentValue,
    0
  );

  // Demo profile stats
  const winRate = 68;
  const totalPredictions = 47;
  const roi = 42.5;
  const followers = 128;
  const following = 34;

  const handleClaim = async (marketId: string) => {
    alert(
      `Claiming winnings for market ${marketId}.\n\nIn production, this sends a claimWinnings transaction.`
    );
  };

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
          {/* Avatar */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-primary ring-2 ring-primary-500/30 sm:h-20 sm:w-20">
            <span className="text-xl font-black text-white sm:text-2xl">
              {walletAddr.slice(0, 2).toUpperCase()}
            </span>
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-white truncate">
                {shortenAddress(walletAddr)}
              </h1>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(walletAddr);
                }}
                className="shrink-0 rounded-lg p-1 text-gray-500 transition-colors hover:text-white active:scale-90"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
              </button>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">Solana Predictor</p>

            {/* Followers row */}
            <div className="mt-2 flex items-center gap-4 text-xs">
              <span className="text-gray-400">
                <span className="font-bold text-white">{followers}</span> followers
              </span>
              <span className="text-gray-400">
                <span className="font-bold text-white">{following}</span> following
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setIsFollowing(!isFollowing)}
            className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition-all active:scale-95 ${
              isFollowing
                ? "border border-white/10 bg-surface-300 text-white"
                : "bg-gradient-primary text-white shadow-lg shadow-primary-500/20"
            }`}
          >
            {isFollowing ? "Following" : "Follow"}
          </button>
          <button className="rounded-xl border border-white/10 bg-surface-300 px-5 py-2.5 text-sm font-bold text-white transition-all active:scale-95">
            Share
          </button>
        </div>
      </div>

      {/* Performance Stats */}
      <div className="mb-6 grid grid-cols-4 gap-2 animate-fade-up" style={{ animationDelay: "60ms" }}>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-3 text-center">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Win Rate</p>
          <p className="mt-1 text-lg font-black text-green-400">{winRate}%</p>
        </div>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-3 text-center">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Predictions</p>
          <p className="mt-1 text-lg font-black text-white">{totalPredictions}</p>
        </div>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-3 text-center">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">ROI</p>
          <p className={`mt-1 text-lg font-black ${roi >= 0 ? "text-green-400" : "text-red-400"}`}>
            {roi >= 0 ? "+" : ""}{roi}%
          </p>
        </div>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-3 text-center">
          <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">Value</p>
          <p className="mt-1 text-lg font-black text-white">
            {formatSol(lamportsToSol(totalValue))}
          </p>
        </div>
      </div>

      {/* Top Call highlight */}
      {claimablePositions.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-2xl border border-green-500/20 bg-gradient-to-r from-green-500/10 to-emerald-500/5 p-4 animate-fade-up" style={{ animationDelay: "90ms" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400 uppercase tracking-wider">
              Top Call
            </span>
            <span className="text-[10px] text-gray-500">Best prediction</span>
          </div>
          <Link
            href={`/market/${claimablePositions[0].marketId}`}
            className="block text-sm font-bold text-white hover:text-green-300 transition-colors"
          >
            {claimablePositions[0].market?.question}
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-xs font-bold text-green-400">
              +{formatSol(lamportsToSol(claimablePositions[0].pnl))} return
            </span>
            <span className="text-[10px] text-gray-500">
              {((claimablePositions[0].pnl / (claimablePositions[0].currentValue - claimablePositions[0].pnl)) * 100).toFixed(0)}% ROI
            </span>
          </div>
        </div>
      )}

      {/* Portfolio summary */}
      {claimableValue > 0 && (
        <div className="mb-6 rounded-2xl border border-primary-500/20 bg-primary-500/5 p-4 animate-fade-up" style={{ animationDelay: "120ms" }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Claimable Winnings</p>
              <p className="text-xl font-black text-primary-300">
                {formatSol(lamportsToSol(claimableValue))}
              </p>
            </div>
            <button
              onClick={() => claimablePositions.forEach((p) => handleClaim(p.marketId))}
              className="rounded-xl bg-gradient-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-primary-500/20 transition-all active:scale-95"
            >
              Claim All
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl bg-surface-400 p-1 animate-fade-up" style={{ animationDelay: "150ms" }}>
        {(
          [
            { key: "predictions", label: "Predictions", count: positions.length },
            { key: "active", label: "Active Markets", count: activePositions.length },
            { key: "settled", label: "Settled", count: settledPositions.length },
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
      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </div>
      ) : (
        <div className="space-y-3 stagger-children">
          {tab === "predictions" &&
            (positions.length === 0 ? (
              <EmptyState
                title="No predictions yet"
                subtitle={
                  <>
                    Start trading on the{" "}
                    <Link href="/" className="text-primary-400 hover:underline">
                      feed
                    </Link>
                    .
                  </>
                }
              />
            ) : (
              positions.map((pos) => (
                <PositionCard
                  key={pos.marketId}
                  position={pos}
                  onClaim={pos.claimable && !pos.claimed ? () => handleClaim(pos.marketId) : undefined}
                />
              ))
            ))}

          {tab === "active" &&
            (activePositions.length === 0 ? (
              <EmptyState
                title="No active positions"
                subtitle={
                  <>
                    Start trading on the{" "}
                    <Link href="/" className="text-primary-400 hover:underline">
                      feed
                    </Link>
                    .
                  </>
                }
              />
            ) : (
              activePositions.map((pos) => (
                <PositionCard key={pos.marketId} position={pos} />
              ))
            ))}

          {tab === "settled" &&
            (settledPositions.length === 0 ? (
              <EmptyState
                title="No settled predictions"
                subtitle="Settled predictions appear here after resolution."
              />
            ) : (
              settledPositions.map((pos) => (
                <PositionCard
                  key={pos.marketId}
                  position={pos}
                  onClaim={pos.claimable && !pos.claimed ? () => handleClaim(pos.marketId) : undefined}
                />
              ))
            ))}
        </div>
      )}
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

function PositionCard({
  position,
  onClaim,
}: {
  position: Position;
  onClaim?: () => void;
}) {
  const isWin = position.market?.resolved && position.market.resolvedOutcome === position.outcome;

  return (
    <div className={`rounded-2xl border p-4 transition-all duration-200 active:scale-[0.99] ${
      isWin
        ? "border-green-500/20 bg-green-500/5"
        : "border-surface-50/50 bg-surface-300"
    }`}>
      <div className="flex items-start justify-between gap-3">
        <Link
          href={`/market/${position.marketId}`}
          className="block min-w-0 flex-1 text-sm font-semibold text-white transition-colors hover:text-primary-300"
        >
          {position.market?.question || position.marketId}
        </Link>
        {isWin && (
          <span className="shrink-0 rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] font-bold text-green-400">
            WON
          </span>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        <span
          className={`rounded-lg px-2 py-1 font-bold ${
            position.outcome === "yes"
              ? "bg-green-500/15 text-green-400"
              : "bg-red-500/15 text-red-400"
          }`}
        >
          {position.outcome.toUpperCase()}
        </span>
        <span className="text-gray-500">
          {position.shares} shares @ {position.avgPrice.toFixed(2)}
        </span>
        <span className="text-gray-400 font-medium">
          {formatSol(lamportsToSol(position.currentValue))}
        </span>
        <span
          className={`font-bold ${
            position.pnl >= 0 ? "text-green-400" : "text-red-400"
          }`}
        >
          {position.pnl >= 0 ? "+" : ""}
          {formatSol(lamportsToSol(position.pnl))}
        </span>
      </div>
      {onClaim && (
        <button
          onClick={onClaim}
          className="mt-3 w-full rounded-xl bg-gradient-primary py-2.5 text-sm font-bold text-white transition-all active:scale-95"
        >
          Claim Winnings
        </button>
      )}
    </div>
  );
}
