export type MarketCategory = "crypto" | "finance" | "politics" | "world" | "tech" | "sports";

export interface Market {
  id: string;
  publicKey: string;
  question: string;
  description: string;
  creator: string;
  category?: MarketCategory;
  coverImage?: string; // URL to cover image
  videoUrl?: string; // Optional YouTube/Twitter video URL
  resolutionDate: number; // Unix timestamp
  dataSourceUrl: string;
  outcome: MarketOutcome;
  yesShares: number;
  noShares: number;
  totalVolume: number;
  liquidityPool: number;
  yesPrice: number; // 0-1 probability
  noPrice: number; // 0-1 probability
  resolved: boolean;
  resolvedOutcome?: "yes" | "no";
  evidenceUrl?: string;
  createdAt: number;
}

export type MarketOutcome = "unresolved" | "yes" | "no" | "invalid";

export interface Trade {
  id: string;
  marketId: string;
  trader: string;
  outcome: "yes" | "no";
  direction: "buy" | "sell";
  shares: number;
  price: number;
  cost: number;
  timestamp: number;
  txSignature: string;
}

export interface Position {
  marketId: string;
  market?: Market;
  outcome: "yes" | "no";
  shares: number;
  avgPrice: number;
  currentValue: number;
  pnl: number;
  claimable: boolean;
  claimed: boolean;
}

export interface MarketFormData {
  question: string;
  description: string;
  category: MarketCategory | "";
  resolutionDate: string;
  resolutionTime: string;
  dataSourceUrl: string;
  coverImage: string;
  videoUrl: string;
}

export interface TradeFormData {
  outcome: "yes" | "no";
  amount: number;
  direction: "buy" | "sell";
}

export interface Comment {
  id: number;
  market_id: number;
  user_address: string;
  body: string;
  created_at: string;
}
