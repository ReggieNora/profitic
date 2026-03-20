"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { BinaryMarket } from "@/hooks/useBinaryMarkets";
import { CryptoLogo } from "./CryptoLogos";

interface Props {
  market: BinaryMarket;
  livePrice: number;
  onBet: (side: "up" | "down", amount: number) => void;
  userBetSide?: "up" | "down" | null;
  userBetAmount?: number; // lamports
}

const QUICK_AMOUNTS = [0.1, 0.5, 1, 5];

function formatLamports(l: number): string {
  const sol = l / 1_000_000_000;
  if (sol >= 1000) return `${(sol / 1000).toFixed(1)}k`;
  if (sol >= 1) return sol.toFixed(1);
  return sol.toFixed(3);
}

interface PricePoint { time: string; price: number }

const JITTER_MAP: Record<string, number> = { BTC: 3, ETH: 5, SOL: 8 };

function jitteredPrice(base: number, symbol: string): number {
  const bps = JITTER_MAP[symbol] ?? 12;
  return base * (1 + (Math.random() - 0.5) * 2 * (bps / 10000));
}

export default function BinaryMarketCard({ market, livePrice, onBet, userBetSide, userBetAmount }: Props) {
  const [betAmount, setBetAmount] = useState("");
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const [countdown, setCountdown] = useState("");
  const [confirmFlash, setConfirmFlash] = useState<"up" | "down" | null>(null);
  const driftRef = useRef(0);
  const lastApiPrice = useRef(0);

  const { asset } = market;
  const currentPrice = livePrice > 0 ? livePrice : market.entryPrice;
  const displayPrice = priceHistory.length > 0 ? priceHistory[priceHistory.length - 1].price : currentPrice;
  const isAboveEntry = displayPrice >= market.entryPrice;
  const changePct = market.entryPrice > 0 ? ((displayPrice - market.entryPrice) / market.entryPrice) * 100 : 0;
  const isCoreAsset = asset.type === "core" && (asset.symbol === "BTC" || asset.symbol === "ETH" || asset.symbol === "SOL");

  // Pool calcs
  const upSol = market.upPool / 1_000_000_000;
  const downSol = market.downPool / 1_000_000_000;
  const totalSol = upSol + downSol;
  const upPayout = downSol > 0 ? (totalSol * 0.98) / upSol : 0;
  const downPayout = upSol > 0 ? (totalSol * 0.98) / downSol : 0;
  const upPct = totalSol > 0 ? (upSol / totalSol) * 100 : 50;

  // Countdown with lock detection
  const [isLocked, setIsLocked] = useState(false);
  const [lockSecondsLeft, setLockSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      const remaining = Math.max(0, market.endTime - now);
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      setCountdown(`${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);

      // PHASE 3: detect lock period (last 10 seconds)
      const locked = now >= market.lockTime && remaining > 0;
      setIsLocked(locked);
      setLockSecondsLeft(locked ? remaining : null);
    };
    tick();
    const iv = setInterval(tick, 200);
    return () => clearInterval(iv);
  }, [market.endTime, market.lockTime]);

  // Reset chart on new round
  useEffect(() => {
    setPriceHistory([]);
    lastApiPrice.current = 0;
    driftRef.current = 0;
  }, [market.id]);

  // Price history for mini chart
  useEffect(() => {
    if (currentPrice <= 0) return;
    if (currentPrice !== lastApiPrice.current) {
      lastApiPrice.current = currentPrice;
      driftRef.current = currentPrice;
    }
    const addPoint = () => {
      const base = driftRef.current || currentPrice;
      const jp = jitteredPrice(base, asset.symbol);
      driftRef.current = jp;
      const now = new Date();
      const time = `${now.getMinutes()}:${now.getSeconds().toString().padStart(2, "0")}`;
      setPriceHistory((prev) => [...prev, { time, price: jp }].slice(-80));
    };
    addPoint();
    const iv = setInterval(addPoint, 2000);
    return () => clearInterval(iv);
  }, [currentPrice, asset.symbol, market.id]);

  // Chart domain
  const prices = priceHistory.map((p) => p.price);
  prices.push(market.entryPrice);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP;
  const pad = range > 0 ? range * 0.2 : maxP * 0.001 || 1;

  // PHASE 3: betting is only allowed when OPEN and NOT in lock period
  const isBettingOpen = market.phase === "betting" && !isLocked;

  const handleBet = (side: "up" | "down") => {
    const amt = parseFloat(betAmount) || 0;
    if (amt <= 0 || !isBettingOpen) return;
    onBet(side, amt);
    setBetAmount("");
    setConfirmFlash(side);
    setTimeout(() => setConfirmFlash(null), 3000);
  };

  const formatUsd = (v: number) => {
    if (v >= 10000) return `$${(v / 1000).toFixed(1)}k`;
    if (v >= 1) return `$${v.toFixed(2)}`;
    if (v >= 0.01) return `$${v.toFixed(4)}`;
    return `$${v.toFixed(8)}`;
  };

  return (
    <div className="rounded-2xl border border-surface-50/50 bg-surface-300 overflow-hidden transition-all hover:border-primary-500/20">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-surface-50/30 px-4 py-2.5">
        <div className="flex items-center gap-2.5">
          {/* Asset icon */}
          {isCoreAsset ? (
            <CryptoLogo asset={asset.symbol as "BTC" | "ETH" | "SOL"} size={28} />
          ) : asset.logoUrl ? (
            <img src={asset.logoUrl} alt={asset.symbol} className="h-7 w-7 rounded-full" />
          ) : (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black text-white"
              style={{ backgroundColor: asset.color }}
            >
              {asset.symbol.slice(0, 2)}
            </div>
          )}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white">{asset.symbol}</span>
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-bold text-white/50">
                {market.intervalLabel.toUpperCase()}
              </span>
            </div>
            <span className="text-[10px] text-gray-500">{asset.name}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {market.phase === "betting" && !isLocked && (
            <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[9px] font-bold text-green-400">
              <span className="h-1 w-1 rounded-full bg-green-400 animate-pulse" />
              OPEN
            </span>
          )}
          {(market.phase === "locked" || (market.phase === "betting" && isLocked)) && (
            <span className="flex items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-0.5 text-[9px] font-bold text-yellow-400">
              LOCKED {lockSecondsLeft !== null && <span className="tabular-nums">{lockSecondsLeft}s</span>}
            </span>
          )}
          {market.phase === "complete" && (
            <span className="rounded-full bg-gray-500/15 px-2 py-0.5 text-[9px] font-bold text-gray-400">
              SETTLED
            </span>
          )}
          {market.phase !== "complete" && (
            <span className="rounded-full bg-surface-400 px-2.5 py-1 text-xs font-black tabular-nums text-white">
              {countdown}
            </span>
          )}
        </div>
      </div>

      {/* Mini chart + price */}
      <div className="relative">
        <div className="h-28 w-full">
          {priceHistory.length < 2 ? (
            <div className="flex h-full items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={priceHistory} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={`g-${market.id}-up`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id={`g-${market.id}-dn`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
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
                    fontSize: 10,
                    color: "#fff",
                  }}
                  formatter={(v: number | string) => [formatUsd(Number(v)), asset.symbol]}
                />
                <ReferenceLine y={market.entryPrice} stroke="#6b7280" strokeDasharray="4 3" strokeWidth={1} />
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke={isAboveEntry ? "#10b981" : "#ef4444"}
                  strokeWidth={2}
                  fill={isAboveEntry ? `url(#g-${market.id}-up)` : `url(#g-${market.id}-dn)`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
        {/* Price overlay */}
        <div className="absolute left-4 top-2 flex items-center gap-2">
          <span className="text-lg font-black tabular-nums text-white drop-shadow-lg">
            {formatUsd(displayPrice)}
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              isAboveEntry ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
            }`}
          >
            {isAboveEntry ? "+" : ""}{changePct.toFixed(3)}%
          </span>
        </div>
        <div className="absolute right-4 top-3 text-[9px] text-gray-600">
          Entry: {formatUsd(market.entryPrice)}
        </div>
      </div>

      {/* Pool bar */}
      <div className="mx-4 my-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-green-400">
            UP {formatLamports(market.upPool)} SOL
          </span>
          <span className="text-[10px] font-bold text-white/40">{formatLamports(market.totalPool)} SOL</span>
          <span className="text-[10px] font-bold text-red-400">
            DOWN {formatLamports(market.downPool)} SOL
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-red-500/30">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-500"
            style={{ width: `${upPct}%` }}
          />
        </div>
      </div>

      {/* Bet confirmation flash */}
      {confirmFlash && (
        <div className={`mx-4 mb-2 rounded-xl p-2.5 text-center animate-pulse ${
          confirmFlash === "up"
            ? "border border-green-500/30 bg-green-500/10"
            : "border border-red-500/30 bg-red-500/10"
        }`}>
          <p className={`text-xs font-bold ${confirmFlash === "up" ? "text-green-400" : "text-red-400"}`}>
            Bet placed — {confirmFlash.toUpperCase()}
          </p>
        </div>
      )}

      {/* Active bet indicator */}
      {userBetSide && !confirmFlash && market.phase !== "complete" && (
        <div className={`mx-4 mb-2 flex items-center justify-between rounded-xl px-3 py-2 ${
          userBetSide === "up"
            ? "border border-green-500/20 bg-green-500/5"
            : "border border-red-500/20 bg-red-500/5"
        }`}>
          <span className={`text-[10px] font-bold ${userBetSide === "up" ? "text-green-400" : "text-red-400"}`}>
            Your bet: {userBetSide.toUpperCase()}
          </span>
          <span className="text-[10px] font-bold text-white/60">
            {userBetAmount ? formatLamports(userBetAmount) : "—"} SOL
          </span>
        </div>
      )}

      {/* Betting UI or result */}
      <div className="px-4 pb-4">
        {market.phase === "complete" ? (
          <div className="rounded-xl bg-surface-400/60 p-3 text-center">
            <p className={`text-xl font-black ${market.outcome === "up" ? "text-green-400" : "text-red-400"}`}>
              {market.outcome === "up" ? "UP WINS" : "DOWN WINS"}
            </p>
            {market.finalPrice != null && (
              <p className="mt-0.5 text-[10px] text-gray-500">
                Final: {formatUsd(market.finalPrice)} vs Entry: {formatUsd(market.entryPrice)}
              </p>
            )}
            <p className="mt-1 text-[10px] text-gray-600">Next round starting...</p>
          </div>
        ) : (market.phase === "locked" || market.phase === "resolving" || isLocked) ? (
          <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-3 text-center">
            <p className="text-xs font-bold text-yellow-400">Bets Locked</p>
            {lockSecondsLeft !== null && (
              <p className="mt-1 text-2xl font-black tabular-nums text-yellow-400">{lockSecondsLeft}s</p>
            )}
            <p className="text-[10px] text-gray-500">Resolving at expiry via Pyth Oracle...</p>
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
                className="w-full rounded-xl border border-surface-50/50 bg-surface-400 py-2.5 pl-4 pr-14 text-right text-lg font-black tabular-nums text-white placeholder-gray-700 outline-none focus:border-primary-500/40"
                onClick={(e) => e.stopPropagation()}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">SOL</span>
            </div>

            {/* Quick amounts */}
            <div className="flex gap-1 mb-2">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  onClick={(e) => { e.stopPropagation(); setBetAmount((prev) => ((parseFloat(prev) || 0) + amt).toString()); }}
                  className="flex-1 rounded-lg bg-surface-400 py-1 text-[10px] font-semibold text-gray-400 hover:bg-surface-400/80 hover:text-white active:scale-95"
                >
                  +{amt}
                </button>
              ))}
            </div>

            {/* UP / DOWN */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleBet("up"); }}
                disabled={!betAmount || parseFloat(betAmount) <= 0}
                className="rounded-xl bg-green-500 py-3 text-sm font-black text-white shadow-lg shadow-green-500/20 hover:bg-green-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                UP {upPayout > 0 ? `${upPayout.toFixed(2)}x` : ""}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleBet("down"); }}
                disabled={!betAmount || parseFloat(betAmount) <= 0}
                className="rounded-xl bg-red-500 py-3 text-sm font-black text-white shadow-lg shadow-red-500/20 hover:bg-red-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                DOWN {downPayout > 0 ? `${downPayout.toFixed(2)}x` : ""}
              </button>
            </div>
            <p className="mt-1.5 text-center text-[9px] text-gray-600">
              2% fee &middot; Pyth Oracle settlement
            </p>
          </>
        )}
      </div>
    </div>
  );
}
