"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { CryptoAsset } from "@/types";
import { useBinaryRounds } from "@/hooks/useBinaryRounds";
import BinaryFeedCard from "@/components/BinaryFeedCard";
import BinaryDetailModal from "@/components/BinaryDetailModal";
import BinaryChatPanel from "@/components/BinaryChatPanel";

// Feed order: BTC 5m → ETH 5m → SOL 5m
const FEED_ORDER: CryptoAsset[] = ["BTC", "ETH", "SOL"];

export default function HomePage() {
  const { connected } = useWallet();
  const { rounds, placeBet, livePrices } = useBinaryRounds();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expandedAsset, setExpandedAsset] = useState<CryptoAsset | null>(null);
  const [chatAsset, setChatAsset] = useState<CryptoAsset | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const handleBet = (asset: CryptoAsset, side: "up" | "down", amount: number) => {
    if (!connected) {
      alert("Connect your wallet to place bets.");
      return;
    }
    placeBet(asset, side, amount);
  };

  // Track which card is in view
  const handleScroll = useCallback(() => {
    if (!feedRef.current) return;
    const container = feedRef.current;
    const scrollTop = container.scrollTop;
    const cardHeight = container.clientHeight;
    const index = Math.round(scrollTop / cardHeight);
    setCurrentIndex(Math.min(index, FEED_ORDER.length - 1));
  }, []);

  useEffect(() => {
    const container = feedRef.current;
    if (!container) return;
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Check if all rounds loaded
  const allLoaded = FEED_ORDER.every((a) => rounds[a]);

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
          {FEED_ORDER.map((asset, i) => {
            const round = rounds[asset];
            if (!round) return null;
            return (
              <div
                key={`${asset}-${round.roundNumber}`}
                className="h-full w-full snap-start snap-always"
              >
                <BinaryFeedCard
                  round={round}
                  livePrice={livePrices[asset]}
                  onBet={(side, amount) => handleBet(asset, side, amount)}
                  onTrade={() => setExpandedAsset(asset)}
                  onChat={() => setChatAsset(asset)}
                  isActive={i === currentIndex}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Dot indicators */}
      {allLoaded && (
        <div className="absolute right-4 top-1/2 z-20 -translate-y-1/2 flex flex-col gap-2">
          {FEED_ORDER.map((asset, i) => (
            <button
              key={asset}
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
              title={asset}
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
      {allLoaded && FEED_ORDER.length > 1 && (
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
              if (!feedRef.current || currentIndex >= FEED_ORDER.length - 1) return;
              feedRef.current.scrollTo({
                top: (currentIndex + 1) * feedRef.current.clientHeight,
                behavior: "smooth",
              });
            }}
            disabled={currentIndex >= FEED_ORDER.length - 1}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-all hover:bg-white/20 disabled:opacity-30"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}

      {/* Trade detail modal */}
      {expandedAsset && rounds[expandedAsset] && (
        <BinaryDetailModal
          round={rounds[expandedAsset]}
          livePrice={livePrices[expandedAsset]}
          onBet={(side, amount) => handleBet(expandedAsset, side, amount)}
          onClose={() => setExpandedAsset(null)}
        />
      )}

      {/* Chat panel */}
      {chatAsset && rounds[chatAsset] && (
        <BinaryChatPanel
          round={rounds[chatAsset]}
          onClose={() => setChatAsset(null)}
        />
      )}
    </div>
  );
}
