"use client";

import React, { useState, useEffect, useRef } from "react";
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
  const lastApiPrice = useRef(0);
  const driftRef = useRef(0);

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

  // Accumulate chart data — only when active
  useEffect(() => {
    if (!isActive || currentPrice <= 0) return;
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
  }, [isActive, currentPrice, round.asset, round.id]);

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

  const elapsed = Math.floor(Date.now() / 1000) - round.startTime;
  const progressPct = Math.min(100, (elapsed / round.duration) * 100);

  return (
    <div className="relative flex h-full w-full flex-col justify-end overflow-hidden">
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
      </div>

      {/* Top bar — asset info + timer */}
      <div className="absolute left-0 right-0 top-0 z-10 flex items-start justify-between p-5 pt-6">
        <div className="flex items-center gap-3">
          <CryptoLogo asset={round.asset} size={44} />
          <div>
            <h2 className="text-xl font-black text-white drop-shadow-lg">{assetMeta.label}</h2>
            <p className="text-xs text-white/60">
              Round #{round.roundNumber} &middot; 5 min
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase backdrop-blur-sm ${
            round.phase === "betting" ? "bg-green-500/20 text-green-400" :
            round.phase === "locked" ? "bg-yellow-500/20 text-yellow-400" :
            round.phase === "complete" ? "bg-gray-500/20 text-gray-400" :
            "bg-blue-500/20 text-blue-400"
          }`}>
            {round.phase === "betting" ? "OPEN" : round.phase.toUpperCase()}
          </span>
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
      </div>

      {/* Center — large live price */}
      <div className="absolute left-0 right-0 top-1/3 z-10 flex flex-col items-center -translate-y-1/2">
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

      {/* Bottom controls */}
      <div className="relative z-10 p-5 pb-6">
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
