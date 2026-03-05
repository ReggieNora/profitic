"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import { ADMIN_WALLETS } from "@/lib/constants";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/create", label: "Create" },
  { href: "/profile", label: "Profile" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isAdmin =
    publicKey && ADMIN_WALLETS.includes(publicKey.toBase58());

  const links = isAdmin
    ? [...NAV_LINKS, { href: "/admin", label: "Admin" }]
    : NAV_LINKS;

  return (
    <nav className="sticky top-0 z-50 border-b border-surface-50 bg-surface-500/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center">
          <Image
            src="/logo.png"
            alt="Profitic"
            width={140}
            height={48}
            className="h-10 w-auto"
            priority
          />
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-surface-200 text-white"
                    : "text-gray-400 hover:bg-surface-300 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Wallet + Mobile Toggle */}
        <div className="flex items-center gap-3">
          <WalletMultiButton />
          <button
            className="rounded-lg p-2 text-gray-400 hover:bg-surface-300 md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileOpen && (
        <div className="border-t border-surface-50 px-4 py-3 md:hidden">
          {links.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className={`block rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-surface-200 text-white"
                    : "text-gray-400 hover:bg-surface-300 hover:text-white"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </div>
      )}
    </nav>
  );
}
