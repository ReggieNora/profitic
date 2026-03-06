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

export default function ProfilePage() {
  const { connected, publicKey } = useWallet();
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<"active" | "claimable" | "history">("active");

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
  const historyPositions = positions.filter(
    (p) => p.claimed || (p.market?.resolved && !p.claimable)
  );

  const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0);
  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const claimableValue = claimablePositions.reduce(
    (sum, p) => sum + p.currentValue,
    0
  );

  const handleClaim = async (marketId: string) => {
    alert(
      `Claiming winnings for market ${marketId}.\n\nIn production, this sends a claimWinnings transaction.`
    );
  };

  if (!connected) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center animate-fade-up">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-300">
          <svg
            className="h-8 w-8 text-gray-500"
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
        <h1 className="mb-2 text-2xl font-bold text-white">Your Profile</h1>
        <p className="mb-6 text-sm text-gray-400">
          Connect your wallet to view positions and winnings.
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-24 sm:max-w-5xl sm:px-6 md:pb-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 animate-fade-up">
        <h1 className="text-2xl font-bold text-white">Profile</h1>
        <p className="mt-1 font-mono text-xs text-gray-500">
          {publicKey?.toBase58()}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3 animate-fade-up" style={{ animationDelay: "60ms" }}>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-4 text-center">
          <p className="text-[11px] font-medium text-gray-500">Total Value</p>
          <p className="mt-1 text-lg font-bold text-white">
            {formatSol(lamportsToSol(totalValue))}
          </p>
        </div>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-4 text-center">
          <p className="text-[11px] font-medium text-gray-500">PnL</p>
          <p
            className={`mt-1 text-lg font-bold ${
              totalPnl >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {totalPnl >= 0 ? "+" : ""}
            {formatSol(lamportsToSol(totalPnl))}
          </p>
        </div>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-4 text-center">
          <p className="text-[11px] font-medium text-gray-500">Claimable</p>
          <p className="mt-1 text-lg font-bold text-primary-400">
            {formatSol(lamportsToSol(claimableValue))}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl bg-surface-400 p-1 animate-fade-up" style={{ animationDelay: "120ms" }}>
        {(
          [
            { key: "active", label: "Active", count: activePositions.length },
            { key: "claimable", label: "Claimable", count: claimablePositions.length },
            { key: "history", label: "History", count: historyPositions.length },
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
          {tab === "active" &&
            (activePositions.length === 0 ? (
              <EmptyState
                title="No active positions"
                subtitle={
                  <>
                    Start trading on the{" "}
                    <Link href="/" className="text-primary-400 hover:underline">
                      home page
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

          {tab === "claimable" &&
            (claimablePositions.length === 0 ? (
              <EmptyState
                title="No claimable winnings"
                subtitle="Winnings appear here after a market you bet on is resolved."
              />
            ) : (
              claimablePositions.map((pos) => (
                <PositionCard
                  key={pos.marketId}
                  position={pos}
                  onClaim={() => handleClaim(pos.marketId)}
                />
              ))
            ))}

          {tab === "history" &&
            (historyPositions.length === 0 ? (
              <EmptyState title="No history yet" />
            ) : (
              historyPositions.map((pos) => (
                <PositionCard key={pos.marketId} position={pos} />
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
  return (
    <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-4 transition-all duration-200 active:scale-[0.99]">
      <Link
        href={`/market/${position.marketId}`}
        className="block text-sm font-semibold text-white transition-colors hover:text-primary-300"
      >
        {position.market?.question || position.marketId}
      </Link>
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
          {position.shares} @ {position.avgPrice.toFixed(2)}
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
