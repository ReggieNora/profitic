"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { ADMIN_WALLETS } from "@/lib/constants";
import { useSolBalance } from "@/hooks/useSolBalance";

// Dynamic import with ssr:false prevents hydration mismatch from wallet button
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
  { ssr: false }
);

export default function Navbar() {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const { balance, requestAirdrop } = useSolBalance();
  const [airdropping, setAirdropping] = useState(false);
  const isAdmin =
    publicKey && ADMIN_WALLETS.includes(publicKey.toBase58());

  const handleAirdrop = async () => {
    setAirdropping(true);
    try {
      await requestAirdrop();
    } catch {
      // useSolBalance logs the error
    } finally {
      setAirdropping(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-white/[0.03] backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center transition-opacity active:opacity-70">
            <Image
              src="/logo.png"
              alt="Profitic"
              width={360}
              height={120}
              className="h-24 w-auto"
              priority
            />
          </Link>
          <span className="rounded-md bg-yellow-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-yellow-400">
            Devnet
          </span>
        </div>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-1 md:flex">
          {[
            { href: "/", label: "Markets" },
            { href: "/farm", label: "Farm" },
            { href: "/predictions", label: "Leaderboard" },
            { href: "/profile", label: "Profile" },
            ...(isAdmin ? [{ href: "/admin", label: "Admin" }] : []),
          ].map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "text-white"
                    : "text-white/50 hover:text-white"
                }`}
              >
                {link.label}
                {isActive && (
                  <div className="absolute bottom-0 left-1/2 h-0.5 w-5 -translate-x-1/2 rounded-full bg-gradient-primary" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Wallet + Balance */}
        <div className="flex items-center gap-2">
          {publicKey && balance !== null && (
            <div className="flex items-center gap-1.5 rounded-xl bg-surface-300/80 px-2 py-1 sm:px-3 sm:py-1.5">
              <span className="text-[10px] font-bold tabular-nums text-white sm:text-xs">
                {balance.toFixed(2)}
              </span>
              <span className="text-[9px] font-semibold text-gray-500 sm:text-[10px]">SOL</span>
            </div>
          )}
          {publicKey && (
            <button
              onClick={handleAirdrop}
              disabled={airdropping}
              className="rounded-lg bg-primary-500/20 px-2 py-1 text-[9px] font-bold text-primary-400 transition-all hover:bg-primary-500/30 active:scale-95 disabled:opacity-50 sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-[10px]"
              title="Get 2 devnet SOL"
            >
              {airdropping ? "..." : "Airdrop"}
            </button>
          )}
          <WalletMultiButton />
        </div>
      </div>
    </nav>
  );
}
