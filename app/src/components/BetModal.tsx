"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Market } from "@/types";
import {
  calculateBuyCost,
  marginalPrice,
  formatProbability,
  lamportsToSol,
  solToLamports,
} from "@/lib/bondingCurve";

interface BetModalProps {
  market: Market;
  side: "yes" | "no";
  open: boolean;
  onClose: () => void;
}

const QUICK_AMOUNTS = [0.1, 0.5, 1, 5];

export default function BetModal({ market, side, open, onClose }: BetModalProps) {
  const { connected } = useWallet();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const amountNum = parseFloat(amount) || 0;
  const amountLamports = solToLamports(amountNum);

  const estimatedCost = useMemo(() => {
    if (amountNum <= 0) return 0;
    return calculateBuyCost(
      market.yesShares,
      market.noShares,
      side,
      amountLamports
    );
  }, [amountNum, amountLamports, side, market.yesShares, market.noShares]);

  const currentPrice = marginalPrice(market.yesShares, market.noShares, side);
  const isYes = side === "yes";

  // Reset amount when modal opens
  useEffect(() => {
    if (open) {
      setAmount("");
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) onClose();
  };

  const handleSubmit = async () => {
    if (amountNum <= 0) return;
    setLoading(true);
    try {
      // In production, this calls the Solana program
      console.log("Bet submitted:", { side, amount: amountNum });
      alert(
        `Bet placed: ${amountNum} SOL on ${side.toUpperCase()}.\n\nIn production, this calls the Solana program.`
      );
      onClose();
    } catch (err) {
      console.error("Bet failed:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div className="absolute bottom-0 left-0 right-0 flex max-h-[85vh] flex-col rounded-t-3xl border-t border-white/10 bg-surface-400/95 backdrop-blur-xl animate-slide-up">
        {/* Handle */}
        <div className="flex items-center justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                isYes ? "bg-green-500/20" : "bg-red-500/20"
              }`}
            >
              <span
                className={`text-sm font-black ${
                  isYes ? "text-green-400" : "text-red-400"
                }`}
              >
                {isYes ? "Y" : "N"}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Buy {side.toUpperCase()}
              </h3>
              <p className="text-xs text-gray-500">
                Current price: {formatProbability(currentPrice)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-gray-400 transition-colors hover:text-white active:scale-90"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Market question */}
        <div className="border-t border-white/5 px-5 py-3">
          <p className="text-sm text-white/70 line-clamp-2">{market.question}</p>
        </div>

        {/* Amount input */}
        <div className="px-5 py-3">
          <label className="mb-2 block text-xs font-medium text-gray-500">
            Amount (SOL)
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              className="w-full rounded-2xl border border-surface-50/50 bg-surface-300 py-4 pl-5 pr-16 text-xl font-bold text-white placeholder-gray-600 outline-none transition-all focus:border-primary-500/40 focus:ring-2 focus:ring-primary-500/15"
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">
              SOL
            </span>
          </div>

          {/* Quick amount buttons */}
          <div className="mt-3 flex gap-2">
            {QUICK_AMOUNTS.map((qa) => (
              <button
                key={qa}
                onClick={() => setAmount(qa.toString())}
                className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-all active:scale-95 ${
                  amount === qa.toString()
                    ? isYes
                      ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/30"
                      : "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                    : "bg-surface-300 text-gray-400 hover:text-white"
                }`}
              >
                {qa} SOL
              </button>
            ))}
          </div>
        </div>

        {/* Cost estimate */}
        {amountNum > 0 && (
          <div className="mx-5 rounded-2xl bg-surface-300/80 p-4 space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Estimated Cost</span>
              <span className="text-sm font-bold text-white">
                {lamportsToSol(estimatedCost).toFixed(4)} SOL
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Avg Price per Share</span>
              <span className="text-sm font-bold text-white">
                {amountLamports > 0
                  ? (estimatedCost / amountLamports).toFixed(4)
                  : "0.0000"}{" "}
                SOL
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Potential Return</span>
              <span className={`text-sm font-bold ${isYes ? "text-green-400" : "text-red-400"}`}>
                {amountNum.toFixed(4)} SOL
              </span>
            </div>
          </div>
        )}

        {/* Submit area */}
        <div className="px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {connected ? (
            <button
              onClick={handleSubmit}
              disabled={loading || amountNum <= 0}
              className={`w-full rounded-2xl py-4 text-lg font-black uppercase tracking-wide text-white transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${
                isYes
                  ? "bg-green-500 shadow-lg shadow-green-500/25 hover:bg-green-400"
                  : "bg-red-500 shadow-lg shadow-red-500/25 hover:bg-red-400"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Processing...
                </span>
              ) : (
                `Place Bet — ${amountNum > 0 ? `${amountNum} SOL` : side.toUpperCase()}`
              )}
            </button>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <p className="text-xs text-gray-500">Connect your wallet to place a bet</p>
              <WalletMultiButton />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
