"use client";

import React from "react";

interface CryptoLogoProps {
  size?: number;
  className?: string;
}

export function BtcLogo({ size = 24, className = "" }: CryptoLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
    >
      <circle cx="16" cy="16" r="16" fill="#F7931A" />
      <path
        fill="#fff"
        d="M22.34 14.05c.31-2.09-1.28-3.22-3.46-3.97l.71-2.83-1.73-.43-.69 2.76c-.45-.11-.92-.22-1.38-.33l.69-2.78-1.73-.43-.7 2.83c-.38-.09-.75-.17-1.11-.26l-2.39-.6-.46 1.85s1.28.29 1.26.31c.7.18.82.63.8 1l-.8 3.22c.05.01.11.03.18.06l-.18-.05-1.13 4.52c-.08.21-.3.52-.79.4.02.02-1.26-.32-1.26-.32l-.86 1.98 2.25.56c.42.11.83.22 1.23.32l-.71 2.87 1.73.43.7-2.84c.47.13.93.25 1.38.36l-.7 2.82 1.73.43.71-2.86c2.95.56 5.16.33 6.1-2.33.75-2.14-.04-3.37-1.58-4.17 1.12-.26 1.97-1 2.2-2.53zm-3.93 5.51c-.53 2.14-4.15.98-5.32.69l.95-3.8c1.17.29 4.93.87 4.37 3.11zm.54-5.54c-.49 1.95-3.5.96-4.47.71l.86-3.45c.98.24 4.12.7 3.61 2.74z"
      />
    </svg>
  );
}

export function EthLogo({ size = 24, className = "" }: CryptoLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
    >
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <g fill="#fff">
        <path fillOpacity=".6" d="M16.5 4v8.87l7.5 3.35z" />
        <path d="M16.5 4L9 16.22l7.5-3.35z" />
        <path fillOpacity=".6" d="M16.5 21.97v6.01L24 17.62z" />
        <path d="M16.5 27.98v-6.01L9 17.62z" />
        <path fillOpacity=".2" d="M16.5 20.57l7.5-4.35-7.5-3.35z" />
        <path fillOpacity=".6" d="M9 16.22l7.5 4.35v-7.7z" />
      </g>
    </svg>
  );
}

export function SolLogo({ size = 24, className = "" }: CryptoLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width={size}
      height={size}
      className={className}
    >
      <circle cx="16" cy="16" r="16" fill="url(#sol-grad)" />
      <defs>
        <linearGradient id="sol-grad" x1="3" y1="28" x2="29" y2="4" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9945FF" />
          <stop offset="50%" stopColor="#14F195" />
          <stop offset="100%" stopColor="#00D1FF" />
        </linearGradient>
      </defs>
      <g transform="translate(7,8) scale(0.75)">
        <path
          fill="#fff"
          d="M3.56 17.03a.76.76 0 01.54-.22h19.33c.34 0 .51.41.27.65l-3.66 3.66a.76.76 0 01-.54.22H.17c-.34 0-.51-.41-.27-.65l3.66-3.66z"
        />
        <path
          fill="#fff"
          d="M3.56.22A.78.78 0 014.1 0h19.33c.34 0 .51.41.27.65l-3.66 3.66a.76.76 0 01-.54.22H.17C-.17 4.53-.34 4.12-.1 3.88L3.56.22z"
        />
        <path
          fill="#fff"
          d="M20.04 8.56a.76.76 0 00-.54-.22H.17c-.34 0-.51.41-.27.65l3.66 3.66c.14.14.34.22.54.22h19.33c.34 0 .51-.41.27-.65l-3.66-3.66z"
        />
      </g>
    </svg>
  );
}

export function CryptoLogo({
  asset,
  size = 24,
  className = "",
}: CryptoLogoProps & { asset: "BTC" | "ETH" | "SOL" }) {
  switch (asset) {
    case "BTC":
      return <BtcLogo size={size} className={className} />;
    case "ETH":
      return <EthLogo size={size} className={className} />;
    case "SOL":
      return <SolLogo size={size} className={className} />;
  }
}
