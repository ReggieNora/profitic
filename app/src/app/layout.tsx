import type { Metadata } from "next";
import dynamic from "next/dynamic";
import "./globals.css";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";

// Lazy-load wallet provider so the UI shell renders immediately
const WalletProvider = dynamic(() => import("@/components/WalletProvider"), {
  ssr: false,
});

export const metadata: Metadata = {
  title: "Profitic - Crypto Binary Markets on Solana",
  description:
    "Trade UP or DOWN on crypto prices with 5-minute binary rounds. Built on Solana with Pyth Oracle.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Profitic - Solana Prediction Market",
    description:
      "Trade on the future with Profitic, a decentralized prediction market built on Solana.",
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "Profitic" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Profitic - Solana Prediction Market",
    description:
      "Trade on the future with Profitic, a decentralized prediction market built on Solana.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="overflow-hidden">
        <WalletProvider>
          <div className="flex h-screen flex-col">
            <Navbar />
            <main className="flex-1 overflow-y-auto pt-14">{children}</main>
            <BottomNav />
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
