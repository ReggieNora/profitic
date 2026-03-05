"use client";

import React, { useState, useMemo } from "react";
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

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold sm:text-5xl">
          Predict the <span className="gradient-text">Future</span>
        </h1>
        <p className="mt-3 text-lg text-gray-400">
          Trade on real-world outcomes. Powered by Solana.
        </p>
      </div>

      {/* Search + Filters */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
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
            placeholder="Search markets..."
            className="input-field pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {MARKET_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                filter === f.value
                  ? "bg-primary-600 text-white"
                  : "bg-surface-300 text-gray-400 hover:bg-surface-200 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {error && !loading && markets.length > 0 && (
        <div className="mb-4 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
          Using demo data &mdash; backend API is unavailable.
        </div>
      )}

      {/* Markets Grid */}
      {!loading && (
        <>
          {filteredMarkets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
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
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredMarkets.map((market) => (
                <MarketCard key={market.id} market={market} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
