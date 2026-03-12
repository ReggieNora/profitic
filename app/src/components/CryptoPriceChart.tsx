"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { Market, CryptoAsset } from "@/types";
import { useCryptoPrice } from "@/hooks/useCryptoPrice";

interface CryptoPriceChartProps {
  market: Market;
}

interface PricePoint {
  time: string;
  timestamp: number;
  price: number;
}

const POLL_INTERVAL = 3_000; // 3 seconds — fast enough to feel live

const TIMEFRAME_MINUTES: Record<string, number> = {
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "24h": 1440,
};

function formatTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}:${date.getSeconds().toString().padStart(2, "0")}`;
}

function formatPrice(p: number): string {
  if (p >= 10000) return `$${p.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (p >= 100) return `$${p.toFixed(0)}`;
  if (p >= 1) return `$${p.toFixed(2)}`;
  return `$${p.toFixed(4)}`;
}

export default function CryptoPriceChart({ market }: CryptoPriceChartProps) {
  const asset = (market.cryptoAsset || "BTC") as CryptoAsset;
  const { price: livePrice, loading } = useCryptoPrice(asset);
  const durationMinutes =
    TIMEFRAME_MINUTES[market.cryptoTimeframe || "15m"] || 15;

  // The start price is the price when this market was created.
  // For demo: use market.startPrice. For live: set at creation time.
  const startPrice = market.startPrice || 0;
  const strikePrice = market.strikePrice;

  // Accumulate live price points in a rolling buffer
  const [priceHistory, setPriceHistory] = useState<PricePoint[]>([]);
  const lastLivePrice = useRef<number>(0);
  const initialized = useRef(false);

  // Seed the chart with the start price as the first point
  useEffect(() => {
    if (!initialized.current && startPrice > 0) {
      const now = new Date();
      setPriceHistory([
        {
          time: formatTime(now),
          timestamp: now.getTime(),
          price: startPrice,
        },
      ]);
      initialized.current = true;
    }
  }, [startPrice]);

  // Every time livePrice updates, append a new data point
  useEffect(() => {
    if (livePrice <= 0 || livePrice === lastLivePrice.current) return;
    lastLivePrice.current = livePrice;

    const now = new Date();
    const point: PricePoint = {
      time: formatTime(now),
      timestamp: now.getTime(),
      price: livePrice,
    };

    setPriceHistory((prev) => {
      const cutoff = now.getTime() - durationMinutes * 60 * 1000;
      // Keep points within the rolling window + new point
      const filtered = prev.filter((p) => p.timestamp >= cutoff);
      return [...filtered, point];
    });
  }, [livePrice, durationMinutes]);

  // Also poll on a fast interval to add simulated micro-ticks between
  // CoinGecko updates (CoinGecko only updates every ~10s). This makes
  // the chart feel alive.
  useEffect(() => {
    const interval = setInterval(() => {
      if (lastLivePrice.current <= 0) return;

      const now = new Date();
      // Micro-jitter around the last known live price (±0.02%)
      const jitter = lastLivePrice.current * 0.0002 * (Math.random() - 0.5);
      const price = lastLivePrice.current + jitter;

      const point: PricePoint = {
        time: formatTime(now),
        timestamp: now.getTime(),
        price,
      };

      setPriceHistory((prev) => {
        const cutoff = now.getTime() - durationMinutes * 60 * 1000;
        const filtered = prev.filter((p) => p.timestamp >= cutoff);
        return [...filtered, point];
      });
    }, POLL_INTERVAL);

    return () => clearInterval(interval);
  }, [durationMinutes]);

  const currentPrice =
    priceHistory.length > 0
      ? priceHistory[priceHistory.length - 1].price
      : startPrice;

  const isAboveStart = currentPrice >= startPrice;
  const priceChange =
    startPrice > 0
      ? ((currentPrice - startPrice) / startPrice) * 100
      : 0;

  // Y domain with padding
  const allPrices = priceHistory.map((d) => d.price);
  if (strikePrice) allPrices.push(strikePrice);
  allPrices.push(startPrice);
  if (allPrices.length === 0) allPrices.push(0);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const range = maxPrice - minPrice;
  const padding = range * 0.15 || maxPrice * 0.005 || 1;
  const yMin = minPrice - padding;
  const yMax = maxPrice + padding;

  // Elapsed / remaining time
  const elapsedSec = Math.max(
    0,
    Math.floor(Date.now() / 1000) - (market.createdAt || 0)
  );
  const totalSec = durationMinutes * 60;
  const remainingSec = Math.max(0, totalSec - elapsedSec);
  const remainingLabel =
    remainingSec > 3600
      ? `${Math.floor(remainingSec / 3600)}h ${Math.floor((remainingSec % 3600) / 60)}m`
      : remainingSec > 60
        ? `${Math.floor(remainingSec / 60)}m ${remainingSec % 60}s`
        : `${remainingSec}s`;
  const progressPct = Math.min(100, (elapsedSec / totalSec) * 100);

  return (
    <div className="card">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white">{asset} Price</h3>
            <span className="flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              LIVE
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-2xl font-black tabular-nums text-white">
              $
              {currentPrice.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            {loading && priceHistory.length === 0 && (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
            )}
          </div>
        </div>
        <div className="text-right">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
              isAboveStart
                ? "bg-green-500/15 text-green-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={
                  isAboveStart
                    ? "M7 11l5-5m0 0l5 5m-5-5v12"
                    : "M17 13l-5 5m0 0l-5-5m5 5V6"
                }
              />
            </svg>
            {priceChange >= 0 ? "+" : ""}
            {priceChange.toFixed(3)}%
          </span>
          <p className="mt-1 text-[10px] text-gray-500">
            vs start ${startPrice.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Countdown bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
          <span>Elapsed {Math.floor(progressPct)}%</span>
          <span className="font-semibold text-white/80">
            {remainingSec > 0 ? `${remainingLabel} remaining` : "Resolving..."}
          </span>
        </div>
        <div className="h-1 w-full overflow-hidden rounded-full bg-surface-400">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-1000"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full">
        {priceHistory.length < 2 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-2 h-6 w-6 mx-auto animate-spin rounded-full border-2 border-primary-400 border-t-transparent" />
              <p className="text-xs text-gray-500">Waiting for live price data...</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={priceHistory}
              margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
            >
              <defs>
                <linearGradient
                  id="priceGradientUp"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                <linearGradient
                  id="priceGradientDown"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#2a2d3a"
                vertical={false}
              />
              <XAxis
                dataKey="time"
                stroke="#6b7280"
                tick={{ fontSize: 10, fill: "#6b7280" }}
                interval="preserveStartEnd"
                minTickGap={50}
              />
              <YAxis
                domain={[yMin, yMax]}
                stroke="#6b7280"
                tick={{ fontSize: 10, fill: "#6b7280" }}
                tickFormatter={formatPrice}
                width={65}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#16182b",
                  border: "1px solid #2a2d3a",
                  borderRadius: "0.5rem",
                  color: "#f0f0f5",
                  fontSize: 12,
                }}
                formatter={(value: number) => [
                  `$${value.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}`,
                  asset,
                ]}
                labelFormatter={(label: string) => label}
              />

              {/* Start price reference line */}
              <ReferenceLine
                y={startPrice}
                stroke="#6b7280"
                strokeDasharray="6 4"
                strokeWidth={1}
                label={{
                  value: `Start $${startPrice.toLocaleString()}`,
                  fill: "#9ca3af",
                  fontSize: 10,
                  position: "left",
                }}
              />

              {/* Strike price reference line (price target markets) */}
              {strikePrice && (
                <ReferenceLine
                  y={strikePrice}
                  stroke="#f59e0b"
                  strokeDasharray="4 3"
                  strokeWidth={1.5}
                  label={{
                    value: `Target $${strikePrice.toLocaleString()}`,
                    fill: "#f59e0b",
                    fontSize: 10,
                    position: "right",
                  }}
                />
              )}

              <Area
                type="monotone"
                dataKey="price"
                stroke={isAboveStart ? "#10b981" : "#ef4444"}
                strokeWidth={2}
                fill={
                  isAboveStart
                    ? "url(#priceGradientUp)"
                    : "url(#priceGradientDown)"
                }
                dot={false}
                activeDot={{
                  r: 4,
                  fill: isAboveStart ? "#10b981" : "#ef4444",
                  stroke: "#16182b",
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Data point count */}
      <div className="mt-2 flex items-center justify-between text-[10px] text-gray-600">
        <span>{priceHistory.length} data points</span>
        <span>Updates every 3s</span>
      </div>
    </div>
  );
}
