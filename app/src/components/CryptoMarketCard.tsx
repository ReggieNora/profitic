"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Market, CRYPTO_ASSETS, CRYPTO_TIMEFRAMES } from "@/types";
import { formatSol, lamportsToSol } from "@/lib/bondingCurve";

function useCountdown(resolutionDate: number) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function calc() {
      const now = Date.now() / 1000;
      const diff = resolutionDate - now;
      if (diff <= 0) return "Expired";
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = Math.floor(diff % 60);
      if (h > 0) return `${h}h ${m}m ${s}s`;
      return `${m}m ${s}s`;
    }
    setTimeLeft(calc());
    const interval = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(interval);
  }, [resolutionDate]);

  return timeLeft;
}

interface CryptoMarketCardProps {
  market: Market;
}

export default function CryptoMarketCard({ market }: CryptoMarketCardProps) {
  const timeLeft = useCountdown(market.resolutionDate);
  const isExpired = timeLeft === "Expired";
  const isResolved = market.resolved;
  const volume = formatSol(lamportsToSol(market.totalVolume));
  const yesPercent = Math.round(market.yesPrice * 100);
  const noPercent = Math.round(market.noPrice * 100);

  const asset = CRYPTO_ASSETS.find((a) => a.value === market.cryptoAsset);
  const timeframe = CRYPTO_TIMEFRAMES.find((t) => t.value === market.cryptoTimeframe);
  const isUpDown = market.cryptoSubtype === "up_down";

  const assetColor = asset?.color || "text-gray-400";
  const borderGlow = market.cryptoAsset === "BTC"
    ? "border-orange-500/30 hover:border-orange-500/50"
    : market.cryptoAsset === "ETH"
    ? "border-indigo-500/30 hover:border-indigo-500/50"
    : "border-emerald-500/30 hover:border-emerald-500/50";

  return (
    <Link href={`/market/${market.id}`} className="block">
      <div className={`group relative overflow-hidden rounded-2xl border bg-surface-300 p-5 transition-all duration-300 active:scale-[0.98] hover:shadow-lg ${borderGlow}`}>
        {/* Top row: badges */}
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
            Crypto Up/Down
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${assetColor} bg-white/5`}>
            {market.cryptoAsset}
          </span>
          <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
            {timeframe?.label}
          </span>
        </div>

        {/* Asset + price row */}
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-surface-400 text-lg font-black ${assetColor}`}>
            {asset?.icon || market.cryptoAsset}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-white leading-tight group-hover:text-primary-200 transition-colors">
              {market.question}
            </h3>
            {market.startPrice && (
              <p className="mt-0.5 text-[11px] text-gray-500">
                Start: ${market.startPrice.toLocaleString()}
                {market.strikePrice && ` \u2192 Target: $${market.strikePrice.toLocaleString()}`}
              </p>
            )}
          </div>
        </div>

        {/* Timer + status */}
        <div className="mb-4 flex items-center gap-2">
          {isResolved ? (
            <span className="inline-flex items-center rounded-full bg-gray-500/15 px-2.5 py-1 text-[11px] font-semibold text-gray-400">
              Resolved {isUpDown ? (market.outcome === "yes" ? "UP" : "DOWN") : market.outcome.toUpperCase()}
            </span>
          ) : isExpired ? (
            <span className="inline-flex items-center rounded-full bg-yellow-500/15 px-2.5 py-1 text-[11px] font-semibold text-yellow-400">
              Awaiting Resolution
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1.5 text-[11px] font-semibold tabular-nums text-white/80">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              {timeLeft}
            </span>
          )}
          <span className="ml-auto text-xs font-medium text-gray-500">{volume}</span>
        </div>

        {/* YES/NO (or UP/DOWN) buttons */}
        <div className="relative flex gap-3">
          {/* YES / UP */}
          <button
            onClick={(e) => e.preventDefault()}
            className="group/btn relative flex-1 overflow-hidden rounded-xl border border-green-500/20 bg-green-500/5 p-3 text-center transition-all duration-200 hover:border-green-500/40 hover:bg-green-500/10 active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-green-500/10 to-transparent opacity-0 transition-opacity group-hover/btn:opacity-100" />
            <div className="relative">
              <div className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wider text-green-400/70">
                {isUpDown && (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                  </svg>
                )}
                {isUpDown ? "Up" : "Yes"}
              </div>
              <div className="mt-1 text-2xl font-black tabular-nums text-green-400">
                {yesPercent}
                <span className="text-base font-bold">%</span>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500/10">
              <div
                className="h-full rounded-full bg-green-500/50 transition-all duration-700"
                style={{ width: `${yesPercent}%` }}
              />
            </div>
          </button>

          {/* NO / DOWN */}
          <button
            onClick={(e) => e.preventDefault()}
            className="group/btn relative flex-1 overflow-hidden rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center transition-all duration-200 hover:border-red-500/40 hover:bg-red-500/10 active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-red-500/10 to-transparent opacity-0 transition-opacity group-hover/btn:opacity-100" />
            <div className="relative">
              <div className="flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-wider text-red-400/70">
                {isUpDown && (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                  </svg>
                )}
                {isUpDown ? "Down" : "No"}
              </div>
              <div className="mt-1 text-2xl font-black tabular-nums text-red-400">
                {noPercent}
                <span className="text-base font-bold">%</span>
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-red-500/10">
              <div
                className="h-full rounded-full bg-red-500/50 transition-all duration-700"
                style={{ width: `${noPercent}%` }}
              />
            </div>
          </button>
        </div>

        {/* Bottom: liquidity + oracle info */}
        <div className="mt-3 flex items-center gap-2 text-[10px] text-gray-600">
          <span>Liq: {formatSol(lamportsToSol((market.yesPool || 0) + (market.noPool || 0)))}</span>
          <span>&middot;</span>
          <span>2% fee</span>
          <span>&middot;</span>
          <span className="flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-primary-500" />
            {market.oracleSource || "Pyth"} Oracle
          </span>
        </div>
      </div>
    </Link>
  );
}
