"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useBinaryMarkets, BinaryMarket } from "@/hooks/useBinaryMarkets";
import BinaryFeedCard from "@/components/BinaryFeedCard";
import BinaryDetailModal from "@/components/BinaryDetailModal";
import BinaryChatPanel from "@/components/BinaryChatPanel";
import RoundHistoryPanel from "@/components/RoundHistoryPanel";

const DEFAULT_INTERVAL = 300; // 5 min default

export default function HomePage() {
  const { connected } = useWallet();
  const { markets, livePrices, placeBet, roundHistory, loading } = useBinaryMarkets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedMarket, setExpandedMarket] = useState<BinaryMarket | null>(null);
  const [chatMarket, setChatMarket] = useState<BinaryMarket | null>(null);
  const [historyMarket, setHistoryMarket] = useState<BinaryMarket | null>(null);
  // Track selected interval per asset symbol
  const [selectedIntervals, setSelectedIntervals] = useState<Record<string, number>>({});
  const feedRef = useRef<HTMLDivElement>(null);

  // Group markets by asset symbol
  const assetGroups = useMemo(() => {
    const groups: Record<string, BinaryMarket[]> = {};
    for (const m of markets) {
      if (!groups[m.asset.symbol]) groups[m.asset.symbol] = [];
      groups[m.asset.symbol].push(m);
    }
    return groups;
  }, [markets]);

  // One visible market per asset: pick the selected interval (or default)
  const feedMarkets = useMemo(() => {
    const result: BinaryMarket[] = [];
    const seen = new Set<string>();
    // Preserve original ordering by iterating markets in order
    for (const m of markets) {
      if (seen.has(m.asset.symbol)) continue;
      seen.add(m.asset.symbol);
      const group = assetGroups[m.asset.symbol] || [];
      const preferred = selectedIntervals[m.asset.symbol] ?? DEFAULT_INTERVAL;
      const match = group.find((g) => g.interval === preferred) || group[0];
      if (match) result.push(match);
    }
    return result;
  }, [markets, assetGroups, selectedIntervals]);

  const handleBet = (marketId: string, side: "up" | "down", amount: number) => {
    if (!connected) {
      alert("Connect your wallet to place bets.");
      return;
    }
    placeBet(marketId, side, amount);
  };

  const handleIntervalChange = useCallback((symbol: string, interval: number) => {
    setSelectedIntervals((prev) => ({ ...prev, [symbol]: interval }));
  }, []);

  // Track which card is in view
  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const container = feedRef.current;
    const scrollTop = container.scrollTop;
    const cardHeight = container.clientHeight;
    const index = Math.round(scrollTop / cardHeight);
    setCurrentIndex(Math.min(index, Math.max(0, feedMarkets.length - 1)));
  }, [feedMarkets.length]);

  useEffect(() => {
    const container = feedRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const allLoaded = !loading && feedMarkets.length > 0;

  return (
    <div className="relative -mt-14 h-screen w-full overflow-hidden bg-black">
      {/* Loading state */}
      {!allLoaded && (
        <div className="flex h-full items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
            <p className="text-sm text-white/40">Loading markets...</p>
          </div>
        </div>
      )}

      {/* Full-screen vertical snap feed */}
      {allLoaded && (
        <div
          ref={feedRef}
          className="feed-scroll h-full snap-y snap-mandatory overflow-y-scroll"
        >
          {feedMarkets.map((market, i) => (
            <div
              key={market.asset.symbol}
              className="h-full w-full snap-start snap-always"
            >
              <BinaryFeedCard
                market={market}
                livePrice={livePrices[market.asset.symbol] || 0}
                onBet={(side, amount) => handleBet(market.id, side, amount)}
                onTrade={() => setExpandedMarket(market)}
                onChat={() => setChatMarket(market)}
                onRoundHistory={() => setHistoryMarket(market)}
                isActive={i === currentIndex}
                completedRounds={(roundHistory[`${market.asset.symbol}-${market.interval}`] || []).length}
                availableIntervals={market.asset.intervals}
                activeInterval={selectedIntervals[market.asset.symbol] ?? DEFAULT_INTERVAL}
                onIntervalChange={(interval) => handleIntervalChange(market.asset.symbol, interval)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Dot indicators */}
      {allLoaded && (
        <div className="absolute right-4 top-1/2 z-20 -translate-y-1/2 flex flex-col gap-2">
          {feedMarkets.map((market, i) => (
            <button
              key={market.asset.symbol}
              onClick={() => {
                feedRef.current?.scrollTo({
                  top: i * (feedRef.current?.clientHeight || 0),
                  behavior: "smooth",
                });
              }}
              className={`h-2.5 w-2.5 rounded-full transition-all ${
                i === currentIndex
                  ? "bg-white scale-125"
                  : "bg-white/30 hover:bg-white/50"
              }`}
              title={market.asset.symbol}
            />
          ))}
        </div>
      )}

      {/* Swipe hint on first load */}
      {allLoaded && currentIndex === 0 && (
        <div className="absolute bottom-24 left-1/2 z-20 -translate-x-1/2 animate-bounce opacity-40 md:hidden">
          <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      )}

      {/* Desktop nav arrows */}
      {allLoaded && feedMarkets.length > 1 && (
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
              if (!feedRef.current || currentIndex >= markets.length - 1) return;
              feedRef.current.scrollTo({
                top: (currentIndex + 1) * feedRef.current.clientHeight,
                behavior: "smooth",
              });
            }}
            disabled={currentIndex >= feedMarkets.length - 1}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 disabled:opacity-30"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      {/* Trade detail modal */}
      {expandedMarket && (
        <BinaryDetailModal
          market={expandedMarket}
          livePrice={livePrices[expandedMarket.asset.symbol] || 0}
          onBet={(side, amount) => handleBet(expandedMarket.id, side, amount)}
          onClose={() => setExpandedMarket(null)}
        />
      )}

      {/* Chat panel */}
      {chatMarket && (
        <BinaryChatPanel
          market={chatMarket}
          onClose={() => setChatMarket(null)}
        />
      )}

      {/* Round history panel */}
      {historyMarket && (
        <RoundHistoryPanel
          rounds={roundHistory[`${historyMarket.asset.symbol}-${historyMarket.interval}`] || []}
          currentRound={historyMarket.roundNumber}
          assetSymbol={historyMarket.asset.symbol}
          assetName={historyMarket.asset.name}
          assetType={historyMarket.asset.type}
          coingeckoId={historyMarket.asset.coingeckoId}
          interval={historyMarket.interval}
          availableIntervals={historyMarket.asset.intervals}
          activeInterval={selectedIntervals[historyMarket.asset.symbol] ?? DEFAULT_INTERVAL}
          onIntervalChange={(iv) => {
            handleIntervalChange(historyMarket.asset.symbol, iv);
            setHistoryMarket(null);
          }}
          onClose={() => setHistoryMarket(null)}
        />
      )}
    </div>
  );
}
