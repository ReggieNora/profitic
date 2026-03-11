"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Market, CRYPTO_ASSETS, CRYPTO_TIMEFRAMES } from "@/types";
import { getAutoCoverImage } from "@/lib/coverImages";
import { formatSol, lamportsToSol } from "@/lib/bondingCurve";
import CommentSheet from "@/components/CommentSheet";
import BetModal from "@/components/BetModal";

// --- Utilities ---

function useCountdown(resolutionDate: number) {
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    function calc() {
      const now = Date.now() / 1000;
      const diff = resolutionDate - now;
      if (diff <= 0) return "Ended";
      const d = Math.floor(diff / 86400);
      const h = Math.floor((diff % 86400) / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = Math.floor(diff % 60);
      if (d > 0) return `${d}d ${h}h ${m}m`;
      if (h > 0) return `${h}h ${m}m ${s}s`;
      return `${m}m ${s}s`;
    }
    setTimeLeft(calc());
    const interval = setInterval(() => setTimeLeft(calc()), 1000);
    return () => clearInterval(interval);
  }, [resolutionDate]);

  return timeLeft;
}

function shortenAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function getMarketVisual(question: string, id: string): { gradient: string; icon: string; category: string; svg?: string } {
  const q = question.toLowerCase();
  if (q.includes("bitcoin") || q.includes("btc")) {
    return { gradient: "from-orange-600/50 via-amber-900/40 to-surface-500", icon: "BTC", category: "Crypto", svg: "bitcoin" };
  }
  if (q.includes("ethereum") || q.includes("eth")) {
    return { gradient: "from-indigo-600/50 via-purple-900/40 to-surface-500", icon: "ETH", category: "Crypto", svg: "ethereum" };
  }
  if (q.includes("solana") || q.includes("sol")) {
    return { gradient: "from-emerald-600/40 via-teal-900/40 to-surface-500", icon: "SOL", category: "Crypto", svg: "solana" };
  }
  if (q.includes("etf") || q.includes("sec") || q.includes("regulation")) {
    return { gradient: "from-blue-600/40 via-sky-900/30 to-surface-500", icon: "REG", category: "Regulation" };
  }
  if (q.includes("ai") || q.includes("artificial intelligence") || q.includes("gpt") || q.includes("model")) {
    return { gradient: "from-cyan-600/40 via-blue-900/30 to-surface-500", icon: "AI", category: "Tech" };
  }
  if (q.includes("election") || q.includes("president") || q.includes("vote") || q.includes("congress")) {
    return { gradient: "from-red-600/40 via-blue-900/30 to-surface-500", icon: "POL", category: "Politics" };
  }
  if (q.includes("nft") || q.includes("metaverse") || q.includes("gaming")) {
    return { gradient: "from-pink-600/40 via-purple-900/30 to-surface-500", icon: "NFT", category: "Gaming" };
  }
  if (q.includes("fed") || q.includes("rate") || q.includes("inflation") || q.includes("recession")) {
    return { gradient: "from-emerald-700/40 via-green-900/30 to-surface-500", icon: "FIN", category: "Finance" };
  }
  const gradients = [
    "from-purple-900/40 via-blue-900/30 to-surface-500",
    "from-blue-900/40 via-cyan-900/30 to-surface-500",
    "from-indigo-900/40 via-purple-900/30 to-surface-500",
    "from-violet-900/40 via-fuchsia-900/30 to-surface-500",
  ];
  const hash = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return { gradient: gradients[hash % gradients.length], icon: "MKT", category: "Market" };
}

function CryptoBackground({ symbol }: { symbol?: string }) {
  if (!symbol) return null;

  // Official Bitcoin logo
  if (symbol === "bitcoin") {
    return (
      <svg viewBox="0 0 4091.27 4091.73" className="h-full w-full" fill="currentColor">
        <path d="M4030.06 2540.77c-273.24,1096.01 -1383.32,1763.02 -2479.46,1489.71 -1095.68,-273.24 -1## 762.69,-1383.39 -1489.33,-2479.31 273.12,-1096.13 1383.2,-1763.19 2479,-1489.95 1096.06,273.24 1762.78,1383.51 1489.76,2479.57l0.02 -0.02z" opacity="0.15" />
        <path d="M2947.77 1754.38c40.72,-272.26 -166.56,-418.61 -450,-516.24l91.95,-368.8 -224.5,-55.94 -89.51,359.09c-59.02,-14.72 -119.63,-28.59 -179.87,-42.34l90.16,-361.46 -224.36,-55.94 -92,368.68c-48.84,-11.12 -96.81,-22.11 -143.35,-33.69l0.26,-1.16 -309.59,-77.31 -59.72,239.78c0,0 166.56,38.18 163.05,40.53 90.91,22.69 107.35,82.87 104.62,130.57l-104.74,420.15c6.26,1.59 14.38,3.89 23.34,7.49 -7.49,-1.86 -15.46,-3.89 -23.73,-5.87l-146.81,588.57c-11.11,27.62 -39.31,69.07 -102.87,53.33 2.25,3.26 -163.17,-40.72 -163.17,-40.72l-111.46,256.98 292.15,72.83c54.35,13.63 107.61,27.89 160.06,41.3l-92.9,373.03 224.24,55.94 92,-369.07c61.26,16.63 120.71,31.97 178.91,46.43l-91.69,367.33 224.51,55.94 92.89,-372.33c382.82,72.45 670.67,43.24 791.83,-303.02 97.63,-278.78 -4.86,-439.58 -206.26,-544.44 146.69,-33.83 257.18,-130.31 286.64,-329.61l-0.07,-0.05zm-512.93,719.26c-69.38,278.78 -538.76,128.08 -690.94,90.29l123.28,-494.2c152.17,37.99 640.17,113.17 567.67,403.91zm69.43,-723.3c-63.29,253.58 -453.96,124.75 -580.69,93.16l111.77,-448.21c126.73,31.59 534.85,90.55 468.94,355.05l-0.02,0z" opacity="0.6" />
      </svg>
    );
  }

  // Official Ethereum diamond logo
  if (symbol === "ethereum") {
    return (
      <svg viewBox="0 0 784 1277" className="h-full w-full" fill="currentColor">
        <path d="M392.07 0L383.5 29.11 383.5 873.74 392.07 882.29 784.13 650.54z" opacity="0.5" />
        <path d="M392.07 0L0 650.54 392.07 882.29 392.07 472.33z" opacity="0.35" />
        <path d="M392.07 956.52L387.24 962.41 387.24 1263.28 392.07 1277.38 784.37 724.89z" opacity="0.5" />
        <path d="M392.07 1277.38L392.07 956.52 0 724.89z" opacity="0.35" />
        <path d="M392.07 882.29L784.13 650.54 392.07 472.33z" opacity="0.55" />
        <path d="M0 650.54L392.07 882.29 392.07 472.33z" opacity="0.4" />
      </svg>
    );
  }

  // Official Solana logo
  if (symbol === "solana") {
    return (
      <svg viewBox="0 0 397.7 311.7" className="h-full w-full" fill="currentColor">
        <path d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z" opacity="0.5" />
        <path d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z" opacity="0.5" />
        <path d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z" opacity="0.5" />
      </svg>
    );
  }

  return null;
}

function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/))([^&?\s]+)/);
  return m ? m[1] : null;
}

function VideoEmbed({ url }: { url: string }) {
  const ytId = getYouTubeId(url);
  if (ytId) {
    return (
      <div className="mb-6 w-full max-w-sm overflow-hidden rounded-xl shadow-lg">
        <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
          <iframe
            className="absolute inset-0 h-full w-full"
            src={`https://www.youtube.com/embed/${ytId}?rel=0`}
            title="Video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }
  // Fallback: link to video
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mb-6 flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20"
    >
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
      </svg>
      Watch video
    </a>
  );
}

interface FeedCardProps {
  market: Market;
  index: number;
  total: number;
}

export default function FeedCard({ market, index, total }: FeedCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(() => {
    const hash = market.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return 12 + (hash % 200);
  });
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [shared, setShared] = useState(false);
  const [betSide, setBetSide] = useState<"yes" | "no" | null>(null);

  const yesPercent = Math.round(market.yesPrice * 100);
  const noPercent = Math.round(market.noPrice * 100);
  const timeLeft = useCountdown(market.resolutionDate);
  const volume = formatSol(lamportsToSol(market.totalVolume));
  const totalLiquidity = market.yesPool && market.noPool
    ? formatSol(lamportsToSol(market.yesPool + market.noPool))
    : formatSol(lamportsToSol(market.liquidityPool));
  const isHot = lamportsToSol(market.totalVolume) > 30;
  const visual = getMarketVisual(market.question, market.id);
  const coverImage = market.coverImage || getAutoCoverImage(market.question, market.category);

  const [lastTap, setLastTap] = useState(0);
  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTap < 300) {
      if (!liked) {
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 800);
    }
    setLastTap(now);
  }, [lastTap, liked]);

  const handleLike = () => {
    setLiked((prev) => !prev);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
    if (!liked) {
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 800);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: market.question,
          text: `${yesPercent}% chance — ${market.question}`,
          url: `${window.location.origin}/market/${market.id}`,
        });
      } else {
        await navigator.clipboard.writeText(
          `${window.location.origin}/market/${market.id}`
        );
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // User cancelled share
    }
  };

  return (
    <div
      className={`relative flex h-full w-full flex-col bg-gradient-to-b ${visual.gradient}`}
      onClick={handleDoubleTap}
    >
      {/* Background visual elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Cover image background */}
        <img
          src={coverImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/75" />

        {/* Crypto SVG overlay for crypto markets */}
        {visual.svg && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[420px] text-white/[0.08] sm:h-[520px] sm:w-[520px]">
            <CryptoBackground symbol={visual.svg} />
          </div>
        )}
      </div>

      {/* Double-tap heart animation */}
      {showHeartAnim && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <svg
            className="h-28 w-28 text-red-500 animate-heart-pop"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
          </svg>
        </div>
      )}

      {/* Main content area */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 pb-32 pt-16 sm:px-16 sm:pb-36 md:pr-24">
        {/* Category + status badges */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {market.marketType === "crypto_updown" ? (
            <>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-400 backdrop-blur-sm">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                </svg>
                Crypto Up/Down
              </span>
              {market.cryptoAsset && (
                <span className={`rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold backdrop-blur-sm ${CRYPTO_ASSETS.find(a => a.value === market.cryptoAsset)?.color || "text-white/60"}`}>
                  {market.cryptoAsset}
                </span>
              )}
              {market.cryptoTimeframe && (
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-white/50 backdrop-blur-sm">
                  {CRYPTO_TIMEFRAMES.find(t => t.value === market.cryptoTimeframe)?.label || market.cryptoTimeframe}
                </span>
              )}
            </>
          ) : (
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white/60 backdrop-blur-sm">
              {visual.category}
            </span>
          )}
          {isHot && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-500/20 px-3 py-1.5 text-xs font-bold text-orange-400 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-400 animate-pulse" />
              TRENDING
            </span>
          )}
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold backdrop-blur-sm tabular-nums ${
              market.resolved
                ? "bg-gray-500/20 text-gray-400"
                : timeLeft === "Ended"
                ? "bg-yellow-500/20 text-yellow-400"
                : "bg-white/10 text-white/80"
            }`}
          >
            {market.resolved
              ? `Resolved ${market.marketType === "crypto_updown" && market.cryptoSubtype === "up_down" ? (market.outcome === "yes" ? "UP" : "DOWN") : market.outcome.toUpperCase()}`
              : timeLeft === "Ended"
              ? "Awaiting Resolution"
              : timeLeft}
          </span>
        </div>

        {/* Big probability display */}
        <div className="mb-6 flex items-baseline gap-1 tabular-nums">
          <span className="text-7xl font-black text-white sm:text-8xl">
            {yesPercent >= noPercent ? yesPercent : noPercent}
          </span>
          <span className="text-3xl font-bold text-white/50 sm:text-4xl">%</span>
          <span className={`ml-2 text-lg font-semibold sm:text-xl ${yesPercent >= noPercent ? "text-green-400" : "text-red-400"}`}>
            {market.marketType === "crypto_updown" && market.cryptoSubtype === "up_down"
              ? (yesPercent >= noPercent ? "UP" : "DOWN")
              : (yesPercent >= noPercent ? "YES" : "NO")}
          </span>
        </div>

        {/* Animated probability bar */}
        <div className="mb-6 w-full max-w-sm">
          <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/10">
            {yesPercent >= noPercent ? (
              <>
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-green-400 to-green-500 transition-all duration-1000"
                  style={{ width: `${yesPercent}%` }}
                />
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-bar-shimmer"
                  style={{ width: `${yesPercent}%` }}
                />
              </>
            ) : (
              <>
                <div
                  className="absolute right-0 top-0 h-full rounded-full bg-gradient-to-l from-red-400 to-red-500 transition-all duration-1000"
                  style={{ width: `${noPercent}%` }}
                />
                <div
                  className="absolute right-0 top-0 h-full rounded-full bg-gradient-to-l from-transparent via-white/10 to-transparent animate-bar-shimmer"
                  style={{ width: `${noPercent}%` }}
                />
              </>
            )}
          </div>
          <div className="mt-2 flex justify-between text-xs font-medium">
            <span className="text-green-400">{market.marketType === "crypto_updown" && market.cryptoSubtype === "up_down" ? "Up" : "Yes"} {yesPercent}%</span>
            <span className="text-red-400">{market.marketType === "crypto_updown" && market.cryptoSubtype === "up_down" ? "Down" : "No"} {noPercent}%</span>
          </div>
        </div>

        {/* Question */}
        <h2 className="mb-3 max-w-lg text-center text-xl font-bold leading-tight text-white sm:text-2xl">
          {market.question}
        </h2>

        {/* Description */}
        <p className="mb-4 max-w-md text-center text-sm leading-relaxed text-white/50 line-clamp-2">
          {market.description}
        </p>

        {/* Crypto Up/Down price info */}
        {market.marketType === "crypto_updown" && market.startPrice && (
          <div className="mb-6 flex items-center gap-4 rounded-2xl bg-white/5 px-5 py-3 backdrop-blur-sm">
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase text-gray-500">Start</p>
              <p className="text-sm font-bold tabular-nums text-white">
                ${market.startPrice.toLocaleString()}
              </p>
            </div>
            {market.strikePrice && (
              <>
                <svg className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <div className="text-center">
                  <p className="text-[10px] font-semibold uppercase text-amber-500">Target</p>
                  <p className="text-sm font-bold tabular-nums text-amber-400">
                    ${market.strikePrice.toLocaleString()}
                  </p>
                </div>
              </>
            )}
            <div className="ml-auto flex items-center gap-1 rounded-full bg-primary-500/10 px-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary-400" />
              <span className="text-[9px] font-bold text-primary-400">{market.oracleSource || "Pyth"}</span>
            </div>
          </div>
        )}

        {/* Inline video */}
        {market.videoUrl && (
          <VideoEmbed url={market.videoUrl} />
        )}

        {/* Volume indicator */}
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-white/5 px-4 py-2 backdrop-blur-sm">
          <div className="flex items-end gap-0.5">
            {[0.4, 0.7, 0.5, 0.9, 0.6, 0.8, 1.0].map((h, i) => (
              <div
                key={i}
                className="w-1 rounded-full bg-primary-500/60 animate-volume-bar"
                style={{
                  height: `${h * 16}px`,
                  animationDelay: `${i * 150}ms`,
                }}
              />
            ))}
          </div>
          <span className="text-xs font-semibold text-white/60">
            {volume} vol
          </span>
          <span className="text-[10px] text-white/30">|</span>
          <span className="text-xs font-semibold text-white/60">
            {totalLiquidity} liq
          </span>
          <span className="text-[10px] text-white/30">|</span>
          <span className="text-[10px] text-white/30">
            2% fee
          </span>
        </div>

        {/* YES / NO (or UP / DOWN) action buttons */}
        <div className="flex w-full max-w-sm gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); setBetSide("yes"); }}
            className="flex-1 rounded-2xl bg-green-500 py-4 text-center text-lg font-black uppercase tracking-wide text-white shadow-lg shadow-green-500/25 transition-all duration-200 hover:bg-green-400 hover:shadow-xl hover:shadow-green-500/30 active:scale-95"
          >
            {market.marketType === "crypto_updown" && market.cryptoSubtype === "up_down" ? (
              <span className="flex items-center justify-center gap-1.5">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                </svg>
                UP
              </span>
            ) : "YES"}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setBetSide("no"); }}
            className="flex-1 rounded-2xl bg-red-500 py-4 text-center text-lg font-black uppercase tracking-wide text-white shadow-lg shadow-red-500/25 transition-all duration-200 hover:bg-red-400 hover:shadow-xl hover:shadow-red-500/30 active:scale-95"
          >
            {market.marketType === "crypto_updown" && market.cryptoSubtype === "up_down" ? (
              <span className="flex items-center justify-center gap-1.5">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                </svg>
                DOWN
              </span>
            ) : "NO"}
          </button>
        </div>
      </div>

      {/* Right side action bar (TikTok-style) */}
      <div className="absolute bottom-36 right-3 z-20 flex flex-col items-center gap-5 sm:right-5">
        {/* Creator avatar */}
        <Link
          href={`/profile/${market.creator}`}
          onClick={(e) => e.stopPropagation()}
          className="relative"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary ring-2 ring-surface-500 transition-transform active:scale-90">
            <span className="text-xs font-bold text-white">
              {market.creator.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="absolute -bottom-1 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-primary-500 text-white">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
        </Link>

        {/* Heart/Favorite */}
        <button
          onClick={(e) => { e.stopPropagation(); handleLike(); }}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 ${
            liked ? "bg-red-500/20" : "bg-white/10 backdrop-blur-sm"
          }`}>
            <svg
              className={`h-6 w-6 transition-all duration-200 ${
                liked ? "text-red-500 scale-110" : "text-white"
              }`}
              viewBox="0 0 24 24"
              fill={liked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={liked ? 0 : 1.5}
            >
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
            </svg>
          </div>
          <span className={`text-[10px] font-bold ${liked ? "text-red-400" : "text-white"}`}>
            {likeCount}
          </span>
        </button>

        {/* Comments */}
        <button
          onClick={(e) => { e.stopPropagation(); setShowComments(true); }}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-white">Chat</span>
        </button>

        {/* Share */}
        <button
          onClick={(e) => { e.stopPropagation(); handleShare(); }}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-sm transition-all ${
            shared ? "bg-green-500/20" : "bg-white/10"
          }`}>
            {shared ? (
              <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            ) : (
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
            )}
          </div>
          <span className={`text-[10px] font-bold ${shared ? "text-green-400" : "text-white"}`}>
            {shared ? "Copied" : "Share"}
          </span>
        </button>

        {/* Stake / Trade button */}
        <Link
          href={`/market/${market.id}`}
          onClick={(e) => e.stopPropagation()}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary shadow-lg shadow-primary-500/20">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-white">Trade</span>
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
          Vol: {volume} &middot; Liq: {totalLiquidity} &middot; {(market.yesShares + market.noShares).toLocaleString()} shares
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

      {/* Comment bottom sheet */}
      <CommentSheet
        marketId={market.id}
        open={showComments}
        onClose={() => setShowComments(false)}
      />

      {/* Bet modal */}
      {betSide && (
        <BetModal
          market={market}
          side={betSide}
          open={true}
          onClose={() => setBetSide(null)}
        />
      )}
    </div>
  );
}
