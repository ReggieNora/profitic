"use client";

import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useBinaryMarkets } from "@/hooks/useBinaryMarkets";
import BinaryMarketCard from "@/components/BinaryMarketCard";
import { CryptoLogo } from "@/components/CryptoLogos";

type FilterTab = "all" | "core" | "trending";

export default function BinariesPage() {
  const { connected } = useWallet();
  const { markets, assets, livePrices, placeBet, loading } = useBinaryMarkets();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [assetFilter, setAssetFilter] = useState<string | null>(null);

  const handleBet = async (marketId: string, side: "up" | "down", amount: number) => {
    if (!connected) {
      alert("Connect your wallet to place bets.");
      return;
    }
    await placeBet(marketId, side, amount);
  };

  // Filter markets
  let visible = markets;
  if (filter === "core") visible = visible.filter((m) => m.asset.type === "core");
  if (filter === "trending") visible = visible.filter((m) => m.asset.type === "pumpfun");
  if (assetFilter) visible = visible.filter((m) => m.asset.symbol === assetFilter);

  const coreAssets = assets.filter((a) => a.type === "core");
  const trendingAssets = assets.filter((a) => a.type === "pumpfun");

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-24 sm:max-w-6xl sm:px-6 md:pb-6 lg:px-8">
      {/* Header */}
      <div className="mb-5 animate-fade-up">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Binary Trading</h1>
          <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-[10px] font-bold uppercase text-green-400">
            Live
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-400">
          Fast binary markets on crypto. Pick UP or DOWN, win when the price moves your way. Settled by Pyth Oracle.
        </p>
      </div>

      {/* How it works */}
      <div className="mb-5 rounded-2xl border border-surface-50/50 bg-surface-300 p-4 animate-fade-up" style={{ animationDelay: "60ms" }}>
        <div className="flex items-center gap-2 mb-2">
          <svg className="h-4 w-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-bold text-white">How it works</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { step: "1", title: "Pick a market", desc: "Choose asset & time interval" },
            { step: "2", title: "Go UP or DOWN", desc: "Bet on price direction" },
            { step: "3", title: "Wait for expiry", desc: "Live chart tracks your position" },
            { step: "4", title: "Auto-settle", desc: "Pyth Oracle resolves & pays out" },
          ].map((s) => (
            <div key={s.step} className="text-center">
              <div className="mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary-500/20 text-[10px] font-black text-primary-400">
                {s.step}
              </div>
              <p className="text-[11px] font-bold text-white">{s.title}</p>
              <p className="text-[9px] text-gray-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Connect wallet prompt */}
      {!connected && (
        <div className="mb-5 rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-center animate-fade-up">
          <p className="mb-3 text-sm text-yellow-400">Connect your wallet to place bets</p>
          <WalletMultiButton />
        </div>
      )}

      {/* Filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2 animate-fade-up" style={{ animationDelay: "90ms" }}>
        {/* Type filters */}
        {(["all", "core", "trending"] as FilterTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => { setFilter(tab); setAssetFilter(null); }}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95 ${
              filter === tab && !assetFilter
                ? "bg-white text-black shadow-lg"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            {tab === "all" ? "All Markets" : tab === "core" ? "Core (BTC/ETH/SOL)" : "Trending"}
          </button>
        ))}

        {/* Divider */}
        <div className="mx-1 h-8 w-px bg-white/10" />

        {/* Per-asset quick filters */}
        {coreAssets.map((a) => (
          <button
            key={a.symbol}
            onClick={() => { setAssetFilter(assetFilter === a.symbol ? null : a.symbol); setFilter("all"); }}
            className={`rounded-full px-3 py-2 text-xs font-semibold transition-all active:scale-95 ${
              assetFilter === a.symbol
                ? "bg-white text-black shadow-lg"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            <CryptoLogo asset={a.symbol as "BTC" | "ETH" | "SOL"} size={16} className="inline-block" />
          </button>
        ))}
        {trendingAssets.map((a) => (
          <button
            key={a.symbol}
            onClick={() => { setAssetFilter(assetFilter === a.symbol ? null : a.symbol); setFilter("all"); }}
            className={`rounded-full px-3 py-2 text-xs font-semibold transition-all active:scale-95 ${
              assetFilter === a.symbol
                ? "bg-white text-black shadow-lg"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            {a.logoUrl ? (
              <img src={a.logoUrl} alt={a.symbol} className="inline-block h-4 w-4 rounded-full" />
            ) : (
              <span className="text-[10px]">{a.symbol}</span>
            )}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-400">Discovering markets...</span>
        </div>
      )}

      {/* Market cards grid */}
      {!loading && (
        <>
          {/* Core markets section */}
          {(filter === "all" || filter === "core") && !assetFilter && (
            <div className="mb-6">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/40 animate-fade-up" style={{ animationDelay: "120ms" }}>
                Core Markets
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-fade-up" style={{ animationDelay: "150ms" }}>
                {markets
                  .filter((m) => m.asset.type === "core")
                  .map((m) => (
                    <BinaryMarketCard
                      key={m.id}
                      market={m}
                      livePrice={livePrices[m.asset.symbol] || 0}
                      onBet={(side, amt) => handleBet(m.id, side, amt)}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Trending markets section */}
          {(filter === "all" || filter === "trending") && !assetFilter && (
            <div className="mb-6">
              <div className="mb-3 flex items-center gap-2 animate-fade-up" style={{ animationDelay: "180ms" }}>
                <h2 className="text-sm font-bold uppercase tracking-wider text-white/40">
                  Trending on Pump.fun
                </h2>
                <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[9px] font-bold text-purple-400">
                  3m BINARIES
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 animate-fade-up" style={{ animationDelay: "210ms" }}>
                {markets
                  .filter((m) => m.asset.type === "pumpfun")
                  .map((m) => (
                    <BinaryMarketCard
                      key={m.id}
                      market={m}
                      livePrice={livePrices[m.asset.symbol] || 0}
                      onBet={(side, amt) => handleBet(m.id, side, amt)}
                    />
                  ))}
              </div>
            </div>
          )}

          {/* Filtered by specific asset */}
          {assetFilter && (
            <div className="mb-6">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-white/40">
                {assetFilter} Markets
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {visible.map((m) => (
                  <BinaryMarketCard
                    key={m.id}
                    market={m}
                    livePrice={livePrices[m.asset.symbol] || 0}
                    onBet={(side, amt) => handleBet(m.id, side, amt)}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Stats footer */}
      <div className="mt-6 grid grid-cols-3 gap-3 animate-fade-up" style={{ animationDelay: "240ms" }}>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-4 text-center">
          <p className="text-[10px] font-semibold uppercase text-gray-500">Platform Fee</p>
          <p className="mt-1 text-lg font-bold text-yellow-400">2%</p>
        </div>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-4 text-center">
          <p className="text-[10px] font-semibold uppercase text-gray-500">Active Markets</p>
          <p className="mt-1 text-lg font-bold text-white">{markets.length}</p>
        </div>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-4 text-center">
          <p className="text-[10px] font-semibold uppercase text-gray-500">Oracle</p>
          <p className="mt-1 text-lg font-bold text-primary-400">Pyth</p>
        </div>
      </div>
    </div>
  );
}
