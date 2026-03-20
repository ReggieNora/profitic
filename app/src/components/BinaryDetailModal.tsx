"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from "recharts";
import { BinaryMarket } from "@/hooks/useBinaryMarkets";
import { PricePoint } from "./BinaryFeedCard";
import { CryptoLogo } from "./CryptoLogos";

interface BinaryDetailModalProps {
  market: BinaryMarket;
  livePrice: number;
  onBet: (side: "up" | "down", amount: number) => void;
  onClose: () => void;
}

const QUICK_AMOUNTS = [0.1, 0.5, 1, 2, 5, 10];

function formatLamports(l: number): string {
  const sol = l / 1_000_000_000;
  if (sol >= 1000) return `${(sol / 1000).toFixed(1)}k`;
  if (sol >= 1) return sol.toFixed(2);
  return sol.toFixed(3);
}

const JITTER_MAP: Record<string, number> = { BTC: 3, ETH: 5, SOL: 8 };
function jitteredPrice(base: number, symbol: string): number {
  const bps = JITTER_MAP[symbol] ?? 12;
  return base * (1 + (Math.random() - 0.5) * 2 * (bps / 10000));
}

export default function BinaryDetailModal({
  market,
  livePrice,
  onBet,
  onClose,
}: BinaryDetailModalProps) {
  const [betAmount, setBetAmount] = useState("");
  const [selectedSide, setSelectedSide] = useState<"up" | "down">("up");
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [countdown, setCountdown] = useState("");
  const lastApiPrice = useRef(0);
  const driftRef = useRef(0);

  const { asset } = market;
  const isCoreAsset = asset.type === "core" && (asset.symbol === "BTC" || asset.symbol === "ETH" || asset.symbol === "SOL");
  const currentPrice = livePrice > 0 ? livePrice : market.entryPrice;
  const displayPrice = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : currentPrice;
  const isAboveStart = displayPrice >= market.entryPrice;
  const priceChangePct =
    market.entryPrice > 0
      ? ((displayPrice - market.entryPrice) / market.entryPrice) * 100
      : 0;

  const upSol = market.upPool / 1_000_000_000;
  const downSol = market.downPool / 1_000_000_000;
  const totalSol = upSol + downSol;
  const upPayout = downSol > 0 ? (totalSol * 0.98) / upSol : 0;
  const downPayout = upSol > 0 ? (totalSol * 0.98) / downSol : 0;
  const upPct = totalSol > 0 ? (upSol / totalSol) * 100 : 50;

  const formatUsd = (v: number) => {
    if (v >= 10000) return `$${(v / 1000).toFixed(1)}k`;
    if (v >= 1) return `$${v.toFixed(2)}`;
    if (v >= 0.01) return `$${v.toFixed(4)}`;
    return `$${v.toFixed(8)}`;
  };

  // Countdown
  useEffect(() => {
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, market.endTime - now);
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      setCountdown(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [market.endTime]);

  // Reset on round change
  useEffect(() => {
    setPriceHistory([]);
    lastApiPrice.current = 0;
    driftRef.current = 0;
  }, [market.id]);

  // Accumulate chart data with jitter
  useEffect(() => {
    if (currentPrice <= 0) return;
    if (currentPrice !== lastApiPrice.current) {
      lastApiPrice.current = currentPrice;
      driftRef.current = currentPrice;
    }
    const addPoint = () => {
      const base = driftRef.current || currentPrice;
      const jittered = jitteredPrice(base, asset.symbol);
      driftRef.current = jittered;
      const now = new Date();
      const time = `${now.getMinutes()}:${now.getSeconds().toString().padStart(2, "0")}`;
      setPriceHistory((prev) => [...prev, { time, price: jittered, ts: Date.now() }].slice(-200));
    };
    addPoint();
    const interval = setInterval(addPoint, 2000);
    return () => clearInterval(interval);
  }, [currentPrice, asset.symbol, market.id]);

  // Y domain
  const prices = priceHistory.map((p) => p.price);
  prices.push(market.entryPrice);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP;
  const pad = range > 0 ? range * 0.2 : maxP * 0.001 || 1;

  // PHASE 3: Check lock status client-side
  const [isLocked, setIsLocked] = useState(false);
  const [lockSecondsLeft, setLockSecondsLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, market.endTime - now);
      const locked = now >= market.lockTime && remaining > 0;
      setIsLocked(locked);
      setLockSecondsLeft(locked ? remaining : null);
    };
    tick();
    const iv = setInterval(tick, 200);
    return () => clearInterval(iv);
  }, [market.endTime, market.lockTime]);

  const isBettingOpen = market.phase === "betting" && !isLocked;

  const handleBet = () => {
    const amt = parseFloat(betAmount) || 0;
    if (amt <= 0 || !isBettingOpen) return;
    onBet(selectedSide, amt);
    setBetAmount("");
  };

  const elapsed = Math.floor(Date.now() / 1000) - market.startTime;
  const progressPct = Math.min(100, (elapsed / market.interval) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-surface-50/50 bg-surface-200 shadow-2xl animate-fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-full bg-surface-400 p-2 text-gray-400 transition-all hover:bg-surface-300 hover:text-white"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Header */}
        <div className="border-b border-surface-50/30 px-6 py-4">
          <div className="flex items-center gap-3">
            {isCoreAsset ? (
              <CryptoLogo asset={asset.symbol as "BTC" | "ETH" | "SOL"} size={40} />
            ) : asset.logoUrl ? (
              <img src={asset.logoUrl} alt={asset.symbol} className="h-10 w-10 rounded-full" />
            ) : (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-black text-white"
                style={{ backgroundColor: asset.color }}
              >
                {asset.symbol.slice(0, 2)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">{asset.name}</h2>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                  market.phase === "betting" ? "bg-green-500/15 text-green-400" :
                  market.phase === "locked" ? "bg-yellow-500/15 text-yellow-400" :
                  market.phase === "complete" ? "bg-gray-500/15 text-gray-400" :
                  "bg-blue-500/15 text-blue-400"
                }`}>
                  {market.phase === "betting" ? "OPEN" : market.phase.toUpperCase()}
                </span>
                {!isCoreAsset && (
                  <span className="rounded-full bg-purple-500/15 px-2 py-0.5 text-[9px] font-bold text-purple-400">
                    PUMP.FUN
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Round #{market.roundNumber} &middot; {market.intervalLabel} &middot; {isCoreAsset ? "Pyth Oracle" : "CoinGecko"}
              </p>
            </div>
          </div>
        </div>

        {/* Price + Chart */}
        <div className="px-6 pt-4">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-[10px] font-semibold uppercase text-gray-500 mb-1">Current Price</p>
              <span className="text-3xl font-black tabular-nums text-white">
                {formatUsd(displayPrice)}
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[9px] font-bold text-green-400">
                  <span className="h-1 w-1 rounded-full bg-green-400 animate-pulse" />
                  LIVE
                </span>
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  isAboveStart ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                }`}>
                  {isAboveStart ? "↑" : "↓"} {priceChangePct >= 0 ? "+" : ""}{priceChangePct.toFixed(3)}%
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase text-gray-500 mb-1">Time Remaining</p>
              <span className="text-2xl font-black tabular-nums text-white">{countdown}</span>
              {/* Progress bar */}
              <div className="mt-1 h-1.5 w-32 overflow-hidden rounded-full bg-surface-400">
                <div
                  className="h-full rounded-full bg-primary-500 transition-all duration-1000"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          </div>

          {/* Large chart */}
          <div className="h-64 w-full rounded-xl bg-surface-300 p-2">
            {priceHistory.length < 2 ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={priceHistory} margin={{ top: 10, right: 10, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id={`modal-grad-${market.id}-up`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id={`modal-grad-${market.id}-down`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2035" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                  <YAxis
                    domain={[minP - pad, maxP + pad]}
                    tick={{ fontSize: 10, fill: "#6b7280" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => formatUsd(v)}
                    width={65}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#16182b",
                      border: "1px solid #2a2d3a",
                      borderRadius: "0.75rem",
                      fontSize: 12,
                      color: "#fff",
                      padding: "8px 12px",
                    }}
                    formatter={(v: number | string) => [formatUsd(Number(v)), "Price"]}
                    labelStyle={{ color: "#9ca3af" }}
                  />
                  <ReferenceLine
                    y={market.entryPrice}
                    stroke="#6b7280"
                    strokeDasharray="6 4"
                    strokeWidth={1.5}
                    label={{ value: `Start ${formatUsd(market.entryPrice)}`, fill: "#6b7280", fontSize: 10, position: "left" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke={isAboveStart ? "#10b981" : "#ef4444"}
                    strokeWidth={2.5}
                    fill={isAboveStart ? `url(#modal-grad-${market.id}-up)` : `url(#modal-grad-${market.id}-down)`}
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex items-center justify-between text-[10px] text-gray-600 mt-1 mb-3">
            <span>Start: {formatUsd(market.entryPrice)}</span>
            <span>Oracle: {isCoreAsset ? "Pyth Network (Solana)" : "CoinGecko"}</span>
          </div>
        </div>

        {/* Two-column: Pool stats + Betting */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 px-6 pb-4">
          {/* Pool stats */}
          <div className="rounded-xl bg-surface-300 p-4">
            <p className="text-[10px] font-semibold uppercase text-gray-500 mb-3">Pool Breakdown</p>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-white">Total Pool</span>
              <span className="text-lg font-black text-white">{formatLamports(market.totalPool)} SOL</span>
            </div>
            {/* Pool bar */}
            <div className="h-3 w-full overflow-hidden rounded-full bg-red-500/30 mb-2">
              <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${upPct}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <div>
                <span className="font-bold text-green-400">UP</span>
                <span className="ml-1.5 text-gray-400">{formatLamports(market.upPool)} SOL</span>
                <span className="ml-1.5 font-bold text-green-400">{upPayout > 0 ? `${upPayout.toFixed(2)}x` : "—"}</span>
              </div>
              <div>
                <span className="font-bold text-red-400">{downPayout > 0 ? `${downPayout.toFixed(2)}x` : "—"}</span>
                <span className="ml-1.5 text-gray-400">{formatLamports(market.downPool)} SOL</span>
                <span className="ml-1.5 font-bold text-red-400">DOWN</span>
              </div>
            </div>

            {/* Payout info */}
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between rounded-lg bg-surface-400/60 px-3 py-2">
                <span className="text-[11px] text-gray-400">Your potential payout (UP)</span>
                <span className="text-[11px] font-bold text-green-400">
                  {betAmount && upPayout > 0 ? `${(parseFloat(betAmount) * upPayout).toFixed(2)} SOL` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-surface-400/60 px-3 py-2">
                <span className="text-[11px] text-gray-400">Your potential payout (DOWN)</span>
                <span className="text-[11px] font-bold text-red-400">
                  {betAmount && downPayout > 0 ? `${(parseFloat(betAmount) * downPayout).toFixed(2)} SOL` : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-surface-400/60 px-3 py-2">
                <span className="text-[11px] text-gray-400">Platform fee</span>
                <span className="text-[11px] font-bold text-yellow-400">2%</span>
              </div>
            </div>
          </div>

          {/* Betting panel */}
          <div className="rounded-xl bg-surface-300 p-4">
            {market.phase === "complete" ? (
              <div className="flex flex-col items-center justify-center h-full py-6">
                <p className="text-xs text-gray-500">Round Complete</p>
                <p className={`mt-2 text-3xl font-black ${market.outcome === "up" ? "text-green-400" : "text-red-400"}`}>
                  {market.outcome === "up" ? "↑ UP WINS" : "↓ DOWN WINS"}
                </p>
                {market.finalPrice != null && (
                  <p className="mt-2 text-xs text-gray-500">
                    Close: {formatUsd(market.finalPrice)} &middot; Open: {formatUsd(market.entryPrice)}
                  </p>
                )}
                <p className="mt-3 text-[10px] text-gray-600">Next round starting shortly...</p>
              </div>
            ) : (market.phase === "locked" || market.phase === "resolving" || isLocked) ? (
              <div className="flex flex-col items-center justify-center h-full py-6">
                <svg className="h-8 w-8 text-yellow-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="mt-2 text-sm font-bold text-yellow-400">Bets Locked</p>
                {lockSecondsLeft !== null && (
                  <p className="mt-1 text-3xl font-black tabular-nums text-yellow-400">{lockSecondsLeft}s</p>
                )}
                <p className="mt-1 text-xs text-gray-500">Waiting for round to complete...</p>
              </div>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase text-gray-500 mb-3">Place Your Bet</p>

                {/* Side selector */}
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    onClick={() => setSelectedSide("up")}
                    className={`rounded-xl py-3 text-sm font-black transition-all ${
                      selectedSide === "up"
                        ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                        : "bg-surface-400 text-gray-400 hover:bg-green-500/10 hover:text-green-400"
                    }`}
                  >
                    ↑ UP {upPayout > 0 ? `(${upPayout.toFixed(2)}x)` : ""}
                  </button>
                  <button
                    onClick={() => setSelectedSide("down")}
                    className={`rounded-xl py-3 text-sm font-black transition-all ${
                      selectedSide === "down"
                        ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                        : "bg-surface-400 text-gray-400 hover:bg-red-500/10 hover:text-red-400"
                    }`}
                  >
                    ↓ DOWN {downPayout > 0 ? `(${downPayout.toFixed(2)}x)` : ""}
                  </button>
                </div>

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
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">SOL</span>
                </div>

                {/* Quick amounts */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setBetAmount((prev) => ((parseFloat(prev) || 0) + amt).toString())}
                      className="flex-1 min-w-[40px] rounded-lg bg-surface-400 py-1.5 text-[11px] font-semibold text-gray-400 transition-all hover:bg-surface-400/80 hover:text-white active:scale-95"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>

                {/* Trade button */}
                <button
                  onClick={handleBet}
                  disabled={!betAmount || parseFloat(betAmount) <= 0}
                  className={`w-full rounded-xl py-3.5 text-sm font-black text-white shadow-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${
                    selectedSide === "up"
                      ? "bg-green-500 shadow-green-500/20 hover:bg-green-400"
                      : "bg-red-500 shadow-red-500/20 hover:bg-red-400"
                  }`}
                >
                  {selectedSide === "up" ? "↑" : "↓"} Place {selectedSide.toUpperCase()} Bet
                  {betAmount && parseFloat(betAmount) > 0 ? ` — ${betAmount} SOL` : ""}
                </button>

                <p className="mt-2 text-center text-[9px] text-gray-600">
                  2% platform fee &middot; Resolved by {isCoreAsset ? "Pyth Oracle" : "CoinGecko"}
                </p>
              </>
            )}
          </div>
        </div>

        {/* Activity feed */}
        {market.bets.length > 0 && (
          <div className="border-t border-surface-50/30 px-6 py-4">
            <p className="mb-3 text-[10px] font-semibold uppercase text-gray-500">Live Activity</p>
            <div className="max-h-40 overflow-y-auto space-y-1.5">
              {market.bets
                .slice(-15)
                .reverse()
                .map((bet) => (
                  <div key={bet.id} className="flex items-center justify-between text-xs py-1 border-b border-surface-50/20 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${
                        bet.side === "up" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                      }`}>
                        {bet.side === "up" ? "↑" : "↓"}
                      </span>
                      <span className="text-gray-400 font-mono">{bet.wallet}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-bold ${bet.side === "up" ? "text-green-400" : "text-red-400"}`}>
                        {bet.side.toUpperCase()}
                      </span>
                      <span className="font-semibold text-white">{formatLamports(bet.amount)} SOL</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
