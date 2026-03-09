export type MarketCategory = "crypto" | "finance" | "politics" | "world" | "tech" | "sports";

export type MarketStatus = "funding" | "active" | "proposed_resolution" | "resolved" | "cancelled";

export interface Market {
  id: string;
  publicKey: string;
  question: string;
  description: string;
  creator: string;
  category?: MarketCategory;
  coverImage?: string;
  videoUrl?: string;
  resolutionDate: number; // Unix timestamp
  dataSourceUrl: string;
  outcome: MarketOutcome;
  status?: MarketStatus;
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

  // AMM pool fields (optional – derived from liquidityPool * price when absent)
  yesPool?: number; // YES side of AMM pool (lamports)
  noPool?: number; // NO side of AMM pool (lamports)
  feesCollected?: number; // Total protocol fees (lamports)
  creatorYesLiquidity?: number; // Creator's initial YES deposit (lamports)
  creatorNoLiquidity?: number; // Creator's initial NO deposit (lamports)
  creatorLiquidityWithdrawn?: boolean;
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
  fee: number;
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
  initialYesLiquidity: string;
  initialNoLiquidity: string;
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

// Protocol constants
export const PROTOCOL_FEE_PERCENT = 2;
export const PROTOCOL_FEE_BPS = 200;
