export type MarketCategory = "crypto" | "finance" | "politics" | "world" | "tech" | "sports";

export type MarketStatus = "funding" | "active" | "proposed_resolution" | "resolved" | "cancelled";

export type MarketType = "prediction" | "crypto_updown";

export type CryptoAsset = "BTC" | "ETH" | "SOL";

export type CryptoTimeframe = "5m" | "15m" | "1h" | "4h" | "24h";

export type CryptoMarketSubtype = "up_down" | "price_target";

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

  // Crypto Up/Down market fields
  marketType?: MarketType;
  cryptoAsset?: CryptoAsset;
  cryptoTimeframe?: CryptoTimeframe;
  cryptoSubtype?: CryptoMarketSubtype;
  strikePrice?: number; // Price target in USD (for price_target subtype)
  startPrice?: number; // Asset price at market creation
  currentAssetPrice?: number; // Live asset price
  oracleSource?: string; // e.g. "pyth" or "chainlink"
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

export interface CryptoUpDownFormData {
  asset: CryptoAsset;
  timeframe: CryptoTimeframe;
  subtype: CryptoMarketSubtype;
  strikePrice: string; // only for price_target
  initialYesLiquidity: string;
  initialNoLiquidity: string;
}

// Crypto asset metadata
export const CRYPTO_ASSETS: { value: CryptoAsset; label: string; icon: string; color: string; pythFeedId: string }[] = [
  { value: "BTC", label: "Bitcoin", icon: "BTC", color: "text-orange-400", pythFeedId: "e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" },
  { value: "ETH", label: "Ethereum", icon: "ETH", color: "text-indigo-400", pythFeedId: "ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" },
  { value: "SOL", label: "Solana", icon: "SOL", color: "text-emerald-400", pythFeedId: "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d" },
];

export const CRYPTO_TIMEFRAMES: { value: CryptoTimeframe; label: string; seconds: number }[] = [
  { value: "5m", label: "5 Minutes", seconds: 300 },
  { value: "15m", label: "15 Minutes", seconds: 900 },
  { value: "1h", label: "1 Hour", seconds: 3600 },
  { value: "4h", label: "4 Hours", seconds: 14400 },
  { value: "24h", label: "24 Hours", seconds: 86400 },
];

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

// ── Binary Round Types (platform-controlled rolling markets) ──

export type BinaryRoundPhase = "betting" | "locked" | "resolving" | "complete";

export interface BinaryRound {
  id: string;
  asset: CryptoAsset;
  roundNumber: number;
  phase: BinaryRoundPhase;
  duration: number;         // round duration in seconds (e.g. 300 for 5m)
  lockBuffer: number;       // seconds before end when betting locks (e.g. 30)
  startTime: number;        // unix timestamp when round started
  endTime: number;          // unix timestamp when round ends
  lockTime: number;         // unix timestamp when betting locks
  startPrice: number;       // asset price at round start (from Pyth oracle)
  endPrice?: number;        // asset price at round end (from Pyth oracle)
  outcome?: "up" | "down";  // determined after resolution
  upPool: number;           // total SOL bet on UP (lamports)
  downPool: number;         // total SOL bet on DOWN (lamports)
  totalPool: number;        // upPool + downPool
  feeCollected: number;     // protocol fee taken (lamports)
  bets: BinaryBet[];        // individual bets placed this round
}

export interface BinaryBet {
  id: string;
  roundId: string;
  wallet: string;
  side: "up" | "down";
  amount: number;           // lamports
  timestamp: number;
  payout?: number;          // set after resolution
}

export const BINARY_ROUND_DURATION = 300;  // 5 minutes
export const BINARY_LOCK_BUFFER = 10;      // lock 10s before end
