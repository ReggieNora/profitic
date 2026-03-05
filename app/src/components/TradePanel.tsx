"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Market, TradeFormData } from "@/types";
import {
  calculateBuyCost,
  calculateSellReturn,
  marginalPrice,
  formatProbability,
  lamportsToSol,
  solToLamports,
} from "@/lib/bondingCurve";

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

  const estimatedCost = useMemo(() => {
    if (amountNum <= 0) return 0;
    if (direction === "buy") {
      return calculateBuyCost(
        market.yesShares,
        market.noShares,
        outcome,
        amountLamports
      );
    } else {
      return calculateSellReturn(
        market.yesShares,
        market.noShares,
        outcome,
        amountLamports
      );
    }
  }, [amountNum, amountLamports, direction, outcome, market.yesShares, market.noShares]);

  const currentYesPrice = marginalPrice(market.yesShares, market.noShares, "yes");
  const currentNoPrice = marginalPrice(market.yesShares, market.noShares, "no");

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
      <div className="card">
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-400">Market Resolved</p>
          <p className="mt-2 text-2xl font-bold">
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

  return (
    <div className="card space-y-5">
      <h3 className="text-lg font-semibold text-white">Trade</h3>

      {/* Direction Toggle */}
      <div className="flex rounded-lg bg-surface-400 p-1">
        {(["buy", "sell"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDirection(d)}
            className={`flex-1 rounded-md py-2 text-sm font-semibold capitalize transition-colors ${
              direction === d
                ? d === "buy"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-red-500/20 text-red-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      {/* Outcome Selector */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-400">
          Outcome
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setOutcome("yes")}
            className={`rounded-lg border px-4 py-3 text-center font-semibold transition-all ${
              outcome === "yes"
                ? "border-green-500/50 bg-green-500/10 text-green-400"
                : "border-surface-50 bg-surface-400 text-gray-400 hover:border-green-500/30"
            }`}
          >
            <div className="text-lg">YES</div>
            <div className="text-xs opacity-75">
              {formatProbability(currentYesPrice)}
            </div>
          </button>
          <button
            onClick={() => setOutcome("no")}
            className={`rounded-lg border px-4 py-3 text-center font-semibold transition-all ${
              outcome === "no"
                ? "border-red-500/50 bg-red-500/10 text-red-400"
                : "border-surface-50 bg-surface-400 text-gray-400 hover:border-red-500/30"
            }`}
          >
            <div className="text-lg">NO</div>
            <div className="text-xs opacity-75">
              {formatProbability(currentNoPrice)}
            </div>
          </button>
        </div>
      </div>

      {/* Amount Input */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-400">
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
            className="input-field pr-14"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">
            SOL
          </span>
        </div>
      </div>

      {/* Estimated Cost */}
      {amountNum > 0 && (
        <div className="rounded-lg bg-surface-400 p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">
              {direction === "buy" ? "Estimated Cost" : "Estimated Return"}
            </span>
            <span className="font-semibold text-white">
              {lamportsToSol(estimatedCost).toFixed(4)} SOL
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Avg Price per Share</span>
            <span className="font-semibold text-white">
              {amountLamports > 0
                ? (estimatedCost / amountLamports).toFixed(4)
                : "0.0000"}{" "}
              SOL
            </span>
          </div>
        </div>
      )}

      {/* Submit */}
      {connected ? (
        <button
          onClick={handleSubmit}
          disabled={loading || amountNum <= 0}
          className={`w-full rounded-lg py-3 font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50 ${
            direction === "buy"
              ? "bg-green-600 hover:bg-green-500"
              : "bg-red-600 hover:bg-red-500"
          }`}
        >
          {loading
            ? "Processing..."
            : `${direction === "buy" ? "Buy" : "Sell"} ${outcome.toUpperCase()} Shares`}
        </button>
      ) : (
        <div className="flex justify-center">
          <WalletMultiButton />
        </div>
      )}
    </div>
  );
}
