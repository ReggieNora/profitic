"use client";

import React from "react";
import Link from "next/link";
import { Market } from "@/types";
import { formatSol, lamportsToSol } from "@/lib/bondingCurve";

function timeRemaining(resolutionDate: number): string {
  const now = Date.now() / 1000;
  const diff = resolutionDate - now;
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor((diff % 3600) / 60)}m`;
}

function shortenAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

// Generate a unique gradient based on market ID for visual variety
function getMarketGradient(id: string): string {
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const gradients = [
    "from-purple-900/40 via-blue-900/30 to-surface-500",
    "from-blue-900/40 via-cyan-900/30 to-surface-500",
    "from-indigo-900/40 via-purple-900/30 to-surface-500",
    "from-violet-900/40 via-fuchsia-900/30 to-surface-500",
    "from-blue-900/40 via-indigo-900/30 to-surface-500",
    "from-cyan-900/40 via-blue-900/30 to-surface-500",
  ];
  return gradients[hash % gradients.length];
}

interface FeedCardProps {
  market: Market;
  index: number;
  total: number;
}

export default function FeedCard({ market, index, total }: FeedCardProps) {
  const yesPercent = Math.round(market.yesPrice * 100);
  const noPercent = Math.round(market.noPrice * 100);
  const timeLeft = timeRemaining(market.resolutionDate);
  const volume = formatSol(lamportsToSol(market.totalVolume));
  const isHot = lamportsToSol(market.totalVolume) > 30;
  const gradient = getMarketGradient(market.id);

  return (
    <div className={`relative flex h-full w-full flex-col bg-gradient-to-b ${gradient}`}>
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-primary-500/5 blur-3xl" />
        <div className="absolute bottom-1/3 right-0 h-48 w-48 rounded-full bg-accent-500/5 blur-3xl" />
      </div>

      {/* Main content area - centered */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-32 pt-16 sm:px-16 sm:pb-36 md:pr-24">
        {/* Status + time badge */}
        <div className="mb-6 flex items-center gap-2">
          {isHot && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/20 px-3 py-1.5 text-xs font-bold text-orange-400 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
              TRENDING
            </span>
          )}
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-sm ${
              market.resolved
                ? "bg-gray-500/20 text-gray-400"
                : timeLeft === "Ended"
                ? "bg-yellow-500/20 text-yellow-400"
                : "bg-white/10 text-white/80"
            }`}
          >
            {market.resolved
              ? `Resolved ${market.outcome.toUpperCase()}`
              : timeLeft === "Ended"
              ? "Awaiting Resolution"
              : `${timeLeft} left`}
          </span>
        </div>

        {/* Big probability display */}
        <div className="mb-8 flex items-baseline gap-1 tabular-nums">
          <span className="text-7xl font-black text-white sm:text-8xl">
            {yesPercent}
          </span>
          <span className="text-3xl font-bold text-white/50 sm:text-4xl">%</span>
          <span className="ml-2 text-lg font-semibold text-green-400 sm:text-xl">YES</span>
        </div>

        {/* Probability bar */}
        <div className="mb-8 w-full max-w-sm">
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-1000"
              style={{ width: `${yesPercent}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs font-medium">
            <span className="text-green-400">Yes {yesPercent}%</span>
            <span className="text-red-400">No {noPercent}%</span>
          </div>
        </div>

        {/* Question */}
        <h2 className="mb-3 max-w-lg text-center text-xl font-bold leading-tight text-white sm:text-2xl">
          {market.question}
        </h2>

        {/* Description */}
        <p className="mb-6 max-w-md text-center text-sm leading-relaxed text-white/50 line-clamp-2">
          {market.description}
        </p>

        {/* YES / NO action buttons */}
        <div className="flex w-full max-w-sm gap-3">
          <Link
            href={`/market/${market.id}?side=yes`}
            className="flex-1 rounded-2xl bg-green-500 py-4 text-center text-lg font-black uppercase tracking-wide text-white shadow-lg shadow-green-500/25 transition-all duration-200 hover:bg-green-400 hover:shadow-xl hover:shadow-green-500/30 active:scale-95"
          >
            YES
          </Link>
          <Link
            href={`/market/${market.id}?side=no`}
            className="flex-1 rounded-2xl bg-red-500 py-4 text-center text-lg font-black uppercase tracking-wide text-white shadow-lg shadow-red-500/25 transition-all duration-200 hover:bg-red-400 hover:shadow-xl hover:shadow-red-500/30 active:scale-95"
          >
            NO
          </Link>
        </div>
      </div>

      {/* Right side action bar (TikTok-style) */}
      <div className="absolute bottom-36 right-3 flex flex-col items-center gap-5 sm:right-5">
        {/* Creator avatar */}
        <div className="relative">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-primary ring-2 ring-surface-500">
            <span className="text-xs font-bold text-white">
              {market.creator.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Volume */}
        <button className="flex flex-col items-center gap-1 transition-transform active:scale-90">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-white">{volume}</span>
        </button>

        {/* Comments */}
        <Link
          href={`/market/${market.id}#comments`}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-white">Chat</span>
        </Link>

        {/* Share */}
        <button className="flex flex-col items-center gap-1 transition-transform active:scale-90">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-white">Share</span>
        </button>

        {/* Details link */}
        <Link
          href={`/market/${market.id}`}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-white">Info</span>
        </Link>
      </div>

      {/* Bottom overlay - creator info */}
      <div className="absolute bottom-20 left-0 right-16 px-5 sm:bottom-24 sm:px-8">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-bold text-white">@{shortenAddress(market.creator)}</span>
          {isHot && (
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/70">
              Popular
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-white/40">
          Vol: {volume} &middot; {market.yesShares + market.noShares} shares traded
        </p>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-white/20 sm:bottom-5">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px]">{index + 1}/{total}</span>
          {index < total - 1 && (
            <svg className="h-4 w-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}
