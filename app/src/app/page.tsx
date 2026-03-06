"use client";

import React, { useState, useMemo } from "react";
import Image from "next/image";
import MarketCard from "@/components/MarketCard";
import { useMarkets } from "@/hooks/useMarkets";
import { MARKET_FILTERS } from "@/lib/constants";

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  const { markets, loading, error } = useMarkets({ filter, search });

  const filteredMarkets = useMemo(() => {
    if (!search.trim()) return markets;
    const q = search.toLowerCase();
    return markets.filter(
      (m) =>
        m.question.toLowerCase().includes(q) ||
        m.description.toLowerCase().includes(q)
    );
  }, [markets, search]);

  // First market gets featured treatment
  const featuredMarket = filteredMarkets[0];
  const restMarkets = filteredMarkets.slice(1);

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:max-w-7xl sm:px-6 lg:px-8">
      {/* Hero - compact, punchy */}
      <div className="mb-8 text-center animate-fade-up">
        <Image
          src="/logo.png"
          alt="Profitic"
          width={280}
          height={96}
          className="mx-auto mb-3 h-16 w-auto sm:h-20"
          priority
        />
        <p className="text-sm text-gray-400 sm:text-base">
          Trade on real-world outcomes. Powered by Solana.
        </p>
      </div>

      {/* Search bar - minimal, TikTok-style */}
      <div className="mb-5 animate-fade-up" style={{ animationDelay: "60ms" }}>
        <div className="relative">
          <svg
            className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search predictions..."
            className="w-full rounded-2xl border border-surface-50/50 bg-surface-300/80 py-3 pl-11 pr-4 text-sm text-white placeholder-gray-500 outline-none backdrop-blur-sm transition-all focus:border-primary-500/40 focus:ring-2 focus:ring-primary-500/15"
          />
        </div>
      </div>

      {/* Filter pills - horizontally scrollable on mobile */}
      <div className="mb-6 animate-fade-up" style={{ animationDelay: "120ms" }}>
        <div className="feed-scroll flex gap-2 overflow-x-auto pb-1">
          {MARKET_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 ${
                filter === f.value
                  ? "bg-gradient-primary text-white shadow-md shadow-primary-500/20"
                  : "bg-surface-300 text-gray-400 hover:bg-surface-200 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4">
          <div className="skeleton h-48 w-full" />
          <div className="skeleton h-40 w-full" />
          <div className="skeleton h-40 w-full" />
        </div>
      )}

      {/* Error banner */}
      {error && !loading && markets.length > 0 && (
        <div className="mb-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 px-4 py-3 text-sm text-yellow-400 animate-fade-up">
          Using demo data &mdash; backend API is unavailable.
        </div>
      )}

      {/* Market feed */}
      {!loading && (
        <>
          {filteredMarkets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500 animate-fade-up">
              <svg
                className="mb-4 h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-lg font-medium">No markets found</p>
              <p className="mt-1 text-sm">
                Try adjusting your search or filters.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: vertical feed / Desktop: grid */}
              <div className="stagger-children">
                {/* Featured first card */}
                {featuredMarket && (
                  <div className="mb-4 sm:mb-5">
                    <MarketCard market={featuredMarket} featured />
                  </div>
                )}

                {/* Rest of cards */}
                <div className="space-y-4 sm:grid sm:grid-cols-2 sm:gap-5 sm:space-y-0 lg:grid-cols-3">
                  {restMarkets.map((market) => (
                    <MarketCard key={market.id} market={market} />
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
