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
    <div className={`relative flex items-center tabular-nums whitespace-nowrap font-digital ${className}`}>
      
      {/* Background Unlit 14-Segments (renders ~ behind numbers and $) */}
      <div 
        className="absolute inset-0 flex items-center text-white pointer-events-none select-none" 
        style={{ textShadow: 'none', WebkitFontSmoothing: 'none' }}
        aria-hidden="true"
      >
        {currentDigits.map((digit, i) => (
          <span key={`bg-${i}`} className={`inline-block ${/[0-9\$]/.test(digit) ? 'opacity-15' : 'opacity-0'}`}>
            {/[0-9\$]/.test(digit) ? '~' : digit}
          </span>
        ))}
      </div>

      {/* Foreground Lit Digits */}
      <div className="relative flex items-center z-10 text-white">
        {currentDigits.map((digit, i) => {
          const isChanged = changedIndices.has(i);
          return (
            <span
              key={`${i}-${isChanged ? state.version : "stable"}`}
              className={`inline-block transition-colors duration-75 ${
                isChanged && state.flash === "up" 
                  ? "text-green-400 animate-[digital-flicker_0.4s_ease-in-out]" 
                  : isChanged && state.flash === "down" 
                  ? "text-red-400 animate-[digital-flicker_0.4s_ease-in-out]" 
                  : "text-white"
              }`}
              style={{
                textShadow: "0 0 8px currentColor, 0 0 16px currentColor",
              }}
            >
              {digit}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function formatUsd(v: number) {
  if (v >= 10000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (v >= 1) return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (v >= 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(8)}`;
}
