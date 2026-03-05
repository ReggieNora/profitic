import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Image from "next/image";
import WalletProvider from "@/components/WalletProvider";
import Navbar from "@/components/Navbar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Profitic - Solana Prediction Market",
  description:
    "Trade on the future with Profitic, a decentralized prediction market built on Solana.",
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
      <body className={inter.className}>
        <WalletProvider>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer className="border-t border-surface-50 py-6 text-center text-sm text-gray-500">
              <div className="flex flex-col items-center gap-3">
                <Image
                  src="/logo.png"
                  alt="Profitic"
                  width={120}
                  height={40}
                  className="h-8 w-auto opacity-70"
                />
                <p>Decentralized Prediction Markets on Solana</p>
              </div>
            </footer>
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
