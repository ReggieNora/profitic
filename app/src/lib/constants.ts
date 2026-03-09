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

export const MARKET_CATEGORIES = [
  { label: "All", value: "all" },
  { label: "Up/Down", value: "updown" },
  { label: "Crypto", value: "crypto" },
  { label: "Finance", value: "finance" },
  { label: "Politics", value: "politics" },
  { label: "World Events", value: "world" },
  { label: "Tech", value: "tech" },
  { label: "Sports", value: "sports" },
] as const;

/** @deprecated Use MARKET_CATEGORIES instead */
export const MARKET_FILTERS = MARKET_CATEGORIES;

export const BONDING_CURVE_K = 100; // Bonding curve constant
