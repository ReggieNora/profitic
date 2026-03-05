"use client";

import React from "react";
import Link from "next/link";
import { Market } from "@/types";
import { formatProbability, formatSol, lamportsToSol } from "@/lib/bondingCurve";

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
}

export default function MarketCard({ market }: MarketCardProps) {
  const isResolved = market.resolved;
  const timeLeft = timeRemaining(market.resolutionDate);
  const volume = formatSol(lamportsToSol(market.totalVolume));

  return (
    <Link href={`/market/${market.id}`}>
      <div className="card-hover group cursor-pointer">
        {/* Status Badge */}
        <div className="mb-3 flex items-center justify-between">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              isResolved
                ? "bg-gray-500/20 text-gray-400"
                : timeLeft === "Ended"
                ? "bg-yellow-500/20 text-yellow-400"
                : "bg-green-500/20 text-green-400"
            }`}
          >
            {isResolved
              ? `Resolved: ${market.outcome.toUpperCase()}`
              : timeLeft === "Ended"
              ? "Awaiting Resolution"
              : `${timeLeft} left`}
          </span>
          <span className="text-xs text-gray-500">{volume} vol</span>
        </div>

        {/* Question */}
        <h3 className="mb-4 line-clamp-2 text-base font-semibold text-white group-hover:text-primary-300 transition-colors">
          {market.question}
        </h3>

        {/* Probability Bars */}
        <div className="space-y-2">
          {/* YES */}
          <div className="flex items-center gap-3">
            <span className="w-8 text-xs font-semibold text-green-400">YES</span>
            <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-surface-400">
              <div
                className="absolute inset-y-0 left-0 rounded-lg bg-green-500/20 transition-all duration-500"
                style={{ width: `${market.yesPrice * 100}%` }}
              />
              <div className="relative flex h-full items-center px-3">
                <span className="text-sm font-bold text-green-400">
                  {formatProbability(market.yesPrice)}
                </span>
              </div>
            </div>
          </div>

          {/* NO */}
          <div className="flex items-center gap-3">
            <span className="w-8 text-xs font-semibold text-red-400">NO</span>
            <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-surface-400">
              <div
                className="absolute inset-y-0 left-0 rounded-lg bg-red-500/20 transition-all duration-500"
                style={{ width: `${market.noPrice * 100}%` }}
              />
              <div className="relative flex h-full items-center px-3">
                <span className="text-sm font-bold text-red-400">
                  {formatProbability(market.noPrice)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
