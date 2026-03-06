"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Market } from "@/types";
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

  if (!connected) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center animate-fade-up">
        <h1 className="mb-3 text-2xl font-bold text-white">Admin Panel</h1>
        <p className="mb-6 text-sm text-gray-400">
          Connect an admin wallet to manage resolutions.
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center animate-fade-up">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
          <svg
            className="h-7 w-7 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-bold text-white">Access Denied</h1>
        <p className="text-sm text-gray-400">
          This wallet doesn&apos;t have admin privileges.
        </p>
        <p className="mt-2 font-mono text-[11px] text-gray-600">
          {publicKey?.toBase58()}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:max-w-5xl sm:px-6 lg:px-8">
      <div className="mb-6 animate-fade-up">
        <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
        <p className="mt-1 text-sm text-gray-400">
          Manage markets pending resolution.
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-48" />
          <div className="skeleton h-48" />
        </div>
      ) : markets.length === 0 ? (
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 py-12 text-center animate-fade-up">
          <p className="text-sm font-medium text-gray-400">No markets pending resolution</p>
          <p className="mt-1 text-xs text-gray-500">
            Markets appear here after their resolution date.
          </p>
        </div>
      ) : (
        <div className="space-y-5 stagger-children">
          {markets.map((market) => {
            const form = resolveForm[market.id] || {
              outcome: "yes",
              evidenceUrl: "",
            };
            const isCurrentResolving = resolving === market.id;

            return (
              <div key={market.id} className="rounded-2xl border border-surface-50/50 bg-surface-300 p-5 space-y-4">
                {/* Market Info */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-yellow-500/15 px-2.5 py-1 text-[11px] font-bold text-yellow-400">
                      Pending
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Ended{" "}
                      {new Date(
                        market.resolutionDate * 1000
                      ).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {market.question}
                  </h3>
                  <p className="mt-1 text-xs text-gray-400 leading-relaxed">
                    {market.description}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-[11px] text-gray-500">YES</p>
                    <p className="text-sm font-bold text-green-400">
                      {formatProbability(market.yesPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500">NO</p>
                    <p className="text-sm font-bold text-red-400">
                      {formatProbability(market.noPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500">Volume</p>
                    <p className="text-sm font-bold text-white">
                      {formatSol(lamportsToSol(market.totalVolume))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500">Source</p>
                    <a
                      href={market.dataSourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent-400 hover:underline"
                    >
                      View
                    </a>
                  </div>
                </div>

                {/* Resolution Form */}
                <div className="rounded-xl bg-surface-400/80 p-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Resolve
                  </h4>
                  <div className="flex gap-2">
                    {(["yes", "no", "invalid"] as const).map((o) => (
                      <button
                        key={o}
                        onClick={() =>
                          updateResolveForm(market.id, "outcome", o)
                        }
                        className={`rounded-xl px-4 py-2 text-xs font-bold capitalize transition-all active:scale-95 ${
                          form.outcome === o
                            ? o === "yes"
                              ? "bg-green-500/15 text-green-400 ring-1 ring-green-500/30"
                              : o === "no"
                              ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
                              : "bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30"
                            : "bg-surface-300 text-gray-400 hover:text-white"
                        }`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
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
                    placeholder="Evidence URL..."
                    className="input-field text-sm"
                  />
                  <button
                    onClick={() => handleResolve(market.id)}
                    disabled={isCurrentResolving || !form.evidenceUrl.trim()}
                    className="btn-primary w-full"
                  >
                    {isCurrentResolving
                      ? "Resolving..."
                      : `Resolve ${form.outcome.toUpperCase()}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
