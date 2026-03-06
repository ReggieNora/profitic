"use client";

import React from "react";
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

  const isAdmin =
    publicKey && ADMIN_WALLETS.includes(publicKey.toBase58());

  const links = isAdmin
    ? [...NAV_LINKS, { href: "/admin", label: "Admin" }]
    : NAV_LINKS;

  return (
    <nav className="sticky top-0 z-50 border-b border-white/5 bg-surface-500/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center transition-opacity active:opacity-70">
          <Image
            src="/logo.png"
            alt="Profitic"
            width={120}
            height={40}
            className="h-8 w-auto"
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
                className={`relative rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? "text-white"
                    : "text-gray-400 hover:text-white"
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
