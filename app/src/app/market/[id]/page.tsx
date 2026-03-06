"use client";

import React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMarket } from "@/hooks/useMarket";
import TradePanel from "@/components/TradePanel";
import BondingCurveChart from "@/components/BondingCurveChart";
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

  const handleTrade = async (trade: TradeFormData) => {
    console.log("Trade submitted:", trade);
    alert(
      `Trade submitted: ${trade.direction} ${trade.amount} ${trade.outcome.toUpperCase()} shares.\n\nIn production, this calls the Solana program.`
    );
    refetch();
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

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:max-w-7xl sm:px-6 lg:px-8">
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

      {/* Big probability display - mobile first */}
      <div className="mb-6 flex gap-3 animate-fade-up" style={{ animationDelay: "60ms" }}>
        <div className="flex-1 overflow-hidden rounded-2xl border border-green-500/20 bg-green-500/5 p-4 text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-green-400/70">Yes</div>
          <div className="mt-1 text-3xl font-black tabular-nums text-green-400">
            {yesPercent}<span className="text-lg font-bold">%</span>
          </div>
        </div>
        <div className="flex-1 overflow-hidden rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-center">
          <div className="text-xs font-semibold uppercase tracking-wider text-red-400/70">No</div>
          <div className="mt-1 text-3xl font-black tabular-nums text-red-400">
            {noPercent}<span className="text-lg font-bold">%</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-2 gap-3 animate-fade-up" style={{ animationDelay: "120ms" }}>
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-4 text-center">
          <p className="text-xs font-medium text-gray-500">Volume</p>
          <p className="mt-1 text-lg font-bold text-white">
            {formatSol(lamportsToSol(market.totalVolume))}
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
          <BondingCurveChart
            yesShares={market.yesShares}
            noShares={market.noShares}
          />
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
            <dt className="text-xs text-gray-500">Liquidity Pool</dt>
            <dd className="mt-1 text-sm font-medium text-white">
              {formatSol(lamportsToSol(market.liquidityPool))}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">YES Shares</dt>
            <dd className="mt-1 text-sm font-medium text-white">
              {market.yesShares.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">NO Shares</dt>
            <dd className="mt-1 text-sm font-medium text-white">
              {market.noShares.toLocaleString()}
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
                        {trade.outcome.toUpperCase()}
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
