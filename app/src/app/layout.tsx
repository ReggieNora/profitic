import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Profitic - Solana Prediction Market",
  description:
    "Trade on the future with Profitic, a decentralized prediction market built on Solana.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <WalletProvider>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-surface-50 py-6 text-center text-sm text-gray-500">
              <p>Profitic &mdash; Decentralized Prediction Markets on Solana</p>
            </footer>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
