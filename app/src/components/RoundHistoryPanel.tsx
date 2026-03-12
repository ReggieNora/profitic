"use client";

import React, { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  YAxis,
  XAxis,
  ResponsiveContainer,
  ReferenceLine,
  Tooltip,
} from "recharts";
import { CompletedRound } from "@/hooks/useBinaryMarkets";
import { fetchAssetPrice } from "@/lib/tokenDiscovery";
import { CryptoLogo } from "./CryptoLogos";

interface RoundHistoryPanelProps {
  rounds: CompletedRound[];
  currentRound: number;
  assetSymbol: string;
  assetName: string;
  assetType: "core" | "pumpfun";
  interval: number;
  availableIntervals?: number[];
  activeInterval?: number;
  onIntervalChange?: (interval: number) => void;
  onClose: () => void;
}

interface ChartPoint {
  time: string;
  price: number;
}

const INTERVAL_LABELS: Record<number, string> = {
  60: "1m",
  300: "5m",
  900: "15m",
  180: "3m",
};

function formatUsd(v: number): string {
  if (v >= 10000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(8)}`;
}

function formatLamports(l: number): string {
  const sol = l / 1_000_000_000;
  if (sol >= 1000) return `${(sol / 1000).toFixed(1)}k`;
  if (sol >= 1) return sol.toFixed(2);
  return sol.toFixed(3);
}

export default function RoundHistoryPanel({
  rounds,
  currentRound,
  assetSymbol,
  assetName,
  assetType,
  interval,
  availableIntervals,
  activeInterval,
  onIntervalChange,
  onClose,
}: RoundHistoryPanelProps) {
  const [selectedRound, setSelectedRound] = useState<CompletedRound | null>(null);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [livePrice, setLivePrice] = useState<number>(0);

  const isCoreAsset = assetType === "core" && (assetSymbol === "BTC" || assetSymbol === "ETH" || assetSymbol === "SOL");
  const intervalLabel = INTERVAL_LABELS[interval] ?? `${interval / 60}m`;
  const sortedRounds = [...rounds].sort((a, b) => b.roundNumber - a.roundNumber);

  // Stats
  const totalRounds = rounds.length;
  const upWins = rounds.filter((r) => r.outcome === "up").length;
  const downWins = rounds.filter((r) => r.outcome === "down").length;
  const upStreak = (() => {
    let streak = 0;
    for (let i = sortedRounds.length - 1; i >= 0; i--) {
      // count from most recent
      const r = sortedRounds[sortedRounds.length - 1 - i];
      if (!r) break;
    }
    // Calculate current streak from most recent
    for (const r of sortedRounds) {
      if (r.outcome === sortedRounds[0]?.outcome) streak++;
      else break;
    }
    return { side: sortedRounds[0]?.outcome || "up", count: streak };
  })();

  // Generate simulated chart data for a selected completed round
  useEffect(() => {
    if (!selectedRound) {
      setChartData([]);
      return;
    }

    const { entryPrice, finalPrice, interval: roundInterval } = selectedRound;
    const points: ChartPoint[] = [];
    const numPoints = 30;
    const priceDiff = finalPrice - entryPrice;

    for (let i = 0; i <= numPoints; i++) {
      const progress = i / numPoints;
      // Simulate a realistic price path with some randomness
      const trend = entryPrice + priceDiff * progress;
      const noise = entryPrice * (Math.random() - 0.5) * 0.002;
      const price = trend + noise;
      const seconds = Math.round((roundInterval * i) / numPoints);
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      points.push({
        time: `${m}:${s.toString().padStart(2, "0")}`,
        price,
      });
    }
    // Ensure last point is exact final price
    if (points.length > 0) {
      points[points.length - 1].price = finalPrice;
    }
    setChartData(points);
  }, [selectedRound]);

  // Fetch current live price for the header
  useEffect(() => {
    if (rounds.length > 0) {
      const latest = sortedRounds[0];
      if (latest) setLivePrice(latest.finalPrice);
    }
  }, [rounds, sortedRounds]);

  const chartPrices = chartData.map((p) => p.price);
  const chartEntryPrice = selectedRound?.entryPrice ?? 0;
  if (chartEntryPrice > 0) chartPrices.push(chartEntryPrice);
  const minP = chartPrices.length > 0 ? Math.min(...chartPrices) : 0;
  const maxP = chartPrices.length > 0 ? Math.max(...chartPrices) : 0;
  const range = maxP - minP;
  const pad = range > 0 ? range * 0.15 : maxP * 0.001 || 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-xl animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-primary overflow-hidden">
            {isCoreAsset ? (
              <CryptoLogo asset={assetSymbol as "BTC" | "ETH" | "SOL"} size={24} />
            ) : (
              <span className="text-xs font-black text-white">{assetSymbol.slice(0, 3)}</span>
            )}
          </div>
          <div>
            <h2 className="text-base font-black text-white">
              {assetName} <span className="text-white/40">{intervalLabel}</span>
            </h2>
            <p className="text-xs text-white/40">
              Round #{currentRound} &middot; {totalRounds} completed
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 transition-all hover:bg-white/20 active:scale-90"
        >
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Interval switcher */}
      {availableIntervals && availableIntervals.length > 1 && onIntervalChange && (
        <div className="flex items-center gap-1.5 border-b border-white/5 px-5 py-2.5">
          <span className="mr-1 text-[10px] font-bold uppercase text-white/30">Interval</span>
          {availableIntervals.map((iv) => {
            const isSelected = iv === (activeInterval ?? interval);
            return (
              <button
                key={iv}
                onClick={() => onIntervalChange(iv)}
                className={`rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
                  isSelected
                    ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30"
                    : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white"
                }`}
              >
                {INTERVAL_LABELS[iv] ?? `${iv / 60}m`}
              </button>
            );
          })}
        </div>
      )}

      {/* Stats bar */}
      <div className="flex items-center gap-4 border-b border-white/5 px-5 py-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase text-white/30">Win Rate</span>
          <div className="flex gap-1">
            <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[11px] font-bold text-green-400">
              ↑ {totalRounds > 0 ? Math.round((upWins / totalRounds) * 100) : 0}%
            </span>
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[11px] font-bold text-red-400">
              ↓ {totalRounds > 0 ? Math.round((downWins / totalRounds) * 100) : 0}%
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase text-white/30">Streak</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            upStreak.side === "up" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
          }`}>
            {upStreak.count}x {upStreak.side === "up" ? "↑" : "↓"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase text-white/30">Rounds</span>
          <span className="text-[11px] font-bold text-white/60">{totalRounds}</span>
        </div>
      </div>

      {/* Selected round chart */}
      {selectedRound && chartData.length > 1 && (
        <div className="border-b border-white/5 px-5 py-4">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <span className="text-sm font-bold text-white">Round #{selectedRound.roundNumber}</span>
              <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                selectedRound.outcome === "up"
                  ? "bg-green-500/20 text-green-400"
                  : selectedRound.outcome === "down"
                  ? "bg-red-500/20 text-red-400"
                  : "bg-yellow-500/20 text-yellow-400"
              }`}>
                {selectedRound.outcome === "up" ? "↑ UP" : selectedRound.outcome === "down" ? "↓ DOWN" : "REFUND"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-xs text-white/40">
                {formatUsd(selectedRound.entryPrice)} → {formatUsd(selectedRound.finalPrice)}
              </span>
            </div>
          </div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <defs>
                  <linearGradient id="histGradUp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="histGradDown" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <YAxis domain={[minP - pad, maxP + pad]} hide />
                <XAxis dataKey="time" hide />
                <Tooltip
                  contentStyle={{
                    background: "rgba(0,0,0,0.85)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#fff",
                  }}
                  formatter={(value: number) => [formatUsd(value), "Price"]}
                />
                <ReferenceLine
                  y={selectedRound.entryPrice}
                  stroke="#facc15"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                  strokeOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={selectedRound.outcome === "up" ? "#10b981" : "#ef4444"}
                  strokeWidth={2}
                  fill={selectedRound.outcome === "up" ? "url(#histGradUp)" : "url(#histGradDown)"}
                  dot={false}
                  isAnimationActive={true}
                  animationDuration={600}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-white/40">
            <span>Pool: {formatLamports(selectedRound.totalPool)} SOL</span>
            <span>
              ↑ {formatLamports(selectedRound.upPool)} / ↓ {formatLamports(selectedRound.downPool)}
            </span>
            <span>{selectedRound.totalBets} bets</span>
          </div>
        </div>
      )}

      {/* Round list */}
      <div className="flex-1 overflow-y-auto px-5 py-3">
        {sortedRounds.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-white/30">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium">No completed rounds yet</p>
            <p className="text-xs">History will appear after the first round finishes</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedRounds.map((round) => {
              const isSelected = selectedRound?.id === round.id;
              const priceChange = ((round.finalPrice - round.entryPrice) / round.entryPrice) * 100;
              const totalSol = round.totalPool / 1_000_000_000;

              return (
                <button
                  key={round.id}
                  onClick={() => setSelectedRound(isSelected ? null : round)}
                  className={`w-full rounded-xl border p-3 text-left transition-all active:scale-[0.98] ${
                    isSelected
                      ? "border-primary-500/40 bg-primary-500/10"
                      : "border-white/5 bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {/* Outcome indicator */}
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                        round.outcome === "up"
                          ? "bg-green-500/20 text-green-400"
                          : round.outcome === "down"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-yellow-500/20 text-yellow-400"
                      }`}>
                        {round.outcome === "up" ? "↑" : round.outcome === "down" ? "↓" : "–"}
                      </div>
                      <div>
                        <span className="text-sm font-bold text-white">
                          Round #{round.roundNumber}
                        </span>
                        <div className="flex items-center gap-2 text-[11px] text-white/40">
                          <span>{formatUsd(round.entryPrice)} → {formatUsd(round.finalPrice)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold ${
                        round.outcome === "up" ? "text-green-400" : round.outcome === "down" ? "text-red-400" : "text-yellow-400"
                      }`}>
                        {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(3)}%
                      </span>
                      <div className="text-[11px] text-white/30">
                        {totalSol.toFixed(1)} SOL
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Win streak bar at bottom */}
      {sortedRounds.length > 0 && (
        <div className="border-t border-white/5 px-5 py-3">
          <div className="flex items-center gap-1">
            <span className="mr-2 text-[10px] font-bold uppercase text-white/30">Recent</span>
            {sortedRounds.slice(0, 20).reverse().map((round) => (
              <div
                key={round.id}
                className={`h-4 w-4 rounded-sm text-[8px] font-black flex items-center justify-center ${
                  round.outcome === "up"
                    ? "bg-green-500/30 text-green-400"
                    : round.outcome === "down"
                    ? "bg-red-500/30 text-red-400"
                    : "bg-yellow-500/30 text-yellow-400"
                }`}
                title={`Round #${round.roundNumber}: ${round.outcome?.toUpperCase()}`}
              >
                {round.outcome === "up" ? "↑" : round.outcome === "down" ? "↓" : "–"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
