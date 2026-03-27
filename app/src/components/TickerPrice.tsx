"use client";

import React, { useEffect, useRef, useState } from "react";

interface TickerPriceProps {
  value: number;
  className?: string;
}

export default function TickerPrice({ value, className = "" }: TickerPriceProps) {
  const [state, setState] = useState({
    current: value,
    prev: value,
    flash: null as "up" | "down" | null,
    version: 0
  });
  
  const lastValueRef = useRef(value);

  useEffect(() => {
    if (value !== lastValueRef.current) {
      const direction = value > lastValueRef.current ? "up" : "down";
      const oldVal = lastValueRef.current;
      lastValueRef.current = value;

      setState(s => ({
        current: value,
        prev: oldVal,
        flash: direction,
        version: s.version + 1
      }));

      const timer = setTimeout(() => {
        setState(s => ({ ...s, flash: null, prev: value }));
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [value]);

  const currentFormatted = formatUsd(state.current);
  const prevFormatted = formatUsd(state.prev);
  
  const currentDigits = currentFormatted.split("");
  const prevDigits = prevFormatted.split("");

  // Right-aligned comparison to find changed digits
  const changedIndices = new Set<number>();
  const maxLen = Math.max(currentDigits.length, prevDigits.length);
  
  if (state.flash) {
    for (let i = 0; i < maxLen; i++) {
      const currIdx = currentDigits.length - 1 - i;
      const prevIdx = prevDigits.length - 1 - i;
      
      if (currIdx < 0 || prevIdx < 0 || currentDigits[currIdx] !== prevDigits[prevIdx]) {
        if (currIdx >= 0) changedIndices.add(currIdx);
      }
    }
  }

  return (
    <div className={`flex items-center tabular-nums whitespace-nowrap ${className}`}>
      {currentDigits.map((digit, i) => {
        const isChanged = changedIndices.has(i);
        return (
          <span
            key={`${i}-${isChanged ? state.version : "stable"}`}
            className={`inline-block transition-all duration-300 ${
              isChanged && state.flash === "up" 
                ? "text-green-400 animate-ticker-up" 
                : isChanged && state.flash === "down" 
                ? "text-red-400 animate-ticker-down" 
                : "text-white"
            }`}
            style={{ 
              animationDelay: `${(currentDigits.length - 1 - i) * 10}ms`,
              transitionDelay: state.flash ? "0ms" : "500ms"
            }}
          >
            {digit}
          </span>
        );
      })}
    </div>
  );
}

function formatUsd(v: number) {
  if (v >= 10000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(8)}`;
}
