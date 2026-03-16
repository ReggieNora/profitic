"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMarket } from "@/hooks/useMarket";
import { useTrade } from "@/hooks/useTrade";
import { useSolBalance } from "@/hooks/useSolBalance";
import TradePanel from "@/components/TradePanel";
import BondingCurveChart from "@/components/BondingCurveChart";
import CryptoPriceChart from "@/components/CryptoPriceChart";
import CommentSection from "@/components/CommentSection";
import { formatProbability, lamportsToSol, formatSol } from "@/lib/bondingCurve";
import { Trade, TradeFormData } from "@/types";

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function MarketDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const { market, trades, loading, error, refetch } = useMarket(id);
  const { buyShares, sellShares, loading: tradeLoading, error: tradeError } = useTrade();
  const { refresh: refreshBalance } = useSolBalance();
  const [tradeResult, setTradeResult] = useState<{ success: boolean; message: string; txSignature?: string } | null>(null);

  const handleTrade = async (trade: TradeFormData) => {
    if (!market) return;
    setTradeResult(null);

    let result;
    if (trade.direction === "buy") {
      result = await buyShares(market.publicKey, trade.outcome, trade.amount);
    } else {
      result = await sellShares(market.publicKey, trade.outcome, trade.amount);
    }

    if (result.success) {
      setTradeResult({
        success: true,
        message: `${trade.direction === "buy" ? "Bought" : "Sold"} ${trade.amount} SOL of ${trade.outcome.toUpperCase()}`,
        txSignature: result.txSignature,
      });
      refreshBalance();
      refetch();
    } else {
      setTradeResult({
        success: false,
        message: result.error || "Transaction failed",
      });
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-8 sm:max-w-7xl sm:px-6">
        <div className="space-y-4">
          <div className="skeleton h-8 w-3/4" />
          <div className="skeleton h-5 w-1/2" />
          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <div className="skeleton h-24" />
            <div className="skeleton h-24" />
            <div className="skeleton h-24" />
            <div className="skeleton h-24" />
          </div>
          <div className="skeleton mt-4 h-64" />
        </div>
      </div>
    );
  }

  if (!market) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400 animate-fade-up">
        <p className="text-lg font-medium">Market not found</p>
        <p className="mt-1 text-sm">{error || "The market you are looking for does not exist."}</p>
        <Link href="/" className="mt-4 text-sm text-primary-400 hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  const yesPercent = Math.round(market.yesPrice * 100);
  const noPercent = Math.round(market.noPrice * 100);
  const isCryptoUpDown = market.marketType === "crypto_updown";
  const isUpDown = isCryptoUpDown && market.cryptoSubtype === "up_down";
  const yesLabel = isUpDown ? "Up" : "Yes";
  const noLabel = isUpDown ? "Down" : "No";

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-24 sm:max-w-7xl sm:px-6 md:pb-6 lg:px-8">
      {/* Back button */}
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-white"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </Link>

      {/* Header */}
      <div className="mb-6 animate-fade-up">
        <div className="mb-3 flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              market.resolved
                ? "bg-gray-500/15 text-gray-400"
                : "bg-green-500/15 text-green-400"
            }`}
          >
            {market.resolved ? "Resolved" : "Active"}
          </span>
          <span className="text-xs text-gray-500">
            by {shortenAddress(market.creator)}
          </span>
        </div>
        <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl">
          {market.question}
        </h1>
        <p className="mt-2 text-sm text-gray-400 leading-relaxed">{market.description}</p>
      </div>

      {/* Crypto market info banner */}
      {isCryptoUpDown && (
        <div className="mb-4 flex flex-wrap items-center gap-2 animate-fade-up" style={{ animationDelay: "40ms" }}>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-500/15 px-3 py-1 text-xs font-bold text-primary-400">
            {market.cryptoAsset} {market.cryptoSubtype === "up_down" ? "Up/Down" : "Price Target"}
          </span>
          {market.cryptoTimeframe && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/70">
              {market.cryptoTimeframe}
            </span>
          )}
          {market.startPrice && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/60">
              Start: ${market.startPrice.toLocaleString()}
            </span>
          )}
          {market.strikePrice && (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-400">
              Target: ${market.strikePrice.toLocaleString()}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1 rounded-full bg-primary-500/10 px-2 py-0.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary-400" />
            <span className="text-[9px] font-bold text-primary-400">{market.oracleSource || "Pyth"}</span>
          </span>
        </div>
      )}

      {/* Trade result banner */}
      {tradeResult && (
        <div
          className={`mb-4 rounded-2xl p-4 text-sm font-medium animate-fade-up ${
            tradeResult.success
              ? "bg-green-500/15 text-green-400 border border-green-500/20"
              : "bg-red-500/15 text-red-400 border border-red-500/20"
          }`}
        >
          <div className="flex items-center justify-between">
            <p>{tradeResult.message}</p>
            <button
              onClick={() => setTradeResult(null)}
              className="ml-3 text-gray-400 hover:text-white"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {tradeResult.txSignature && (
            <a
              href={`https://explorer.solana.com/tx/${tradeResult.txSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-xs text-primary-400 hover:underline"
            >
              View on Solana Explorer
            </a>
          )}
        </div>
      )}

      {/* Big probability display - mobile first */}
      <div className="mb-6 flex gap-3 animate-fade-up" style={{ animationDelay: "60ms" }}>
        <div className="flex-1 overflow-hidden rounded-2xl border border-green-500/20 bg-green-500/5 p-4 text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-green-400/70">{yesLabel}</div>
          <div className="mt-1 text-3xl font-black tabular-nums text-green-400">
            {yesPercent}<span className="text-lg font-bold">%</span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-red-400/70">{noLabel}</div>
          <div className="mt-1 text-3xl font-black tabular-nums text-red-400">
            {noPercent}<span className="text-lg font-bold">%</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 animate-fade-up" style={{ animationDelay: "120ms" }}>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-4 text-center">
          <p className="text-xs font-medium text-gray-500">Volume</p>
          <p className="mt-1 text-lg font-bold text-white">
            {formatSol(lamportsToSol(market.totalVolume))}
          </p>
        </div>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-4 text-center">
          <p className="text-xs font-medium text-gray-500">Total Liquidity</p>
          <p className="mt-1 text-lg font-bold text-white">
            {formatSol(lamportsToSol(
              (market.yesPool || 0) + (market.noPool || 0) || market.liquidityPool
            ))}
          </p>
        </div>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-4 text-center">
          <p className="text-xs font-medium text-gray-500">Fees Collected</p>
          <p className="mt-1 text-lg font-bold text-yellow-400">
            {formatSol(lamportsToSol(market.feesCollected || 0))}
          </p>
        </div>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-4 text-center">
          <p className="text-xs font-medium text-gray-500">Resolves</p>
          <p className="mt-1 text-sm font-bold text-white">
            {formatDate(market.resolutionDate)}
          </p>
        </div>
      </div>

      {/* Chart + Trade Panel */}
      <div className="mb-6 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 animate-fade-up" style={{ animationDelay: "180ms" }}>
          {isCryptoUpDown ? (
            <CryptoPriceChart market={market} />
          ) : (
            <BondingCurveChart
              yesShares={market.yesShares}
              noShares={market.noShares}
            />
          )}
        </div>
        <div className="animate-fade-up" style={{ animationDelay: "240ms" }}>
          <TradePanel market={market} onTrade={handleTrade} />
        </div>
      </div>

      {/* Market Info */}
      <div className="mb-6 rounded-2xl border border-surface-50/50 bg-surface-300 p-5 animate-fade-up">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Market Details
        </h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs text-gray-500">Data Source</dt>
            <dd className="mt-1">
              <a
                href={market.dataSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent-400 hover:underline break-all"
              >
                {market.dataSourceUrl}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Market Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                market.status === "active" || !market.status
                  ? "bg-green-500/15 text-green-400"
                  : market.status === "funding"
                  ? "bg-blue-500/15 text-blue-400"
                  : market.status === "resolved"
                  ? "bg-gray-500/15 text-gray-400"
                  : "bg-yellow-500/15 text-yellow-400"
              }`}>
                {market.status === "active" ? "Active - Trading Open" :
                 market.status === "funding" ? "Funding - Awaiting Liquidity" :
                 market.status === "resolved" ? "Resolved" :
                 (market.status || "active").toUpperCase()}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">{yesLabel.toUpperCase()} Pool</dt>
            <dd className="mt-1 text-sm font-medium text-green-400">
              {formatSol(lamportsToSol(market.yesPool || market.liquidityPool * market.yesPrice))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">{noLabel.toUpperCase()} Pool</dt>
            <dd className="mt-1 text-sm font-medium text-red-400">
              {formatSol(lamportsToSol(market.noPool || market.liquidityPool * market.noPrice))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Protocol Fee</dt>
            <dd className="mt-1 text-sm font-medium text-yellow-400">
              2% per trade
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Creator Liquidity</dt>
            <dd className="mt-1 text-sm font-medium text-white">
              {market.creatorLiquidityWithdrawn ? (
                <span className="text-gray-500">Withdrawn</span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Locked until resolution
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      {/* Discussion */}
      <div className="mb-6">
        <CommentSection marketId={id} />
      </div>

      {/* Trade History */}
      <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-5">
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
          Trade History
        </h3>
        {trades.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No trades yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-50/50 text-gray-500">
                  <th className="pb-3 pr-4 text-xs font-medium">Time</th>
                  <th className="pb-3 pr-4 text-xs font-medium">Trader</th>
                  <th className="pb-3 pr-4 text-xs font-medium">Type</th>
                  <th className="pb-3 pr-4 text-xs font-medium">Outcome</th>
                  <th className="pb-3 pr-4 text-xs font-medium text-right">Shares</th>
                  <th className="pb-3 pr-4 text-xs font-medium text-right">Price</th>
                  <th className="pb-3 text-xs font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50/30">
                {trades.map((trade: Trade) => (
                  <tr key={trade.id} className="text-gray-300 transition-colors hover:bg-surface-400/30">
                    <td className="py-3 pr-4 text-xs text-gray-500">
                      {timeAgo(trade.timestamp)}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      {shortenAddress(trade.trader)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold ${
                          trade.direction === "buy"
                            ? "bg-green-500/15 text-green-400"
                            : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {trade.direction.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`text-xs font-semibold ${
                          trade.outcome === "yes"
                            ? "text-green-400"
                            : "text-red-400"
                        }`}
                      >
                        {market.marketType === "crypto_updown" && market.cryptoSubtype === "up_down"
                          ? (trade.outcome === "yes" ? "UP" : "DOWN")
                          : trade.outcome.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-xs">
                      {trade.shares.toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-xs">
                      {trade.price.toFixed(2)}
                    </td>
                    <td className="py-3 text-right font-mono text-xs">
                      {lamportsToSol(trade.cost).toFixed(4)} SOL
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
