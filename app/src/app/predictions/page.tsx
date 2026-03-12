"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  LeaderboardCategory,
  LeaderboardTimeframe,
  LeaderboardEntry,
  getLeaderboard,
  generateLiveNotification,
} from "@/lib/leaderboardData";

// ── Category tabs ──

const CATEGORIES: {
  value: LeaderboardCategory;
  label: string;
  icon: string;
}[] = [
  { value: "profit", label: "Profit", icon: "\uD83D\uDCB0" },
  { value: "streak", label: "Streak", icon: "\uD83D\uDD25" },
  { value: "biggestWin", label: "Biggest Win", icon: "\uD83C\uDFAF" },
  { value: "contrarian", label: "Contrarian", icon: "\uD83C\uDFF9" },
  { value: "volume", label: "Volume", icon: "\uD83D\uDC0B" },
];

const TIMEFRAMES: { value: LeaderboardTimeframe; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "allTime", label: "All Time" },
];

// ── Metric renderer per category ──

function MetricValue({
  entry,
  category,
}: {
  entry: LeaderboardEntry;
  category: LeaderboardCategory;
}) {
  switch (category) {
    case "profit":
      return (
        <span className="font-bold text-emerald-400">
          +{entry.profit?.toFixed(2)} SOL
        </span>
      );
    case "streak":
      return (
        <span className="font-bold text-orange-400">
          {entry.winStreak} wins {(entry.winStreak ?? 0) >= 5 && "\uD83D\uDD25"}
        </span>
      );
    case "biggestWin":
      return (
        <div className="flex flex-col items-end text-right">
          <span className="font-bold text-yellow-400">
            {entry.payout?.toFixed(2)} SOL
          </span>
          <span className="text-[10px] text-white/40">
            {entry.betAmount?.toFixed(2)} SOL &rarr; {entry.multiplier?.toFixed(1)}x
          </span>
        </div>
      );
    case "contrarian":
      return (
        <span className="font-bold text-purple-400">
          {entry.contrarianWins} wins
        </span>
      );
    case "volume":
      return (
        <span className="font-bold text-blue-400">
          {entry.volume?.toLocaleString(undefined, {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}{" "}
          SOL
        </span>
      );
  }
}

// ── Main Page ──

export default function LeaderboardPage() {
  const [category, setCategory] = useState<LeaderboardCategory>("profit");
  const [timeframe, setTimeframe] = useState<LeaderboardTimeframe>("allTime");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [tickerItems, setTickerItems] = useState<string[]>([]);
  const tickerRef = useRef<HTMLDivElement>(null);

  // Load entries when category or timeframe changes
  useEffect(() => {
    setEntries(getLeaderboard(category, timeframe));
  }, [category, timeframe]);

  // Seed ticker with initial items, then add new ones periodically
  useEffect(() => {
    // Start with 6 items so the ticker is full
    const initial: string[] = [];
    for (let i = 0; i < 6; i++) {
      initial.push(generateLiveNotification().message);
    }
    setTickerItems(initial);

    const interval = setInterval(() => {
      setTickerItems((prev) => {
        const next = [...prev, generateLiveNotification().message];
        // keep last 12 to avoid unbounded growth
        return next.slice(-12);
      });
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] w-full bg-transparent pb-20">
      {/* NYSE-style dot matrix ticker */}
      <div className="ticker-wrap relative overflow-hidden border-b border-amber-500/20 bg-black">
        <div className="ticker-track flex whitespace-nowrap">
          {/* Duplicate items for seamless looping */}
          {[...tickerItems, ...tickerItems].map((msg, i) => (
            <span
              key={`${i}-${msg.slice(0, 12)}`}
              className="ticker-item inline-flex items-center gap-3 px-6 py-2 font-mono text-xs tracking-wide text-amber-400"
            >
              <span className="text-amber-500/60">{"\u25C6"}</span>
              <span>{msg.toUpperCase()}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="px-4 pt-6 pb-2 sm:px-6">
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          Leaderboard
        </h1>
        <p className="mt-1 text-sm text-white/40">
          See who&apos;s winning on Profitic
        </p>
      </div>

      {/* Category tabs */}
      <div className="feed-scroll flex gap-2 overflow-x-auto px-4 py-3 sm:px-6">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`shrink-0 flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95 ${
              category === cat.value
                ? "bg-white text-black shadow-lg"
                : "bg-white/10 text-white/70 hover:bg-white/20"
            }`}
          >
            <span>{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* Timeframe tabs */}
      <div className="flex gap-1 px-4 pb-4 sm:px-6">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf.value}
            onClick={() => setTimeframe(tf.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              timeframe === tf.value
                ? "bg-primary-500/20 text-primary-300 border border-primary-500/30"
                : "text-white/40 hover:text-white/60"
            }`}
          >
            {tf.label}
          </button>
        ))}
      </div>

      {/* Podium — top 3 */}
      {entries.length >= 3 && (
        <div className="flex items-end justify-center gap-3 px-4 pb-6 sm:gap-5">
          {/* 2nd place */}
          <PodiumCard entry={entries[1]} place={2} category={category} />
          {/* 1st place */}
          <PodiumCard entry={entries[0]} place={1} category={category} />
          {/* 3rd place */}
          <PodiumCard entry={entries[2]} place={3} category={category} />
        </div>
      )}

      {/* Leaderboard list (rank 4+) */}
      <div className="mx-auto max-w-2xl px-4 sm:px-6">
        <div className="stagger-children flex flex-col gap-2">
          {entries.slice(3).map((entry) => (
            <div
              key={entry.wallet}
              className="flex items-center gap-3 rounded-2xl border border-white/5 bg-surface-300/60 px-4 py-3 transition-all hover:border-white/10 hover:bg-surface-200/60"
            >
              {/* Rank */}
              <span className="w-7 shrink-0 text-center text-sm font-bold text-white/30">
                {entry.rank}
              </span>

              {/* Wallet */}
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-mono text-sm text-white/90">
                  {entry.wallet}
                </span>
                {entry.badges.length > 0 && (
                  <div className="mt-0.5 flex gap-1">
                    {entry.badges.map((b) => (
                      <span
                        key={b.label}
                        className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50"
                        title={b.label}
                      >
                        {b.icon} {b.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Metric */}
              <div className="shrink-0 text-sm">
                <MetricValue entry={entry} category={category} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Podium Card ──

function PodiumCard({
  entry,
  place,
  category,
}: {
  entry: LeaderboardEntry;
  place: 1 | 2 | 3;
  category: LeaderboardCategory;
}) {
  const heights = { 1: "h-36", 2: "h-28", 3: "h-24" };
  const sizes = { 1: "w-28 sm:w-32", 2: "w-24 sm:w-28", 3: "w-24 sm:w-28" };
  const medals = { 1: "\uD83E\uDD47", 2: "\uD83E\uDD48", 3: "\uD83E\uDD49" };
  const glows = {
    1: "shadow-yellow-500/20 border-yellow-500/30",
    2: "shadow-gray-400/10 border-gray-400/20",
    3: "shadow-orange-700/10 border-orange-700/20",
  };

  return (
    <div
      className={`flex ${heights[place]} ${sizes[place]} flex-col items-center justify-end`}
    >
      <div
        className={`flex w-full flex-col items-center rounded-2xl border bg-surface-300/80 p-3 shadow-lg backdrop-blur-sm transition-all hover:scale-105 ${glows[place]}`}
      >
        <span className="text-2xl leading-none">{medals[place]}</span>
        <span className="mt-1.5 max-w-full truncate font-mono text-[11px] text-white/80">
          {entry.wallet}
        </span>
        <div className="mt-1 text-xs">
          <MetricValue entry={entry} category={category} />
        </div>
        {entry.badges.length > 0 && (
          <div className="mt-1 flex gap-0.5">
            {entry.badges.map((b) => (
              <span key={b.label} className="text-xs" title={b.label}>
                {b.icon}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
