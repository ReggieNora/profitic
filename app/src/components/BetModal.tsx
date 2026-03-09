"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Market } from "@/types";
import {
  ammSimulateBuy,
  calculateProtocolFee,
  formatProbability,
  lamportsToSol,
  solToLamports,
  ammYesProbability,
} from "@/lib/bondingCurve";
import { PROTOCOL_FEE_PERCENT } from "@/types";

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

  const ammResult = useMemo(() => {
    if (amountNum <= 0) return null;
    return ammSimulateBuy(
      market.yesPool || market.liquidityPool * market.yesPrice,
      market.noPool || market.liquidityPool * market.noPrice,
      side,
      amountLamports
    );
  }, [amountNum, amountLamports, side, market.yesPool, market.noPool, market.liquidityPool, market.yesPrice, market.noPrice]);

  const feeBreakdown = useMemo(() => {
    if (amountNum <= 0) return { netAmount: 0, feeAmount: 0 };
    return calculateProtocolFee(amountLamports);
  }, [amountNum, amountLamports]);

  const currentPrice = ammYesProbability(
    market.yesPool || market.liquidityPool * market.yesPrice,
    market.noPool || market.liquidityPool * market.noPrice,
  );
  const displayPrice = side === "yes" ? currentPrice : 1 - currentPrice;
  const isYes = side === "yes";
  const isCryptoUpDown = market.marketType === "crypto_updown" && market.cryptoSubtype === "up_down";
  const sideLabel = isCryptoUpDown ? (isYes ? "UP" : "DOWN") : side.toUpperCase();

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
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in md:items-center md:p-6"
    >
      <div className="flex max-h-[85vh] w-full flex-col rounded-t-3xl border-t border-white/10 bg-surface-400/95 backdrop-blur-xl animate-slide-up md:max-w-md md:rounded-3xl md:border md:shadow-2xl md:shadow-black/50">
        {/* Handle — mobile only */}
        <div className="flex items-center justify-center pt-3 pb-1 md:hidden">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pb-3 md:pt-5">
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
                {isCryptoUpDown ? (isYes ? "\u2191" : "\u2193") : (isYes ? "Y" : "N")}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                Buy {sideLabel}
              </h3>
              <p className="text-xs text-gray-500">
                Current price: {formatProbability(displayPrice)}
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
        {amountNum > 0 && ammResult && (
          <div className="mx-5 rounded-2xl bg-surface-300/80 p-4 space-y-2.5 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Your Bet</span>
              <span className="text-sm font-bold text-white">
                {amountNum.toFixed(4)} SOL
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-yellow-400/70">Protocol Fee ({PROTOCOL_FEE_PERCENT}%)</span>
              <span className="text-sm font-semibold text-yellow-400/70">
                -{lamportsToSol(feeBreakdown.feeAmount).toFixed(4)} SOL
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Net into Pool</span>
              <span className="text-sm font-bold text-white">
                {lamportsToSol(feeBreakdown.netAmount).toFixed(4)} SOL
              </span>
            </div>
            <div className="border-t border-white/5 pt-2 flex items-center justify-between">
              <span className="text-xs text-gray-500">New Probability</span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-green-400">
                  YES {(ammResult.yesPrice * 100).toFixed(1)}%
                </span>
                <span className="text-[10px] text-gray-600">/</span>
                <span className="text-xs font-bold text-red-400">
                  NO {(ammResult.noPrice * 100).toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Potential Return</span>
              <span className={`text-sm font-bold ${isYes ? "text-green-400" : "text-red-400"}`}>
                {lamportsToSol(ammResult.netAmount).toFixed(4)} SOL
              </span>
            </div>
          </div>
        )}

        {/* Submit area */}
        <div className="px-5 py-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:pb-5">
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
