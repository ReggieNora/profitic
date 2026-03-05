"use client";

import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from "recharts";
import { generatePriceCurve, marginalPrice } from "@/lib/bondingCurve";

interface BondingCurveChartProps {
  yesShares: number;
  noShares: number;
}

export default function BondingCurveChart({
  yesShares,
  noShares,
}: BondingCurveChartProps) {
  const data = useMemo(
    () => generatePriceCurve(yesShares, noShares, 60),
    [yesShares, noShares]
  );

  const currentYesPrice = marginalPrice(yesShares, noShares, "yes");

  // Find the x-axis position that corresponds to the current state
  const totalShares = yesShares + noShares;
  const currentX = totalShares > 0 ? yesShares : data.length > 0 ? data[Math.floor(data.length / 2)].shares : 0;

  return (
    <div className="card">
      <h3 className="mb-4 text-lg font-semibold text-white">
        Bonding Curve
      </h3>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#2a2d3a"
              vertical={false}
            />
            <XAxis
              dataKey="shares"
              stroke="#6b7280"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickFormatter={(v: number) => `${v}`}
              label={{
                value: "YES Shares",
                position: "insideBottom",
                offset: -2,
                fill: "#6b7280",
                fontSize: 11,
              }}
            />
            <YAxis
              domain={[0, 1]}
              stroke="#6b7280"
              tick={{ fontSize: 11, fill: "#6b7280" }}
              tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#16182b",
                border: "1px solid #2a2d3a",
                borderRadius: "0.5rem",
                color: "#f0f0f5",
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => [
                `${(value * 100).toFixed(1)}%`,
                name === "yesPrice" ? "YES Price" : "NO Price",
              ]}
              labelFormatter={(label: number) => `Shares: ${label}`}
            />
            <Legend
              formatter={(value: string) =>
                value === "yesPrice" ? "YES Price" : "NO Price"
              }
              wrapperStyle={{ fontSize: 12 }}
            />
            <Line
              type="monotone"
              dataKey="yesPrice"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#10b981" }}
            />
            <Line
              type="monotone"
              dataKey="noPrice"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#ef4444" }}
            />
            {totalShares > 0 && (
              <ReferenceLine
                x={currentX}
                stroke="#6b1fff"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{
                  value: `Current: ${(currentYesPrice * 100).toFixed(1)}%`,
                  fill: "#9a63ff",
                  fontSize: 11,
                  position: "top",
                }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
