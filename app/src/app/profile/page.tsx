"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Position, Market } from "@/types";
import { formatSol, lamportsToSol, formatProbability } from "@/lib/bondingCurve";

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
      // In production, fetch from API: GET /api/positions?wallet=...
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
    // In production, call the claimWinnings instruction
    alert(
      `Claiming winnings for market ${marketId}.\n\nIn production, this sends a claimWinnings transaction.`
    );
  };

  if (!connected) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <svg
          className="mx-auto mb-4 h-16 w-16 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        <h1 className="mb-2 text-2xl font-bold text-white">Your Profile</h1>
        <p className="mb-6 text-gray-400">
          Connect your wallet to view your positions and winnings.
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Profile</h1>
        <p className="mt-1 font-mono text-sm text-gray-500">
          {publicKey?.toBase58()}
        </p>
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="card text-center">
          <p className="text-sm text-gray-400">Total Value</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {formatSol(lamportsToSol(totalValue))}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-400">Total PnL</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              totalPnl >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {totalPnl >= 0 ? "+" : ""}
            {formatSol(lamportsToSol(totalPnl))}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-400">Claimable</p>
          <p className="mt-1 text-2xl font-bold text-primary-400">
            {formatSol(lamportsToSol(claimableValue))}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-lg bg-surface-400 p-1">
        {(
          [
            { key: "active", label: "Active Positions", count: activePositions.length },
            { key: "claimable", label: "Claimable", count: claimablePositions.length },
            { key: "history", label: "History", count: historyPositions.length },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "bg-surface-200 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary-600/30 text-xs text-primary-300">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : (
        <div className="space-y-4">
          {tab === "active" &&
            (activePositions.length === 0 ? (
              <div className="card py-12 text-center text-gray-500">
                <p className="text-lg font-medium">No active positions</p>
                <p className="mt-1 text-sm">
                  Start trading on the{" "}
                  <Link href="/" className="text-primary-400 hover:underline">
                    home page
                  </Link>
                  .
                </p>
              </div>
            ) : (
              activePositions.map((pos) => (
                <PositionCard key={pos.marketId} position={pos} />
              ))
            ))}

          {tab === "claimable" &&
            (claimablePositions.length === 0 ? (
              <div className="card py-12 text-center text-gray-500">
                <p className="text-lg font-medium">No claimable winnings</p>
                <p className="mt-1 text-sm">
                  Winnings appear here after a market you bet on is resolved.
                </p>
              </div>
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
              <div className="card py-12 text-center text-gray-500">
                <p className="text-lg font-medium">No history yet</p>
              </div>
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

function PositionCard({
  position,
  onClaim,
}: {
  position: Position;
  onClaim?: () => void;
}) {
  return (
    <div className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex-1">
        <Link
          href={`/market/${position.marketId}`}
          className="font-semibold text-white hover:text-primary-300 transition-colors"
        >
          {position.market?.question || position.marketId}
        </Link>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <span
            className={`font-medium ${
              position.outcome === "yes" ? "text-green-400" : "text-red-400"
            }`}
          >
            {position.outcome.toUpperCase()}
          </span>
          <span className="text-gray-400">
            {position.shares} shares @ {position.avgPrice.toFixed(2)}
          </span>
          <span className="text-gray-400">
            Value: {formatSol(lamportsToSol(position.currentValue))}
          </span>
          <span
            className={
              position.pnl >= 0 ? "text-green-400" : "text-red-400"
            }
          >
            {position.pnl >= 0 ? "+" : ""}
            {formatSol(lamportsToSol(position.pnl))}
          </span>
        </div>
      </div>
      {onClaim && (
        <button onClick={onClaim} className="btn-primary whitespace-nowrap">
          Claim Winnings
        </button>
      )}
    </div>
  );
}
