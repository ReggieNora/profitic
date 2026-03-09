"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Market, TradeFormData } from "@/types";
import {
  ammSimulateBuy,
  ammSimulateSell,
  ammYesProbability,
  calculateProtocolFee,
  formatProbability,
  lamportsToSol,
  solToLamports,
} from "@/lib/bondingCurve";
import { PROTOCOL_FEE_PERCENT } from "@/types";

interface TradePanelProps {
  market: Market;
  onTrade?: (trade: TradeFormData) => Promise<void>;
}

export default function TradePanel({ market, onTrade }: TradePanelProps) {
  const { connected } = useWallet();
  const [direction, setDirection] = useState<"buy" | "sell">("buy");
  const [outcome, setOutcome] = useState<"yes" | "no">("yes");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  const amountLamports = solToLamports(amountNum);

  const yesPool = market.yesPool || market.liquidityPool * market.yesPrice;
  const noPool = market.noPool || market.liquidityPool * market.noPrice;

  const ammResult = useMemo(() => {
    if (amountNum <= 0) return null;
    if (direction === "buy") {
      return ammSimulateBuy(yesPool, noPool, outcome, amountLamports);
    } else {
      return ammSimulateSell(yesPool, noPool, outcome, amountLamports);
    }
  }, [amountNum, amountLamports, direction, outcome, yesPool, noPool]);

  const feeBreakdown = useMemo(() => {
    if (amountNum <= 0) return { netAmount: 0, feeAmount: 0 };
    return calculateProtocolFee(amountLamports);
  }, [amountNum, amountLamports]);

  const currentYesPrice = ammYesProbability(yesPool, noPool);
  const currentNoPrice = 1 - currentYesPrice;

  const handleSubmit = useCallback(async () => {
    if (!onTrade || amountNum <= 0) return;
    setLoading(true);
    try {
      await onTrade({ outcome, amount: amountNum, direction });
      setAmount("");
    } catch (err) {
      console.error("Trade failed:", err);
    } finally {
      setLoading(false);
    }
  }, [onTrade, amountNum, outcome, direction]);

  if (market.resolved) {
    return (
      <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-5">
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-400">Market Resolved</p>
          <p className="mt-2 text-3xl font-black">
            <span
              className={
                market.outcome === "yes" ? "text-green-400" : "text-red-400"
              }
            >
              {market.outcome.toUpperCase()}
            </span>
          </p>
        </div>
      </div>
    );
  }

  const isCryptoUpDown = market.marketType === "crypto_updown" && market.cryptoSubtype === "up_down";
  const yesLabel = isCryptoUpDown ? "UP" : "YES";
  const noLabel = isCryptoUpDown ? "DOWN" : "NO";

  return (
    <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-5 space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Trade</h3>

      {/* Direction Toggle */}
      <div className="flex rounded-xl bg-surface-400 p-1">
        {(["buy", "sell"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDirection(d)}
            className={`flex-1 rounded-lg py-2.5 text-sm font-semibold capitalize transition-all duration-200 active:scale-95 ${
              direction === d
                ? d === "buy"
                  ? "bg-green-500/15 text-green-400 shadow-sm"
                  : "bg-red-500/15 text-red-400 shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Outcome Selector */}
      <div>
        <label className="mb-2 block text-xs font-medium text-gray-500">
          Outcome
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setOutcome("yes")}
            className={`rounded-xl border p-3 text-center transition-all duration-200 active:scale-95 ${
              outcome === "yes"
                ? "border-green-500/40 bg-green-500/10 shadow-sm shadow-green-500/10"
                : "border-surface-50/50 bg-surface-400 hover:border-green-500/20"
            }`}
          >
            <div className={`text-sm font-bold ${outcome === "yes" ? "text-green-400" : "text-gray-400"}`}>
              {yesLabel}
            </div>
            <div className={`mt-0.5 text-xs ${outcome === "yes" ? "text-green-400/60" : "text-gray-500"}`}>
              {formatProbability(currentYesPrice)}
            </div>
          </button>
          <button
            onClick={() => setOutcome("no")}
            className={`rounded-xl border p-3 text-center transition-all duration-200 active:scale-95 ${
              outcome === "no"
                ? "border-red-500/40 bg-red-500/10 shadow-sm shadow-red-500/10"
                : "border-surface-50/50 bg-surface-400 hover:border-red-500/20"
            }`}
          >
            <div className={`text-sm font-bold ${outcome === "no" ? "text-red-400" : "text-gray-400"}`}>
              {noLabel}
            </div>
            <div className={`mt-0.5 text-xs ${outcome === "no" ? "text-red-400/60" : "text-gray-500"}`}>
              {formatProbability(currentNoPrice)}
            </div>
          </button>
        </div>
      </div>

      {/* Amount Input */}
      <div>
        <label className="mb-2 block text-xs font-medium text-gray-500">
          {direction === "buy" ? "Shares to Buy" : "Shares to Sell"}
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            min="0"
            step="0.01"
            className="w-full rounded-xl border border-surface-50/50 bg-surface-400 py-3 pl-4 pr-14 text-white placeholder-gray-500 outline-none transition-all focus:border-primary-500/40 focus:ring-2 focus:ring-primary-500/15"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-500">
            SOL
          </span>
        </div>
      </div>

      {/* Estimated Cost with Fee Breakdown */}
      {amountNum > 0 && ammResult && (
        <div className="rounded-xl bg-surface-400/80 p-3.5 space-y-2 animate-fade-in">
          <div className="flex items-center justify-between text-sm">
            <span className="text-xs text-gray-500">Amount</span>
            <span className="font-bold text-white">
              {amountNum.toFixed(4)} SOL
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-xs text-yellow-400/70">Fee ({PROTOCOL_FEE_PERCENT}%)</span>
            <span className="font-semibold text-yellow-400/70">
              -{lamportsToSol(feeBreakdown.feeAmount).toFixed(4)} SOL
            </span>
          </div>
          <div className="flex items-center justify-between text-sm border-t border-white/5 pt-2">
            <span className="text-xs text-gray-500">
              {direction === "buy" ? "Net into Pool" : "Net Return"}
            </span>
            <span className="font-bold text-white">
              {lamportsToSol(feeBreakdown.netAmount).toFixed(4)} SOL
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-xs text-gray-500">New Price</span>
            <span className="font-bold text-white">
              <span className="text-green-400">{(ammResult.yesPrice * 100).toFixed(1)}%</span>
              <span className="text-gray-600 mx-1">/</span>
              <span className="text-red-400">{(ammResult.noPrice * 100).toFixed(1)}%</span>
            </span>
          </div>
        </div>
      )}

      {/* Submit */}
      {connected ? (
        <button
          onClick={handleSubmit}
          disabled={loading || amountNum <= 0}
          className={`w-full rounded-xl py-3.5 font-bold text-white transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
            direction === "buy"
              ? "bg-green-600 hover:bg-green-500 shadow-lg shadow-green-600/20"
              : "bg-red-600 hover:bg-red-500 shadow-lg shadow-red-600/20"
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Processing...
            </span>
          ) : (
            `${direction === "buy" ? "Buy" : "Sell"} ${outcome.toUpperCase()}`
          )}
        </button>
      ) : (
        <div className="flex justify-center">
          <WalletMultiButton />
        </div>
      )}
    </div>
  );
}
