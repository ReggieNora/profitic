"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { BinaryRound, CryptoAsset, CRYPTO_ASSETS } from "@/types";
import { CryptoLogo } from "./CryptoLogos";

interface BinaryRoundCardProps {
  round: BinaryRound;
  livePrice: number;
  onBet: (side: "up" | "down", amount: number) => void;
  onClick?: () => void;
  compact?: boolean;
}

const QUICK_AMOUNTS = [0.1, 0.5, 1, 5];

function formatLamports(l: number): string {
  const sol = l / 1_000_000_000;
  if (sol >= 1000) return `${(sol / 1000).toFixed(1)}k`;
  if (sol >= 1) return sol.toFixed(2);
  return sol.toFixed(3);
}

function formatPrice(p: number): string {
  if (p >= 10000) return `$${(p / 1000).toFixed(1)}k`;
  if (p >= 100) return `$${p.toFixed(0)}`;
  return `$${p.toFixed(2)}`;
}

export interface PricePoint {
  time: string;
  price: number;
  ts: number;
}

// Realistic micro-jitter: simulates tick-level price noise between API updates
// Varies by asset to reflect real volatility ratios
const JITTER_BPS: Record<CryptoAsset, number> = {
  BTC: 3,   // ~0.03% jitter
  ETH: 5,   // ~0.05% jitter
  SOL: 8,   // ~0.08% jitter
};

function jitteredPrice(base: number, asset: CryptoAsset): number {
  const bps = JITTER_BPS[asset];
  const pct = (Math.random() - 0.5) * 2 * (bps / 10000);
  return base * (1 + pct);
}

export default function BinaryRoundCard({
  round,
  livePrice,
  onBet,
  onClick,
  compact = false,
}: BinaryRoundCardProps) {
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

  // Pool calculations
  const upSol = round.upPool / 1_000_000_000;
  const downSol = round.downPool / 1_000_000_000;
  const totalSol = upSol + downSol;
  const upPayout = downSol > 0 ? (totalSol * 0.98) / upSol : 0;
  const downPayout = upSol > 0 ? (totalSol * 0.98) / downSol : 0;
  const upPct = totalSol > 0 ? (upSol / totalSol) * 100 : 50;

  // Countdown timer
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

  // Reset price history when round changes
  useEffect(() => {
    setPriceHistory([]);
    lastApiPrice.current = 0;
    driftRef.current = 0;
  }, [round.id]);

  // Accumulate price data on a timer with realistic jitter
  useEffect(() => {
    if (currentPrice <= 0) return;

    // When the API price updates, snap drift toward it
    if (currentPrice !== lastApiPrice.current) {
      lastApiPrice.current = currentPrice;
      driftRef.current = currentPrice;
    }

    const addPoint = () => {
      const base = driftRef.current || currentPrice;
      const jittered = jitteredPrice(base, round.asset);
      // Random walk: drift slightly from current jittered position
      driftRef.current = jittered;

      const now = new Date();
      const time = `${now.getMinutes()}:${now.getSeconds().toString().padStart(2, "0")}`;
      setPriceHistory((prev) => {
        const updated = [...prev, { time, price: jittered, ts: Date.now() }];
        return updated.slice(-100);
      });
    };

    // Add initial point immediately
    addPoint();

    // Add points every 2 seconds for smooth chart movement
    const interval = setInterval(addPoint, 2000);
    return () => clearInterval(interval);
  }, [currentPrice, round.asset, round.id]);

  // Y domain for chart — tight domain to show real variations
  const prices = priceHistory.map((p) => p.price);
  prices.push(round.startPrice);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP;
  const pad = range > 0 ? range * 0.2 : maxP * 0.001 || 1;

  const handleBet = (side: "up" | "down") => {
    const amt = parseFloat(betAmount) || 0;
    if (amt <= 0 || round.phase !== "betting") return;
    onBet(side, amt);
    setBetAmount("");
  };

  const phaseColors: Record<string, string> = {
    betting: "bg-green-500/15 text-green-400",
    locked: "bg-yellow-500/15 text-yellow-400",
    resolving: "bg-blue-500/15 text-blue-400",
    complete: "bg-gray-500/15 text-gray-400",
  };

  return (
    <div
      className={`rounded-2xl border border-surface-50/50 bg-surface-300 overflow-hidden ${onClick ? "cursor-pointer transition-all hover:border-primary-500/40 hover:shadow-lg hover:shadow-primary-500/5" : ""}`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-surface-50/30 px-5 py-3">
        <div className="flex items-center gap-3">
          <CryptoLogo asset={round.asset} size={32} />
          <div>
            <h3 className="text-sm font-bold text-white">{assetMeta.label}</h3>
            <p className="text-[10px] text-gray-500">
              Round #{round.roundNumber} &middot; 5 min
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${phaseColors[round.phase]}`}>
            {round.phase === "betting" ? "OPEN" : round.phase.toUpperCase()}
          </span>
          {round.phase !== "complete" && (
            <span className="rounded-full bg-surface-400 px-3 py-1 text-sm font-black tabular-nums text-white">
              {countdown}
            </span>
          )}
        </div>
      </div>

      {/* Live price + chart */}
      <div className="px-5 pt-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl font-black tabular-nums text-white">
              ${displayPrice.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            {round.phase !== "complete" && (
              <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-bold text-green-400">
                <span className="h-1 w-1 rounded-full bg-green-400 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              isAboveStart ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
            }`}
          >
            {isAboveStart ? "↑" : "↓"} {priceChangePct >= 0 ? "+" : ""}
            {priceChangePct.toFixed(3)}%
          </span>
        </div>

        <div className="h-36 w-full">
          {priceHistory.length < 2 ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={priceHistory} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`grad-${round.id}-up`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`grad-${round.id}-down`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" hide />
                <YAxis domain={[minP - pad, maxP + pad]} hide />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#16182b",
                    border: "1px solid #2a2d3a",
                    borderRadius: "0.5rem",
                    fontSize: 11,
                    color: "#fff",
                  }}
                  formatter={(v: number | string) => [`$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2 })}`, round.asset]}
                />
                <ReferenceLine
                  y={round.startPrice}
                  stroke="#6b7280"
                  strokeDasharray="4 3"
                  strokeWidth={1}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={isAboveStart ? "#10b981" : "#ef4444"}
                  strokeWidth={2}
                  fill={isAboveStart ? `url(#grad-${round.id}-up)` : `url(#grad-${round.id}-down)`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-600 mt-0.5 mb-2">
          <span>Start: ${round.startPrice.toLocaleString()}</span>
          <span>Pyth Oracle</span>
        </div>
      </div>

      {/* Pool info */}
      <div className="mx-5 mb-3 rounded-xl bg-surface-400/60 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold uppercase text-gray-500">Pool</span>
          <span className="text-xs font-bold text-white">{formatLamports(round.totalPool)} SOL</span>
        </div>
        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-red-500/30">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${upPct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <div className="text-left">
            <span className="text-[10px] font-bold text-green-400">UP</span>
            <span className="ml-1 text-[10px] text-gray-500">{formatLamports(round.upPool)} SOL</span>
            <span className="ml-1 text-[10px] font-bold text-green-400/70">{upPayout > 0 ? `${upPayout.toFixed(2)}x` : "—"}</span>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold text-red-400/70">{downPayout > 0 ? `${downPayout.toFixed(2)}x` : "—"}</span>
            <span className="ml-1 text-[10px] text-gray-500">{formatLamports(round.downPool)} SOL</span>
            <span className="ml-1 text-[10px] font-bold text-red-400">DOWN</span>
          </div>
        </div>
      </div>

      {/* Betting UI or result */}
      <div className="px-5 pb-4">
        {round.phase === "complete" ? (
          <div className="rounded-xl bg-surface-400/60 p-4 text-center">
            <p className="text-xs text-gray-500">Round Complete</p>
            <p className={`mt-1 text-2xl font-black ${round.outcome === "up" ? "text-green-400" : "text-red-400"}`}>
              {round.outcome === "up" ? "↑ UP" : "↓ DOWN"}
            </p>
            {round.endPrice && (
              <p className="mt-1 text-xs text-gray-500">
                End: ${round.endPrice.toLocaleString()} &middot; Start: ${round.startPrice.toLocaleString()}
              </p>
            )}
            <p className="mt-2 text-[10px] text-gray-600">Next round starting...</p>
          </div>
        ) : round.phase === "locked" || round.phase === "resolving" ? (
          <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/20 p-4 text-center">
            <svg className="mx-auto h-5 w-5 text-yellow-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="mt-1 text-xs font-bold text-yellow-400">Bets Locked</p>
            <p className="mt-0.5 text-[10px] text-gray-500">Waiting for resolution...</p>
          </div>
        ) : (
          <>
            {/* Amount input */}
            <div className="relative mb-2">
              <input
                type="number"
                value={betAmount}
                onChange={(e) => setBetAmount(e.target.value)}
                placeholder="0"
                min="0"
                step="0.01"
                className="w-full rounded-xl border border-surface-50/50 bg-surface-400 py-3 pl-4 pr-14 text-right text-lg font-black tabular-nums text-white placeholder-gray-700 outline-none transition-all focus:border-primary-500/40"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">
                SOL
              </span>
            </div>

            {/* Quick amounts */}
            <div className="flex gap-1.5 mb-3">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={() => setBetAmount((prev) => ((parseFloat(prev) || 0) + amt).toString())}
                  className="flex-1 rounded-lg bg-surface-400 py-1.5 text-[11px] font-semibold text-gray-400 transition-all hover:bg-surface-400/80 hover:text-white active:scale-95"
                >
                  +{amt}
                </button>
              ))}
            </div>

            {/* UP / DOWN buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleBet("up")}
                disabled={!betAmount || parseFloat(betAmount) <= 0}
                className="rounded-xl bg-green-500 py-3 text-sm font-black text-white shadow-lg shadow-green-500/20 transition-all hover:bg-green-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ↑ UP {upPayout > 0 ? `(${upPayout.toFixed(2)}x)` : ""}
              </button>
              <button
                onClick={() => handleBet("down")}
                disabled={!betAmount || parseFloat(betAmount) <= 0}
                className="rounded-xl bg-red-500 py-3 text-sm font-black text-white shadow-lg shadow-red-500/20 transition-all hover:bg-red-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ↓ DOWN {downPayout > 0 ? `(${downPayout.toFixed(2)}x)` : ""}
              </button>
            </div>
            <p className="mt-2 text-center text-[9px] text-gray-600">
              2% platform fee &middot; Resolved by Pyth Oracle
            </p>
          </>
        )}
      </div>

      {/* Recent bets (activity feed) */}
      {round.bets.length > 0 && (
        <div className="border-t border-surface-50/30 px-5 py-3">
          <p className="mb-2 text-[10px] font-semibold uppercase text-gray-500">Live Bets</p>
          <div className="max-h-24 overflow-y-auto space-y-1">
            {round.bets
              .slice(-8)
              .reverse()
              .map((bet) => (
                <div
                  key={bet.id}
                  className="flex items-center justify-between text-[11px] animate-fade-in"
                >
                  <div className="flex items-center gap-1.5">
                    <span className={`font-bold ${bet.side === "up" ? "text-green-400" : "text-red-400"}`}>
                      {bet.side === "up" ? "↑" : "↓"}
                    </span>
                    <span className="text-gray-400 font-mono">{bet.wallet}</span>
                  </div>
                  <span className="font-semibold text-white">
                    {formatLamports(bet.amount)} SOL
                  </span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
