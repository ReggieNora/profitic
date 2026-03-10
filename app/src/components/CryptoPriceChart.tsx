"use client";

import React, { useMemo, useState, useEffect } from "react";
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

/**
 * Generate simulated recent price history around a start price.
 * In production this would fetch from CoinGecko /coins/{id}/market_chart.
 */
function generatePriceHistory(
  startPrice: number,
  currentPrice: number,
  durationMinutes: number
): PricePoint[] {
  const points: PricePoint[] = [];
  const numPoints = Math.max(30, Math.min(120, durationMinutes));
  const now = Date.now();
  const startTime = now - durationMinutes * 60 * 1000;

  // Interpolate from startPrice to currentPrice with realistic noise
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const timestamp = startTime + t * (now - startTime);
    const date = new Date(timestamp);

    // Base trend from start to current
    const trend = startPrice + (currentPrice - startPrice) * t;

    // Add brownian-motion-style noise that scales with price
    const volatility = startPrice * 0.002; // 0.2% volatility per step
    const noise =
      i === 0
        ? 0
        : i === numPoints
          ? currentPrice - trend
          : (Math.random() - 0.5) * 2 * volatility * Math.sqrt(t + 0.1);

    points.push({
      time: `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`,
      timestamp,
      price: Math.max(0, trend + noise),
    });
  }

  // Ensure first and last points are exact
  if (points.length > 0) {
    points[0].price = startPrice;
    points[points.length - 1].price = currentPrice;
  }

  return points;
}

const TIMEFRAME_MINUTES: Record<string, number> = {
  "5m": 5,
  "15m": 15,
  "1h": 60,
  "4h": 240,
  "24h": 1440,
};

export default function CryptoPriceChart({ market }: CryptoPriceChartProps) {
  const asset = (market.cryptoAsset || "BTC") as CryptoAsset;
  const { price: livePrice, loading } = useCryptoPrice(asset);
  const [currentPrice, setCurrentPrice] = useState(market.startPrice || 0);

  useEffect(() => {
    if (livePrice > 0) {
      setCurrentPrice(livePrice);
    }
  }, [livePrice]);

  const startPrice = market.startPrice || 0;
  const strikePrice = market.strikePrice;
  const durationMinutes = TIMEFRAME_MINUTES[market.cryptoTimeframe || "15m"] || 15;

  const data = useMemo(
    () => generatePriceHistory(startPrice, currentPrice, durationMinutes),
    [startPrice, currentPrice, durationMinutes]
  );

  const isAboveStart = currentPrice >= startPrice;
  const priceChange = startPrice > 0 ? ((currentPrice - startPrice) / startPrice) * 100 : 0;

  // Calculate Y domain with padding
  const allPrices = data.map((d) => d.price);
  if (strikePrice) allPrices.push(strikePrice);
  allPrices.push(startPrice);
  const minPrice = Math.min(...allPrices);
  const maxPrice = Math.max(...allPrices);
  const padding = (maxPrice - minPrice) * 0.15 || maxPrice * 0.005;
  const yMin = minPrice - padding;
  const yMax = maxPrice + padding;

  const formatPrice = (p: number) => {
    if (p >= 10000) return `$${(p / 1000).toFixed(1)}k`;
    if (p >= 100) return `$${p.toFixed(0)}`;
    if (p >= 1) return `$${p.toFixed(2)}`;
    return `$${p.toFixed(4)}`;
  };

  return (
    <div className="card">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {asset} Price
          </h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-2xl font-black tabular-nums text-white">
              ${currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {loading && (
              <span className="h-2 w-2 rounded-full bg-primary-400 animate-pulse" />
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
                d={isAboveStart ? "M7 11l5-5m0 0l5 5m-5-5v12" : "M17 13l-5 5m0 0l-5-5m5 5V6"}
              />
            </svg>
            {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
          </span>
          <p className="mt-1 text-[10px] text-gray-500">
            vs start ${startPrice.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <defs>
              <linearGradient id="priceGradientUp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="priceGradientDown" x1="0" y1="0" x2="0" y2="1">
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
              minTickGap={40}
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
                `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
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
              fill={isAboveStart ? "url(#priceGradientUp)" : "url(#priceGradientDown)"}
              dot={false}
              activeDot={{
                r: 4,
                fill: isAboveStart ? "#10b981" : "#ef4444",
                stroke: "#16182b",
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
