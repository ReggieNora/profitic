"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { ADMIN_WALLETS } from "@/lib/constants";

export default function Navbar() {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const isAdmin =
    publicKey && ADMIN_WALLETS.includes(publicKey.toBase58());

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-white/[0.03] backdrop-blur-2xl backdrop-saturate-150">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
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

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-1 md:flex">
          {[
            { href: "/", label: "Markets" },
            { href: "/binaries", label: "Binaries" },
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

        {/* Wallet */}
        <div className="flex items-center">
          <WalletMultiButton />
        </div>
      </div>
    </nav>
  );
}
