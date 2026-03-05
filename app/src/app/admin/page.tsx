"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Market, MarketOutcome } from "@/types";
import { ADMIN_WALLETS, API_URL } from "@/lib/constants";
import { formatProbability, formatSol, lamportsToSol } from "@/lib/bondingCurve";

function getDemoPendingMarkets(): Market[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      id: "pending-1",
      publicKey: "Pend11111111111111111111111111111111111111",
      question: "Will SOL exceed $200 in January 2026?",
      description: "Resolves YES if SOL/USD price exceeds $200 on any major exchange during January 2026.",
      creator: "Creator11111111111111111111111111111111111",
      resolutionDate: now - 86400 * 2,
      dataSourceUrl: "https://www.coingecko.com/en/coins/solana",
      outcome: "unresolved",
      yesShares: 20000,
      noShares: 5000,
      totalVolume: 60_000_000_000,
      liquidityPool: 30_000_000_000,
      yesPrice: 0.8,
      noPrice: 0.2,
      resolved: false,
      createdAt: now - 86400 * 35,
    },
    {
      id: "pending-2",
      publicKey: "Pend22222222222222222222222222222222222222",
      question: "Will Firedancer go live on Solana mainnet by March 2026?",
      description: "Resolves YES if the Firedancer validator client is deployed to Solana mainnet before March 31, 2026.",
      creator: "Creator22222222222222222222222222222222222",
      resolutionDate: now - 86400,
      dataSourceUrl: "https://jumpcrypto.com/firedancer/",
      outcome: "unresolved",
      yesShares: 10000,
      noShares: 15000,
      totalVolume: 40_000_000_000,
      liquidityPool: 20_000_000_000,
      yesPrice: 0.4,
      noPrice: 0.6,
      resolved: false,
      createdAt: now - 86400 * 20,
    },
  ];
}

export default function AdminPage() {
  const { connected, publicKey } = useWallet();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolveForm, setResolveForm] = useState<{
    [marketId: string]: { outcome: "yes" | "no" | "invalid"; evidenceUrl: string };
  }>({});

  const isAdmin =
    connected && publicKey && ADMIN_WALLETS.includes(publicKey.toBase58());

  useEffect(() => {
    if (isAdmin) {
      setLoading(true);
      // In production: GET /api/admin/markets/pending
      setTimeout(() => {
        setMarkets(getDemoPendingMarkets());
        setLoading(false);
      }, 500);
    }
  }, [isAdmin]);

  const handleResolve = async (marketId: string) => {
    const form = resolveForm[marketId];
    if (!form || !form.evidenceUrl.trim()) {
      alert("Please provide an evidence URL.");
      return;
    }

    setResolving(marketId);
    try {
      // In production, call the resolveMarket Anchor instruction
      console.log("Resolving market:", {
        marketId,
        outcome: form.outcome,
        evidenceUrl: form.evidenceUrl,
        resolver: publicKey?.toBase58(),
      });

      alert(
        `Market resolved as ${form.outcome.toUpperCase()}.\n\nIn production, this sends a resolveMarket transaction.`
      );

      setMarkets((prev) => prev.filter((m) => m.id !== marketId));
    } catch (err) {
      console.error("Failed to resolve market:", err);
      alert("Failed to resolve market. Please try again.");
    } finally {
      setResolving(null);
    }
  };

  const updateResolveForm = (
    marketId: string,
    field: string,
    value: string
  ) => {
    setResolveForm((prev) => ({
      ...prev,
      [marketId]: {
        outcome: "yes",
        evidenceUrl: "",
        ...prev[marketId],
        [field]: value,
      },
    }));
  };

  // Not connected
  if (!connected) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <h1 className="mb-4 text-2xl font-bold text-white">Admin Panel</h1>
        <p className="mb-6 text-gray-400">
          Connect an admin wallet to manage market resolutions.
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  // Not admin
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <svg
          className="mx-auto mb-4 h-16 w-16 text-red-500/50"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <h1 className="mb-2 text-2xl font-bold text-white">Access Denied</h1>
        <p className="text-gray-400">
          The connected wallet does not have admin privileges.
        </p>
        <p className="mt-2 font-mono text-xs text-gray-600">
          {publicKey?.toBase58()}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
        <p className="mt-1 text-gray-400">
          Manage markets pending resolution.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : markets.length === 0 ? (
        <div className="card py-12 text-center text-gray-500">
          <p className="text-lg font-medium">No markets pending resolution</p>
          <p className="mt-1 text-sm">
            Markets will appear here after their resolution date has passed.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {markets.map((market) => {
            const form = resolveForm[market.id] || {
              outcome: "yes",
              evidenceUrl: "",
            };
            const isCurrentResolving = resolving === market.id;

            return (
              <div key={market.id} className="card space-y-4">
                {/* Market Info */}
                <div>
                  <div className="mb-2 flex items-center gap-3">
                    <span className="rounded-full bg-yellow-500/20 px-3 py-0.5 text-xs font-medium text-yellow-400">
                      Pending Resolution
                    </span>
                    <span className="text-xs text-gray-500">
                      Ended{" "}
                      {new Date(
                        market.resolutionDate * 1000
                      ).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-white">
                    {market.question}
                  </h3>
                  <p className="mt-1 text-sm text-gray-400">
                    {market.description}
                  </p>
                </div>

                {/* Market Stats */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xs text-gray-500">YES Price</p>
                    <p className="font-semibold text-green-400">
                      {formatProbability(market.yesPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">NO Price</p>
                    <p className="font-semibold text-red-400">
                      {formatProbability(market.noPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Volume</p>
                    <p className="font-semibold text-white">
                      {formatSol(lamportsToSol(market.totalVolume))}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Data Source</p>
                    <a
                      href={market.dataSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-accent-400 hover:underline"
                    >
                      View Source
                    </a>
                  </div>
                </div>

                {/* Resolution Form */}
                <div className="rounded-lg border border-surface-50 bg-surface-400 p-4">
                  <h4 className="mb-3 text-sm font-semibold text-gray-300">
                    Resolve Market
                  </h4>
                  <div className="space-y-3">
                    {/* Outcome Selector */}
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">
                        Outcome
                      </label>
                      <div className="flex gap-2">
                        {(["yes", "no", "invalid"] as const).map((o) => (
                          <button
                            key={o}
                            onClick={() =>
                              updateResolveForm(market.id, "outcome", o)
                            }
                            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-all ${
                              form.outcome === o
                                ? o === "yes"
                                  ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/50"
                                  : o === "no"
                                  ? "bg-red-500/20 text-red-400 ring-1 ring-red-500/50"
                                  : "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/50"
                                : "bg-surface-300 text-gray-400 hover:text-white"
                            }`}
                          >
                            {o}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Evidence URL */}
                    <div>
                      <label className="mb-1 block text-xs text-gray-500">
                        Evidence URL
                      </label>
                      <input
                        type="url"
                        value={form.evidenceUrl}
                        onChange={(e) =>
                          updateResolveForm(
                            market.id,
                            "evidenceUrl",
                            e.target.value
                          )
                        }
                        placeholder="https://..."
                        className="input-field"
                      />
                    </div>

                    {/* Submit */}
                    <button
                      onClick={() => handleResolve(market.id)}
                      disabled={isCurrentResolving || !form.evidenceUrl.trim()}
                      className="btn-primary w-full"
                    >
                      {isCurrentResolving
                        ? "Resolving..."
                        : `Resolve as ${form.outcome.toUpperCase()}`}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
