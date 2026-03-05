import { PublicKey } from "@solana/web3.js";

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ||
    "11111111111111111111111111111111"
);

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

export const LAMPORTS_PER_SOL = 1_000_000_000;

export const ADMIN_WALLETS = [
  "YourAdminWalletPublicKeyHere11111111111111111",
];

export const MARKET_FILTERS = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Ending Soon", value: "ending_soon" },
  { label: "High Volume", value: "high_volume" },
  { label: "Resolved", value: "resolved" },
] as const;

export const BONDING_CURVE_K = 100; // Bonding curve constant
