import type { Metadata } from "next";
import "./globals.css";
import WalletProvider from "@/components/WalletProvider";
import Navbar from "@/components/Navbar";
import BottomNav from "@/components/BottomNav";

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
      <body className="overflow-hidden">
        <WalletProvider>
          <div className="flex h-screen flex-col">
            <Navbar />
            <main className="flex-1 overflow-y-auto">{children}</main>
            <BottomNav />
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}
