"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart, Area, YAxis,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { BinaryRound, CryptoAsset, CRYPTO_ASSETS } from "@/types";
import { CryptoLogo } from "./CryptoLogos";
import { PricePoint } from "./BinaryRoundCard";

interface BinaryFeedCardProps {
  round: BinaryRound;
  livePrice: number;
  onBet: (side: "up" | "down", amount: number) => void;
  onTrade: () => void;
  isActive: boolean;
}

const QUICK_AMOUNTS = [0.5, 1, 5, 10];

const JITTER_BPS: Record<CryptoAsset, number> = { BTC: 3, ETH: 5, SOL: 8 };
function jitteredPrice(base: number, asset: CryptoAsset): number {
  const bps = JITTER_BPS[asset];
  return base * (1 + (Math.random() - 0.5) * 2 * (bps / 10000));
}

function formatLamports(l: number): string {
  const sol = l / 1_000_000_000;
  if (sol >= 1000) return `${(sol / 1000).toFixed(1)}k`;
  if (sol >= 1) return sol.toFixed(2);
  return sol.toFixed(3);
}

export default function BinaryFeedCard({
  round,
  livePrice,
  onBet,
  onTrade,
  isActive,
}: BinaryFeedCardProps) {
  const [betAmount, setBetAmount] = useState("");
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [countdown, setCountdown] = useState("");
  const [liked, setLiked] = useState(false);
  const [likeCount] = useState(() => 80 + Math.floor(Math.random() * 200));
  const [shared, setShared] = useState(false);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const lastApiPrice = useRef(0);
  const driftRef = useRef(0);
  const lastTapRef = useRef(0);

  const assetMeta = CRYPTO_ASSETS.find((a) => a.value === round.asset)!;
  const currentPrice = livePrice > 0 ? livePrice : round.startPrice;
  const displayPrice = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : currentPrice;
  const isAboveStart = displayPrice >= round.startPrice;
  const priceChangePct =
    round.startPrice > 0
      ? ((displayPrice - round.startPrice) / round.startPrice) * 100
      : 0;

  const upSol = round.upPool / 1_000_000_000;
  const downSol = round.downPool / 1_000_000_000;
  const totalSol = upSol + downSol;
  const upPayout = downSol > 0 ? (totalSol * 0.98) / upSol : 0;
  const downPayout = upSol > 0 ? (totalSol * 0.98) / downSol : 0;
  const upPct = totalSol > 0 ? (upSol / totalSol) * 100 : 50;

  // Countdown
  useEffect(() => {
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, round.endTime - now);
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      setCountdown(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [round.endTime]);

  // Reset on round change
  useEffect(() => {
    setPriceHistory([]);
    lastApiPrice.current = 0;
    driftRef.current = 0;
  }, [round.id]);

  // Accumulate chart data from mount (all cards build data in background)
  useEffect(() => {
    if (currentPrice <= 0) return;
    if (currentPrice !== lastApiPrice.current) {
      lastApiPrice.current = currentPrice;
      driftRef.current = currentPrice;
    }
    const addPoint = () => {
      const base = driftRef.current || currentPrice;
      const jittered = jitteredPrice(base, round.asset);
      driftRef.current = jittered;
      const now = new Date();
      const time = `${now.getMinutes()}:${now.getSeconds().toString().padStart(2, "0")}`;
      setPriceHistory((prev) => [...prev, { time, price: jittered, ts: Date.now() }].slice(-150));
    };
    addPoint();
    const interval = setInterval(addPoint, 2000);
    return () => clearInterval(interval);
  }, [currentPrice, round.asset, round.id]);

  const prices = priceHistory.map((p) => p.price);
  prices.push(round.startPrice);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP;
  const pad = range > 0 ? range * 0.3 : maxP * 0.001 || 1;

  const handleBet = (side: "up" | "down") => {
    const amt = parseFloat(betAmount) || 0;
    if (amt <= 0 || round.phase !== "betting") return;
    onBet(side, amt);
    setBetAmount("");
  };

  const handleDoubleTap = useCallback(() => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      if (!liked) setLiked(true);
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 800);
    }
    lastTapRef.current = now;
  }, [liked]);

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${assetMeta.label} Binary Market`,
          text: `${round.asset} is ${isAboveStart ? "UP" : "DOWN"} ${Math.abs(priceChangePct).toFixed(3)}%`,
          url: window.location.origin,
        });
      } else {
        await navigator.clipboard.writeText(window.location.origin);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // cancelled
    }
  };

  const elapsed = Math.floor(Date.now() / 1000) - round.startTime;
  const progressPct = Math.min(100, (elapsed / round.duration) * 100);

  return (
    <div className="relative flex h-full w-full flex-col justify-end overflow-hidden" onClick={handleDoubleTap}>
      {/* Double-tap heart animation */}
      {showHeartAnim && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <svg className="h-28 w-28 text-red-500 animate-heart-pop" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
          </svg>
        </div>
      )}

      {/* Background chart — fills entire card */}
      <div className="absolute inset-0 z-0">
        {priceHistory.length >= 2 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={priceHistory} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`feed-grad-${round.id}-up`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="60%" stopColor="#10b981" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id={`feed-grad-${round.id}-down`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
                  <stop offset="60%" stopColor="#ef4444" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis domain={[minP - pad, maxP + pad]} hide />
              <ReferenceLine
                y={round.startPrice}
                stroke={isAboveStart ? "#10b98140" : "#ef444440"}
                strokeDasharray="8 6"
                strokeWidth={1.5}
              />
              <Area
                type="monotone"
                dataKey="price"
                stroke={isAboveStart ? "#10b981" : "#ef4444"}
                strokeWidth={2.5}
                fill={isAboveStart ? `url(#feed-grad-${round.id}-up)` : `url(#feed-grad-${round.id}-down)`}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
          </div>
        )}
        {/* Overlay gradient for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/20" />
        {/* Watermark logo */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.04] pointer-events-none">
          <CryptoLogo asset={round.asset} size={400} />
        </div>
      </div>

      {/* Top bar — timer only (no logo/name, moved to center) */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-start justify-between p-5 pt-6">
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase backdrop-blur-sm ${
            round.phase === "betting" ? "bg-green-500/20 text-green-400" :
            round.phase === "locked" ? "bg-yellow-500/20 text-yellow-400" :
            round.phase === "complete" ? "bg-gray-500/20 text-gray-400" :
            "bg-blue-500/20 text-blue-400"
          }`}>
            {round.phase === "betting" ? "OPEN" : round.phase.toUpperCase()}
          </span>
          <span className="text-xs text-white/40">
            Round #{round.roundNumber} &middot; 5 min
          </span>
        </div>
        {round.phase !== "complete" && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-white/10 backdrop-blur-sm">
              <div
                className="h-full rounded-full bg-white/60 transition-all duration-1000"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-lg font-black tabular-nums text-white drop-shadow-lg">
              {countdown}
            </span>
          </div>
        )}
      </div>

      {/* Center — asset name + large live price */}
      <div className="absolute left-0 right-0 top-1/3 z-10 flex flex-col items-center -translate-y-1/2">
        <h2 className="mb-1 text-lg font-black uppercase tracking-widest text-white/70 drop-shadow-lg sm:text-xl">
          {assetMeta.label}
        </h2>
        <span className="text-4xl font-black tabular-nums text-white drop-shadow-lg sm:text-5xl">
          ${displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <div className="mt-2 flex items-center gap-2">
          <span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-green-400 backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            LIVE
          </span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold backdrop-blur-sm ${
            isAboveStart ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
          }`}>
            {isAboveStart ? "↑" : "↓"} {priceChangePct >= 0 ? "+" : ""}{priceChangePct.toFixed(3)}%
          </span>
        </div>
        <p className="mt-1 text-[10px] text-white/40">
          Start: ${round.startPrice.toLocaleString()} &middot; Pyth Oracle
        </p>
      </div>

      {/* Right sidebar — TikTok-style action buttons */}
      <div className="absolute bottom-44 right-3 z-10 flex flex-col items-center gap-5 sm:right-5">
        {/* Asset avatar */}
        <div className="relative">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-primary ring-2 ring-black/40 transition-transform active:scale-90">
            <CryptoLogo asset={round.asset} size={28} />
          </div>
          <div className="absolute -bottom-1 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full bg-primary-500 text-white">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </div>
        </div>

        {/* Heart/Like */}
        <button
          onClick={(e) => { e.stopPropagation(); setLiked((p) => !p); }}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
            liked ? "bg-red-500/20" : "bg-white/10 backdrop-blur-sm"
          }`}>
            <svg
              className={`h-6 w-6 transition-all ${liked ? "text-red-500 scale-110" : "text-white"}`}
              viewBox="0 0 24 24"
              fill={liked ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={liked ? 0 : 1.5}
            >
              <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
            </svg>
          </div>
          <span className={`text-[10px] font-bold ${liked ? "text-red-400" : "text-white"}`}>
            {likeCount + (liked ? 1 : 0)}
          </span>
        </button>

        {/* Chat / Activity */}
        <button
          onClick={(e) => { e.stopPropagation(); onTrade(); }}
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

        {/* Trade button */}
        <button
          onClick={(e) => { e.stopPropagation(); onTrade(); }}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary shadow-lg shadow-primary-500/20">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-[10px] font-bold text-white">Trade</span>
        </button>
      </div>

      {/* Bottom controls */}
      <div className="relative z-10 p-5 pb-6 pr-16">
        {/* Pool info */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold uppercase text-white/40">Pool</span>
            <span className="text-sm font-bold text-white">{formatLamports(round.totalPool)} SOL</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onTrade(); }}
            className="rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-bold text-white backdrop-blur-sm transition-all hover:bg-white/20 active:scale-95"
          >
            Trade Details
          </button>
        </div>

        {/* Pool bar */}
        <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-red-500/30">
          <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${upPct}%` }} />
        </div>
        <div className="mb-4 flex items-center justify-between text-xs">
          <span>
            <span className="font-bold text-green-400">UP</span>
            <span className="ml-1 text-white/50">{formatLamports(round.upPool)}</span>
            <span className="ml-1 font-bold text-green-400">{upPayout > 0 ? `${upPayout.toFixed(2)}x` : ""}</span>
          </span>
          <span>
            <span className="font-bold text-red-400">{downPayout > 0 ? `${downPayout.toFixed(2)}x` : ""}</span>
            <span className="ml-1 text-white/50">{formatLamports(round.downPool)}</span>
            <span className="ml-1 font-bold text-red-400">DOWN</span>
          </span>
        </div>

        {round.phase === "complete" ? (
          <div className="rounded-2xl bg-white/5 p-5 text-center backdrop-blur-sm">
            <p className={`text-3xl font-black ${round.outcome === "up" ? "text-green-400" : "text-red-400"}`}>
              {round.outcome === "up" ? "↑ UP WINS" : "↓ DOWN WINS"}
            </p>
            <p className="mt-1 text-xs text-white/40">Next round starting...</p>
          </div>
        ) : round.phase === "locked" || round.phase === "resolving" ? (
          <div className="rounded-2xl bg-yellow-500/5 border border-yellow-500/20 p-5 text-center backdrop-blur-sm">
            <svg className="mx-auto h-6 w-6 text-yellow-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="mt-1 text-sm font-bold text-yellow-400">Bets Locked</p>
          </div>
        ) : (
          <>
            {/* Quick bet row */}
            <div className="mb-3 flex gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  value={betAmount}
                  onChange={(e) => setBetAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-4 pr-14 text-right text-lg font-black tabular-nums text-white placeholder-white/20 outline-none backdrop-blur-sm transition-all focus:border-primary-500/40"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-white/40">SOL</span>
              </div>
            </div>

            {/* Quick amounts */}
            <div className="mb-3 flex gap-1.5">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={(e) => {
                    e.stopPropagation();
                    setBetAmount((prev) => ((parseFloat(prev) || 0) + amt).toString());
                  }}
                  className="flex-1 rounded-lg bg-white/5 py-2 text-xs font-semibold text-white/60 backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white active:scale-95"
                >
                  +{amt}
                </button>
              ))}
            </div>

            {/* UP / DOWN buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); handleBet("up"); }}
                disabled={!betAmount || parseFloat(betAmount) <= 0}
                className="rounded-2xl bg-green-500 py-4 text-base font-black text-white shadow-lg shadow-green-500/30 transition-all hover:bg-green-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ↑ UP {upPayout > 0 ? `${upPayout.toFixed(2)}x` : ""}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleBet("down"); }}
                disabled={!betAmount || parseFloat(betAmount) <= 0}
                className="rounded-2xl bg-red-500 py-4 text-base font-black text-white shadow-lg shadow-red-500/30 transition-all hover:bg-red-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ↓ DOWN {downPayout > 0 ? `${downPayout.toFixed(2)}x` : ""}
              </button>
            </div>
          </>
        )}

        {/* Recent bets ticker */}
        {round.bets.length > 0 && (
          <div className="mt-3 flex items-center gap-2 overflow-hidden">
            <span className="shrink-0 text-[9px] font-bold uppercase text-white/30">Live</span>
            <div className="flex gap-2 overflow-x-auto">
              {round.bets.slice(-5).reverse().map((bet) => (
                <span
                  key={bet.id}
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur-sm ${
                    bet.side === "up" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                  }`}
                >
                  {bet.side === "up" ? "↑" : "↓"} {bet.wallet} {(bet.amount / 1_000_000_000).toFixed(1)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
