"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import FeedCard from "@/components/FeedCard";
import { useMarkets } from "@/hooks/useMarkets";
import { MARKET_FILTERS } from "@/lib/constants";

export default function HomePage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [showSearch, setShowSearch] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

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

  // Track which card is currently in view
  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const container = feedRef.current;
    const scrollTop = container.scrollTop;
    const cardHeight = container.clientHeight;
    const index = Math.round(scrollTop / cardHeight);
    setCurrentIndex(index);
  }, []);

  useEffect(() => {
    const container = feedRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div className="relative h-[calc(100vh-3.5rem)] w-full overflow-hidden bg-surface-500 md:h-[calc(100vh-3.5rem)]">
      {/* Search overlay */}
      {showSearch && (
        <div className="absolute inset-x-0 top-0 z-30 bg-surface-500/95 backdrop-blur-xl animate-slide-down">
          <div className="p-4">
            <div className="relative mb-3">
              <svg
                className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search predictions..."
                autoFocus
                className="w-full rounded-2xl border border-surface-50/50 bg-surface-300 py-3 pl-11 pr-12 text-sm text-white placeholder-gray-500 outline-none focus:border-primary-500/40"
              />
              <button
                onClick={() => { setShowSearch(false); setSearch(""); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-gray-400 hover:text-white"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Filter pills */}
            <div className="feed-scroll flex gap-2 overflow-x-auto pb-2">
              {MARKET_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95 ${
                    filter === f.value
                      ? "bg-white text-black"
                      : "bg-white/10 text-white/70 hover:bg-white/20"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Top overlay controls */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-3">
        {/* Filter tabs */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => { setFilter("all"); setSearch(""); }}
            className={`text-sm font-bold transition-all ${
              filter === "all" && !search ? "text-white" : "text-white/50"
            }`}
          >
            For You
          </button>
          <button
            onClick={() => setFilter("active")}
            className={`text-sm font-bold transition-all ${
              filter === "active" ? "text-white" : "text-white/50"
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilter("high_volume")}
            className={`text-sm font-bold transition-all ${
              filter === "high_volume" ? "text-white" : "text-white/50"
            }`}
          >
            Trending
          </button>
        </div>

        {/* Search button */}
        <button
          onClick={() => setShowSearch(true)}
          className="rounded-full p-2 text-white/70 transition-all hover:text-white active:scale-90"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            <p className="text-sm text-white/40">Loading predictions...</p>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && !loading && markets.length > 0 && (
        <div className="absolute left-4 right-4 top-14 z-20 rounded-xl bg-yellow-500/10 px-4 py-2 text-center text-xs text-yellow-400 backdrop-blur-sm">
          Demo mode &mdash; using sample data
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredMarkets.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center text-white/40">
          <svg className="mb-4 h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-semibold">No predictions found</p>
          <p className="mt-1 text-sm text-white/25">Try a different filter</p>
        </div>
      )}

      {/* Full-screen vertical snap feed */}
      {!loading && filteredMarkets.length > 0 && (
        <div
          ref={feedRef}
          className="feed-scroll h-full snap-y snap-mandatory overflow-y-scroll"
        >
          {filteredMarkets.map((market, i) => (
            <div
              key={market.id}
              className="h-full w-full snap-start snap-always"
            >
              <FeedCard
                market={market}
                index={i}
                total={filteredMarkets.length}
              />
            </div>
          ))}
        </div>
      )}

      {/* Navigation arrows (desktop) */}
      {!loading && filteredMarkets.length > 1 && (
        <div className="absolute bottom-8 right-4 z-20 hidden flex-col gap-2 md:flex">
          <button
            onClick={() => {
              if (!feedRef.current || currentIndex === 0) return;
              feedRef.current.scrollTo({
                top: (currentIndex - 1) * feedRef.current.clientHeight,
                behavior: "smooth",
              });
            }}
            disabled={currentIndex === 0}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 disabled:opacity-30"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (!feedRef.current || currentIndex >= filteredMarkets.length - 1) return;
              feedRef.current.scrollTo({
                top: (currentIndex + 1) * feedRef.current.clientHeight,
                behavior: "smooth",
              });
            }}
            disabled={currentIndex >= filteredMarkets.length - 1}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 disabled:opacity-30"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
