"use client";

import React from "react";
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
    // In production, this would call the Anchor program
    console.log("Trade submitted:", trade);
    alert(
      `Trade submitted: ${trade.direction} ${trade.amount} ${trade.outcome.toUpperCase()} shares.\n\nIn production, this calls the Solana program.`
    );
    refetch();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!market) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <p className="text-lg font-medium">Market not found</p>
        <p className="mt-1 text-sm">{error || "The market you are looking for does not exist."}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-3">
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
              market.resolved
                ? "bg-gray-500/20 text-gray-400"
                : "bg-green-500/20 text-green-400"
            }`}
          >
            {market.resolved ? "Resolved" : "Active"}
          </span>
          <span className="text-sm text-gray-500">
            Created by {shortenAddress(market.creator)}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white sm:text-3xl">
          {market.question}
        </h1>
        <p className="mt-3 text-gray-400">{market.description}</p>
      </div>

      {/* Stats Row */}
      <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="card text-center">
          <p className="text-sm text-gray-400">YES Price</p>
          <p className="mt-1 text-2xl font-bold text-green-400">
            {formatProbability(market.yesPrice)}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-400">NO Price</p>
          <p className="mt-1 text-2xl font-bold text-red-400">
            {formatProbability(market.noPrice)}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-400">Volume</p>
          <p className="mt-1 text-2xl font-bold text-white">
            {formatSol(lamportsToSol(market.totalVolume))}
          </p>
        </div>
        <div className="card text-center">
          <p className="text-sm text-gray-400">Resolves</p>
          <p className="mt-1 text-lg font-bold text-white">
            {formatDate(market.resolutionDate)}
          </p>
        </div>
      </div>

      {/* Main Content: Chart + Trade Panel */}
      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BondingCurveChart
            yesShares={market.yesShares}
            noShares={market.noShares}
          />
        </div>
        <div>
          <TradePanel market={market} onTrade={handleTrade} />
        </div>
      </div>

      {/* Market Info */}
      <div className="mb-8 card">
        <h3 className="mb-3 text-lg font-semibold text-white">Market Details</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-400">Data Source</dt>
            <dd className="mt-1">
              <a
                href={market.dataSourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-accent-400 hover:underline"
              >
                {market.dataSourceUrl}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-400">Liquidity Pool</dt>
            <dd className="mt-1 text-sm font-medium text-white">
              {formatSol(lamportsToSol(market.liquidityPool))}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-400">YES Shares Outstanding</dt>
            <dd className="mt-1 text-sm font-medium text-white">
              {market.yesShares.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-400">NO Shares Outstanding</dt>
            <dd className="mt-1 text-sm font-medium text-white">
              {market.noShares.toLocaleString()}
            </dd>
          </div>
        </dl>
      </div>

      {/* Discussion */}
      <div className="mb-8">
        <CommentSection marketId={id} />
      </div>

      {/* Trade History */}
      <div className="card">
        <h3 className="mb-4 text-lg font-semibold text-white">Trade History</h3>
        {trades.length === 0 ? (
          <p className="py-8 text-center text-gray-500">No trades yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-surface-50 text-gray-400">
                  <th className="pb-3 pr-4 font-medium">Time</th>
                  <th className="pb-3 pr-4 font-medium">Trader</th>
                  <th className="pb-3 pr-4 font-medium">Type</th>
                  <th className="pb-3 pr-4 font-medium">Outcome</th>
                  <th className="pb-3 pr-4 font-medium text-right">Shares</th>
                  <th className="pb-3 pr-4 font-medium text-right">Price</th>
                  <th className="pb-3 font-medium text-right">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-50">
                {trades.map((trade: Trade) => (
                  <tr key={trade.id} className="text-gray-300 hover:bg-surface-400/50">
                    <td className="py-3 pr-4 text-gray-500">
                      {timeAgo(trade.timestamp)}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs">
                      {shortenAddress(trade.trader)}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          trade.direction === "buy"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {trade.direction.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={
                          trade.outcome === "yes"
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        {trade.outcome.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right font-mono">
                      {trade.shares.toLocaleString()}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono">
                      {trade.price.toFixed(2)}
                    </td>
                    <td className="py-3 text-right font-mono">
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
