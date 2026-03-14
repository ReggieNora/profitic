import { PublicKey } from "@solana/web3.js";

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "https://api.devnet.solana.com";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ||
    "F26VXCqa3qsQrwA9doQrcbykw38D8wqoUWCvVtGjrMKd"
);

// Binary market program — update after `anchor deploy`
export const BINARY_MARKET_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_BINARY_MARKET_PROGRAM_ID ||
    "2ypR65WzGpXA5tzsMq35neo2pxyN8J1ikmpVWD2qstRj"
);

// Yield farm program
export const YIELD_FARM_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_YIELD_FARM_PROGRAM_ID ||
    "EyAQAxKyjWbSbf991RftzpXHkcGqgaG2VDLjSUgjE1M6"
);

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080/api";

export const LAMPORTS_PER_SOL = 1_000_000_000;

export const ADMIN_WALLETS = [
  "5oVM6AcRnXMjFVJhDNMocw2fkBfUBfmRZvQKeXu5zEtp",
];

export const MARKET_CATEGORIES = [
  { label: "All", value: "all" },
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
