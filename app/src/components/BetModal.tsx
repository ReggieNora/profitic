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
import { useTrade } from "@/hooks/useTrade";
import { useSolBalance } from "@/hooks/useSolBalance";

interface BetModalProps {
  market: Market;
  side: "yes" | "no";
  open: boolean;
  onClose: () => void;
}

const QUICK_AMOUNTS = [0.1, 0.5, 1, 5];
const QUICK_AMOUNTS_CRYPTO = [
  { label: "+0.1", value: 0.1 },
  { label: "+0.5", value: 0.5 },
  { label: "+1", value: 1 },
  { label: "+5", value: 5 },
  { label: "Max", value: -1 },
];

export default function BetModal({ market, side, open, onClose }: BetModalProps) {
  const { connected } = useWallet();
  const [amount, setAmount] = useState("");
  const [outcome, setOutcome] = useState<"yes" | "no">(side);
  const [loading, setLoading] = useState(false);
  const [txResult, setTxResult] = useState<{ success: boolean; message: string; txSignature?: string } | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { buyShares, error: tradeError, clearError } = useTrade();
  const { refresh: refreshBalance } = useSolBalance();

  const isCryptoUpDown = market.marketType === "crypto_updown" && market.cryptoSubtype === "up_down";
  const activeSide = isCryptoUpDown ? outcome : side;
  const isYes = activeSide === "yes";

  const amountNum = parseFloat(amount) || 0;
  const amountLamports = solToLamports(amountNum);

  const yesPool = market.yesPool || market.liquidityPool * market.yesPrice;
  const noPool = market.noPool || market.liquidityPool * market.noPrice;

  const ammResult = useMemo(() => {
    if (amountNum <= 0) return null;
    return ammSimulateBuy(yesPool, noPool, activeSide, amountLamports);
  }, [amountNum, amountLamports, activeSide, yesPool, noPool]);

  const feeBreakdown = useMemo(() => {
    if (amountNum <= 0) return { netAmount: 0, feeAmount: 0 };
    return calculateProtocolFee(amountLamports);
  }, [amountNum, amountLamports]);

  const currentYesPrice = ammYesProbability(yesPool, noPool);
  const currentNoPrice = 1 - currentYesPrice;
  const displayPrice = isYes ? currentYesPrice : currentNoPrice;

  const upCents = Math.round(currentYesPrice * 100);
  const downCents = Math.round(currentNoPrice * 100);

  const sideLabel = isCryptoUpDown ? (isYes ? "UP" : "DOWN") : side.toUpperCase();
  const yesLabel = isCryptoUpDown ? "Up" : "Yes";
  const noLabel = isCryptoUpDown ? "Down" : "No";

  // Reset amount when modal opens and sync outcome with side
  useEffect(() => {
    if (open) {
      setAmount("");
      setOutcome(side);
      setLoading(false);
      setTxResult(null);
      clearError();
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [open, side, clearError]);

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

  const handleQuickAdd = (value: number) => {
    if (value === -1) {
      setAmount("10");
      return;
    }
    const current = parseFloat(amount) || 0;
    setAmount((current + value).toString());
  };

  const handleSubmit = async () => {
    if (amountNum <= 0) return;
    setLoading(true);
    setTxResult(null);
    clearError();
    try {
      const result = await buyShares(market.publicKey, activeSide, amountNum);
      if (result.success) {
        setTxResult({
          success: true,
          message: `Bet placed! ${amountNum} SOL on ${sideLabel}`,
          txSignature: result.txSignature,
        });
        refreshBalance();
        // Auto-close after showing success
        setTimeout(() => onClose(), 2000);
      } else {
        setTxResult({
          success: false,
          message: result.error || "Transaction failed",
        });
      }
    } catch (err) {
      console.error("Bet failed:", err);
      setTxResult({
        success: false,
        message: err instanceof Error ? err.message : "Transaction failed",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  // ---------------------------------------------------------------------------
  // Polymarket-style modal for Crypto Up/Down
  // ---------------------------------------------------------------------------
  if (isCryptoUpDown) {
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

          {/* Header with close */}
          <div className="flex items-center justify-between px-5 pb-2 md:pt-5">
            <p className="text-sm text-white/70 line-clamp-2 flex-1 pr-3">{market.question}</p>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-gray-400 transition-colors hover:text-white active:scale-90"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto px-5 pb-5 space-y-4">
            {/* Buy / Sell toggle */}
            <div className="flex items-center justify-between">
              <div className="flex rounded-lg bg-surface-300 p-0.5">
                {(["buy", "sell"] as const).map((d) => (
                  <button
                    key={d}
                    className={`rounded-md px-4 py-1.5 text-sm font-semibold capitalize transition-all ${
                      d === "buy"
                        ? "bg-surface-400 text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
              <span className="rounded-md bg-surface-300 px-3 py-1.5 text-xs font-medium text-gray-500">
                Market
              </span>
            </div>

            {/* Up / Down outcome buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setOutcome("yes")}
                className={`rounded-xl py-3 text-center text-sm font-bold transition-all active:scale-95 ${
                  outcome === "yes"
                    ? "bg-green-500 text-white shadow-lg shadow-green-500/20"
                    : "bg-surface-300 text-gray-400 hover:bg-surface-300/80"
                }`}
              >
                {yesLabel} {upCents}&cent;
              </button>
              <button
                onClick={() => setOutcome("no")}
                className={`rounded-xl py-3 text-center text-sm font-bold transition-all active:scale-95 ${
                  outcome === "no"
                    ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                    : "bg-surface-300 text-gray-400 hover:bg-surface-300/80"
                }`}
              >
                {noLabel} {downCents}&cent;
              </button>
            </div>

            {/* Amount display */}
            <div>
              <p className="mb-1 text-sm font-medium text-gray-400">Amount</p>
              <div className="relative">
                <input
                  ref={inputRef}
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  min="0"
                  step="0.01"
                  className="w-full rounded-xl border border-surface-50/50 bg-surface-300 py-4 pl-5 pr-16 text-right text-3xl font-black tabular-nums text-white placeholder-gray-700 outline-none transition-all focus:border-primary-500/40"
                />
                <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-500">
                  SOL
                </span>
              </div>
            </div>

            {/* Quick amount buttons */}
            <div className="flex gap-2">
              {QUICK_AMOUNTS_CRYPTO.map((qa) => (
                <button
                  key={qa.label}
                  onClick={() => handleQuickAdd(qa.value)}
                  className="flex-1 rounded-lg bg-surface-300 py-2 text-xs font-semibold text-gray-400 transition-all hover:bg-surface-300/80 hover:text-white active:scale-95"
                >
                  {qa.label}
                </button>
              ))}
            </div>

            {/* Cost estimate (compact) */}
            {amountNum > 0 && ammResult && (
              <div className="rounded-xl bg-surface-300/60 p-3 space-y-1.5 animate-fade-in text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Fee ({PROTOCOL_FEE_PERCENT}%)</span>
                  <span className="text-yellow-400/70">-{lamportsToSol(feeBreakdown.feeAmount).toFixed(4)} SOL</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">New probability</span>
                  <span className="text-white">
                    <span className="text-green-400">{yesLabel} {(ammResult.yesPrice * 100).toFixed(0)}%</span>
                    {" / "}
                    <span className="text-red-400">{noLabel} {(ammResult.noPrice * 100).toFixed(0)}%</span>
                  </span>
                </div>
              </div>
            )}

            {/* Transaction result feedback */}
            {txResult && (
              <div
                className={`rounded-xl p-3 text-sm font-medium animate-fade-in ${
                  txResult.success
                    ? "bg-green-500/15 text-green-400 border border-green-500/20"
                    : "bg-red-500/15 text-red-400 border border-red-500/20"
                }`}
              >
                <p>{txResult.message}</p>
                {txResult.txSignature && (
                  <a
                    href={`https://explorer.solana.com/tx/${txResult.txSignature}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-xs text-primary-400 hover:underline"
                  >
                    View on Solana Explorer
                  </a>
                )}
              </div>
            )}

            {/* Trade button */}
            {connected ? (
              <button
                onClick={handleSubmit}
                disabled={loading || amountNum <= 0}
                className="w-full rounded-xl bg-primary-500 py-4 text-base font-bold text-white transition-all duration-200 hover:bg-primary-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 shadow-lg shadow-primary-500/20"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Sending transaction...
                  </span>
                ) : (
                  "Trade"
                )}
              </button>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-gray-500">Connect your wallet to trade</p>
                <WalletMultiButton />
              </div>
            )}

            <p className="text-center text-[10px] text-gray-600">
              By trading, you agree to the Terms of Use.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Standard prediction market modal (unchanged)
  // ---------------------------------------------------------------------------
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
                {isYes ? "Y" : "N"}
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

        {/* Transaction result feedback */}
        {txResult && (
          <div className="px-5">
            <div
              className={`rounded-2xl p-3 text-sm font-medium animate-fade-in ${
                txResult.success
                  ? "bg-green-500/15 text-green-400 border border-green-500/20"
                  : "bg-red-500/15 text-red-400 border border-red-500/20"
              }`}
            >
              <p>{txResult.message}</p>
              {txResult.txSignature && (
                <a
                  href={`https://explorer.solana.com/tx/${txResult.txSignature}?cluster=devnet`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 block text-xs text-primary-400 hover:underline"
                >
                  View on Solana Explorer
                </a>
              )}
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
                  Sending transaction...
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
