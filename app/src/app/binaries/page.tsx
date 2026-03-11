"use client";

import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { CryptoAsset, CRYPTO_ASSETS } from "@/types";
import { useBinaryRounds } from "@/hooks/useBinaryRounds";
import BinaryRoundCard from "@/components/BinaryRoundCard";

const ASSET_TABS: CryptoAsset[] = ["BTC", "ETH", "SOL"];

export default function BinariesPage() {
  const { connected } = useWallet();
  const { rounds, placeBet, livePrices } = useBinaryRounds();
  const [activeAsset, setActiveAsset] = useState<CryptoAsset | "all">("all");

  const handleBet = (asset: CryptoAsset, side: "up" | "down", amount: number) => {
    if (!connected) {
      alert("Connect your wallet to place bets.");
      return;
    }
    placeBet(asset, side, amount);
    // In production: call Solana program to escrow funds
    console.log(`Bet placed: ${amount} SOL on ${side} for ${asset}`);
  };

  const visibleAssets =
    activeAsset === "all"
      ? ASSET_TABS
      : [activeAsset as CryptoAsset];

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-24 sm:max-w-5xl sm:px-6 md:pb-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 animate-fade-up">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Binaries</h1>
          <span className="rounded-full bg-green-500/15 px-2.5 py-1 text-[10px] font-bold uppercase text-green-400">
            Live
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-400">
          Platform-controlled 5-minute binary rounds. Bet UP or DOWN on crypto prices. Resolved automatically by Pyth Oracle.
        </p>
      </div>

      {/* Asset filter tabs */}
      <div className="mb-5 flex gap-2 animate-fade-up" style={{ animationDelay: "60ms" }}>
        <button
          onClick={() => setActiveAsset("all")}
          className={`rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95 ${
            activeAsset === "all"
              ? "bg-white text-black shadow-lg"
              : "bg-white/10 text-white/70 hover:bg-white/20"
          }`}
        >
          All Markets
        </button>
        {ASSET_TABS.map((asset) => {
          const meta = CRYPTO_ASSETS.find((a) => a.value === asset)!;
          return (
            <button
              key={asset}
              onClick={() => setActiveAsset(asset)}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95 ${
                activeAsset === asset
                  ? "bg-white text-black shadow-lg"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {meta.icon}
            </button>
          );
        })}
      </div>

      {/* How it works */}
      <div className="mb-5 rounded-2xl border border-surface-50/50 bg-surface-300 p-4 animate-fade-up" style={{ animationDelay: "90ms" }}>
        <div className="flex items-center gap-2 mb-2">
          <svg className="h-4 w-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs font-bold text-white">How it works</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { step: "1", title: "Pick a side", desc: "Bet UP or DOWN on the price" },
            { step: "2", title: "Wait", desc: "5-minute round with live tracking" },
            { step: "3", title: "Auto-resolve", desc: "Pyth Oracle determines outcome" },
            { step: "4", title: "Win", desc: "Winnings sent to your wallet" },
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

      {/* Round cards */}
      <div className={`grid gap-5 animate-fade-up ${activeAsset === "all" ? "sm:grid-cols-2 lg:grid-cols-3" : "max-w-lg mx-auto"}`} style={{ animationDelay: "120ms" }}>
        {visibleAssets.map((asset) => {
          const round = rounds[asset];
          if (!round) {
            return (
              <div key={asset} className="rounded-2xl border border-surface-50/50 bg-surface-300 p-8 text-center">
                <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
                <p className="text-xs text-gray-500">Loading {asset}...</p>
              </div>
            );
          }
          return (
            <BinaryRoundCard
              key={`${asset}-${round.roundNumber}`}
              round={round}
              livePrice={livePrices[asset]}
              onBet={(side, amount) => handleBet(asset, side, amount)}
            />
          );
        })}
      </div>

      {/* Stats footer */}
      <div className="mt-6 grid grid-cols-3 gap-3 animate-fade-up" style={{ animationDelay: "180ms" }}>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-4 text-center">
          <p className="text-[10px] font-semibold uppercase text-gray-500">Platform Fee</p>
          <p className="mt-1 text-lg font-bold text-yellow-400">2%</p>
        </div>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-4 text-center">
          <p className="text-[10px] font-semibold uppercase text-gray-500">Round Duration</p>
          <p className="mt-1 text-lg font-bold text-white">5 min</p>
        </div>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-4 text-center">
          <p className="text-[10px] font-semibold uppercase text-gray-500">Oracle</p>
          <p className="mt-1 text-lg font-bold text-primary-400">Pyth</p>
        </div>
      </div>
    </div>
  );
}
