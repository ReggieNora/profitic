"use client";

import React from "react";
import Link from "next/link";
import { Market, CRYPTO_ASSETS, CRYPTO_TIMEFRAMES } from "@/types";
import { formatProbability, formatSol, lamportsToSol } from "@/lib/bondingCurve";
import TrendBackground from "./TrendBackground";

function timeRemaining(resolutionDate: number): string {
  const now = Date.now() / 1000;
  const diff = resolutionDate - now;

  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

interface MarketCardProps {
  market: Market;
  featured?: boolean;
}

export default function MarketCard({ market, featured }: MarketCardProps) {
  const [yesFlash, setYesFlash] = React.useState<"up" | "down" | null>(null);
  const [noFlash, setNoFlash] = React.useState<"up" | "down" | null>(null);
  const lastYesRef = React.useRef(market.yesPrice);
  const lastNoRef = React.useRef(market.noPrice);

  React.useEffect(() => {
    if (market.yesPrice !== lastYesRef.current) {
      setYesFlash(market.yesPrice > lastYesRef.current ? "up" : "down");
      lastYesRef.current = market.yesPrice;
      const timer = setTimeout(() => setYesFlash(null), 800);
      return () => clearTimeout(timer);
    }
  }, [market.yesPrice]);

  React.useEffect(() => {
    if (market.noPrice !== lastNoRef.current) {
      setNoFlash(market.noPrice > lastNoRef.current ? "up" : "down");
      lastNoRef.current = market.noPrice;
      const timer = setTimeout(() => setNoFlash(null), 800);
      return () => clearTimeout(timer);
    }
  }, [market.noPrice]);

  const isCrypto = market.marketType === "crypto_updown";
  const isResolved = market.resolved;
  const timeLeft = timeRemaining(market.resolutionDate);
  const volume = formatSol(lamportsToSol(market.totalVolume));
  const yesPercent = Math.round(market.yesPrice * 100);
  const noPercent = Math.round(market.noPrice * 100);
  const isHot = lamportsToSol(market.totalVolume) > 30;
  const isUpDown = market.cryptoSubtype === "up_down";

  const cryptoAsset = CRYPTO_ASSETS.find((a) => a.value === market.cryptoAsset);

  return (
    <Link href={`/market/${market.id}`} className="block">
      <div
        className={`group relative overflow-hidden rounded-2xl border transition-all duration-300 active:scale-[0.98] ${
          featured
            ? "border-primary-500/30 bg-gradient-to-b from-primary-500/10 to-surface-300 p-6"
            : "border-surface-50/50 bg-surface-300 p-5 hover:border-primary-500/20 hover:shadow-lg hover:shadow-primary-500/5"
        }`}
      >
        <TrendBackground price={market.yesPrice} sentiment={yesPercent / 100} />
        {/* Glow effect for featured/hot */}
        {(featured || isHot) && (
          <div className="absolute -top-24 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-primary-500/10 blur-3xl" />
        )}

        {/* Top row: badges */}
        <div className="relative z-10 mb-4 flex items-center gap-2">
          {isCrypto && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
              </svg>
              {market.cryptoAsset}
            </span>
          )}
          {isHot && !isResolved && !isCrypto && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-orange-400">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
              Hot
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              isResolved
                ? "bg-gray-500/15 text-gray-400"
                : timeLeft === "Ended"
                ? "bg-yellow-500/15 text-yellow-400"
                : "bg-green-500/15 text-green-400"
            }`}
          >
            {isResolved
              ? `Resolved ${isCrypto && isUpDown ? (market.outcome === "yes" ? "UP" : "DOWN") : market.outcome.toUpperCase()}`
              : timeLeft === "Ended"
              ? "Awaiting Resolution"
              : `${timeLeft} left`}
          </span>
          <span className="ml-auto text-xs font-medium text-gray-500">
            {volume}
          </span>
        </div>

        {/* Question */}
        <h3
          className={`relative z-10 mb-5 line-clamp-2 font-bold text-white transition-colors group-hover:text-primary-200 ${
            featured ? "text-xl leading-tight" : "text-base leading-snug"
          }`}
        >
          {market.question}
        </h3>

        {/* Quick bet buttons - the main visual element */}
        <div className="relative z-10 flex gap-3">
          {/* YES button */}
          <button
            onClick={(e) => e.preventDefault()}
            className="group/btn relative flex-1 overflow-hidden rounded-xl border border-green-500/20 bg-green-500/5 p-3 text-center transition-all duration-200 hover:border-green-500/40 hover:bg-green-500/10 active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-green-500/10 to-transparent opacity-0 transition-opacity group-hover/btn:opacity-100" />
            <div className="relative">
              <div className="text-xs font-semibold uppercase tracking-wider text-green-400/70">
                {isCrypto && isUpDown ? "Up" : "Yes"}
              </div>
              <div className={`mt-1 text-2xl font-black tabular-nums transition-colors duration-700 ${
                yesFlash === "up" ? "text-green-400" : yesFlash === "down" ? "text-red-400" : "text-white"
              }`}>
                {yesPercent}
                <span className="text-base font-bold">%</span>
              </div>
            </div>
            {/* Probability bar at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-green-500/10">
              <div
                className="h-full rounded-full bg-green-500/50 transition-all duration-700"
                style={{ width: `${yesPercent}%` }}
              />
            </div>
          </button>

          {/* NO button */}
          <button
            onClick={(e) => e.preventDefault()}
            className="group/btn relative flex-1 overflow-hidden rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center transition-all duration-200 hover:border-red-500/40 hover:bg-red-500/10 active:scale-95"
          >
            <div className="absolute inset-0 bg-gradient-to-t from-red-500/10 to-transparent opacity-0 transition-opacity group-hover/btn:opacity-100" />
            <div className="relative">
              <div className="text-xs font-semibold uppercase tracking-wider text-red-400/70">
                {isCrypto && isUpDown ? "Down" : "No"}
              </div>
              <div className={`mt-1 text-2xl font-black tabular-nums transition-colors duration-700 ${
                noFlash === "up" ? "text-green-400" : noFlash === "down" ? "text-red-400" : "text-white"
              }`}>
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
      </div>
    </Link>
  );
}
