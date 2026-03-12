import { Market, Trade, CryptoAsset } from "@/types";

// ── Live price fetching for demo start prices ──

const COINGECKO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
};

// Module-level cache so we only fetch once per session
let livePriceCache: Record<string, number> = {};
let livePriceFetched = false;

async function fetchLivePrices(): Promise<Record<string, number>> {
  if (livePriceFetched) return livePriceCache;

  try {
    const ids = Object.values(COINGECKO_IDS).join(",");
    const res = await fetch(
      `/api/prices?ids=${encodeURIComponent(ids)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) throw new Error(`Price proxy ${res.status}`);
    const data = await res.json();

    for (const [symbol, cgId] of Object.entries(COINGECKO_IDS)) {
      const price = data?.[cgId];
      if (typeof price === "number" && price > 0) {
        livePriceCache[symbol] = price;
      }
    }
    livePriceFetched = true;
  } catch {
    // Fallback prices if CoinGecko is unreachable
    if (!livePriceCache.BTC) livePriceCache.BTC = 84750;
    if (!livePriceCache.ETH) livePriceCache.ETH = 2185;
    if (!livePriceCache.SOL) livePriceCache.SOL = 128.5;
    livePriceFetched = true;
  }

  return livePriceCache;
}

/**
 * Get demo markets with live crypto prices as start prices.
 * Call this from hooks — it fetches prices once, then uses cache.
 */
export async function getDemoMarketsLive(): Promise<Market[]> {
  const prices = await fetchLivePrices();
  const markets = getDemoMarkets();

  // Patch crypto markets with live start prices and dynamic questions
  return markets.map((m) => {
    if (m.marketType !== "crypto_updown" || !m.cryptoAsset) return m;

    const livePrice = prices[m.cryptoAsset];
    if (!livePrice) return m;

    const formatted = livePrice.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    if (m.cryptoSubtype === "up_down") {
      return {
        ...m,
        startPrice: livePrice,
        question: `${m.cryptoAsset} Up or Down in ${m.cryptoTimeframe === "5m" ? "5 Minutes" : m.cryptoTimeframe === "15m" ? "15 Minutes" : m.cryptoTimeframe === "1h" ? "1 Hour" : m.cryptoTimeframe === "4h" ? "4 Hours" : "24 Hours"}?`,
        description: `Will ${m.cryptoAsset === "BTC" ? "Bitcoin" : m.cryptoAsset === "ETH" ? "Ethereum" : "Solana"} price go up or down from $${formatted} within ${m.cryptoTimeframe}? Resolved automatically via Pyth Network oracle.`,
      };
    } else {
      // price_target — set start to live, keep strike as-is
      const strikePrice = m.strikePrice || Math.round(livePrice * 1.005);
      return {
        ...m,
        startPrice: livePrice,
        strikePrice,
        question: `Will ${m.cryptoAsset} be above $${strikePrice.toLocaleString()} in ${m.cryptoTimeframe === "1h" ? "1 Hour" : m.cryptoTimeframe === "4h" ? "4 Hours" : m.cryptoTimeframe}?`,
        description: `Will ${m.cryptoAsset === "BTC" ? "Bitcoin" : m.cryptoAsset === "ETH" ? "Ethereum" : "Solana"} exceed $${strikePrice.toLocaleString()} within ${m.cryptoTimeframe}? Current price: $${formatted}. Resolved automatically via Pyth Network oracle.`,
      };
    }
  });
}

function withAmmDefaults(m: Market): Market {
  const yesPool = Math.round(m.liquidityPool * m.yesPrice);
  const noPool = m.liquidityPool - yesPool;
  const creatorLiquidity = Math.round(m.liquidityPool * 0.5);
  return {
    ...m,
    marketType: m.marketType || "prediction",
    status: m.resolved ? ("resolved" as const) : ("active" as const),
    yesPool,
    noPool,
    feesCollected: Math.round(m.totalVolume * 0.02),
    creatorYesLiquidity: creatorLiquidity,
    creatorNoLiquidity: creatorLiquidity,
    creatorLiquidityWithdrawn: false,
  };
}

function withCryptoDefaults(m: Market): Market {
  const yesPool = Math.round(m.liquidityPool * m.yesPrice);
  const noPool = m.liquidityPool - yesPool;
  return {
    ...m,
    marketType: "crypto_updown",
    status: "active" as const,
    yesPool,
    noPool,
    feesCollected: Math.round(m.totalVolume * 0.02),
    creatorYesLiquidity: Math.round(m.liquidityPool * 0.5),
    creatorNoLiquidity: Math.round(m.liquidityPool * 0.5),
    creatorLiquidityWithdrawn: false,
  };
}

export function getDemoMarkets(): Market[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    // ── Crypto ──
    withAmmDefaults({
      id: "demo-1",
      publicKey: "Demo11111111111111111111111111111111111111",
      question: "Will Bitcoin exceed $150,000 by end of Q2 2026?",
      description:
        "Resolves YES if BTC/USD on any major exchange exceeds $150,000 at any point before June 30, 2026.",
      creator: "BtcMax7777777777777777777777777777777777777",
      category: "crypto",
      coverImage:
        "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&q=80",
      resolutionDate: now + 86400 * 115,
      dataSourceUrl: "https://www.coingecko.com/en/coins/bitcoin",
      outcome: "unresolved",
      yesShares: 15000,
      noShares: 10000,
      totalVolume: 50_000_000_000,
      liquidityPool: 25_000_000_000,
      yesPrice: 0.6,
      noPrice: 0.4,
      resolved: false,
      createdAt: now - 86400 * 5,
    }),
    withAmmDefaults({
      id: "demo-2",
      publicKey: "Demo22222222222222222222222222222222222222",
      question: "Will Ethereum implement full danksharding in 2026?",
      description:
        "Resolves YES if Ethereum mainnet activates full danksharding (not proto-danksharding) before December 31, 2026.",
      creator: "EthDev3333333333333333333333333333333333333",
      category: "crypto",
      resolutionDate: now + 86400 * 90,
      dataSourceUrl: "https://ethereum.org/en/roadmap/danksharding/",
      outcome: "unresolved",
      yesShares: 8000,
      noShares: 22000,
      totalVolume: 30_000_000_000,
      liquidityPool: 15_000_000_000,
      yesPrice: 0.267,
      noPrice: 0.733,
      resolved: false,
      createdAt: now - 86400 * 10,
    }),
    withAmmDefaults({
      id: "demo-3",
      publicKey: "Demo33333333333333333333333333333333333333",
      question: "Will Solana TPS exceed 100,000 sustained for 24h?",
      description:
        "Resolves YES if Solana mainnet-beta sustains over 100,000 real (non-vote) TPS for a continuous 24-hour period.",
      creator: "SolWhale5555555555555555555555555555555555555",
      category: "crypto",
      resolutionDate: now + 86400 * 60,
      dataSourceUrl: "https://explorer.solana.com/",
      outcome: "unresolved",
      yesShares: 12000,
      noShares: 12000,
      totalVolume: 20_000_000_000,
      liquidityPool: 10_000_000_000,
      yesPrice: 0.5,
      noPrice: 0.5,
      resolved: false,
      createdAt: now - 86400 * 3,
    }),
    withAmmDefaults({
      id: "demo-4",
      publicKey: "Demo44444444444444444444444444444444444444",
      question: "Will the US approve a spot Solana ETF by July 2026?",
      description:
        "Resolves YES if the SEC approves at least one spot Solana ETF for trading on a US exchange before July 1, 2026.",
      creator: "RegWatch4444444444444444444444444444444444444",
      category: "crypto",
      coverImage:
        "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80",
      resolutionDate: now + 86400 * 120,
      dataSourceUrl: "https://www.sec.gov/",
      outcome: "unresolved",
      yesShares: 18000,
      noShares: 7000,
      totalVolume: 80_000_000_000,
      liquidityPool: 40_000_000_000,
      yesPrice: 0.72,
      noPrice: 0.28,
      resolved: false,
      createdAt: now - 86400 * 15,
    }),
    // ── Finance ──
    withAmmDefaults({
      id: "demo-5",
      publicKey: "Demo55555555555555555555555555555555555555",
      question: "Will the Fed cut rates below 4% by end of 2026?",
      description:
        "Resolves YES if the Federal Reserve cuts the federal funds rate target below 4.00% before December 31, 2026.",
      creator: "MacroBull8888888888888888888888888888888888888",
      category: "finance",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://www.federalreserve.gov/",
      outcome: "unresolved",
      yesShares: 14000,
      noShares: 16000,
      totalVolume: 45_000_000_000,
      liquidityPool: 22_000_000_000,
      yesPrice: 0.47,
      noPrice: 0.53,
      resolved: false,
      createdAt: now - 86400 * 7,
    }),
    withAmmDefaults({
      id: "demo-6",
      publicKey: "Demo66666666666666666666666666666666666666",
      question: "Will the S&P 500 close above 6,500 before July 2026?",
      description:
        "Resolves YES if the S&P 500 index closes above 6,500 on any trading day before July 1, 2026.",
      creator: "StockPick1111111111111111111111111111111111111",
      category: "finance",
      coverImage:
        "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&q=80",
      resolutionDate: now + 86400 * 120,
      dataSourceUrl: "https://finance.yahoo.com/",
      outcome: "unresolved",
      yesShares: 20000,
      noShares: 8000,
      totalVolume: 65_000_000_000,
      liquidityPool: 32_000_000_000,
      yesPrice: 0.71,
      noPrice: 0.29,
      resolved: false,
      createdAt: now - 86400 * 4,
    }),
    withAmmDefaults({
      id: "demo-7",
      publicKey: "Demo77777777777777777777777777777777777777",
      question: "Will US inflation drop below 2.5% by Q3 2026?",
      description:
        "Resolves YES if US CPI year-over-year falls below 2.5% in any monthly report before October 1, 2026.",
      creator: "MacroBull8888888888888888888888888888888888888",
      category: "finance",
      resolutionDate: now + 86400 * 210,
      dataSourceUrl: "https://www.bls.gov/cpi/",
      outcome: "unresolved",
      yesShares: 11000,
      noShares: 14000,
      totalVolume: 38_000_000_000,
      liquidityPool: 19_000_000_000,
      yesPrice: 0.44,
      noPrice: 0.56,
      resolved: false,
      createdAt: now - 86400 * 9,
    }),
    // ── Politics ──
    withAmmDefaults({
      id: "demo-8",
      publicKey: "Demo88888888888888888888888888888888888888",
      question: "Will a US TikTok ban take effect in 2026?",
      description:
        "Resolves YES if TikTok becomes unavailable on US app stores due to federal legislation or executive order before December 31, 2026.",
      creator: "PolWatch2222222222222222222222222222222222222",
      category: "politics",
      coverImage:
        "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://www.congress.gov/",
      outcome: "unresolved",
      yesShares: 16000,
      noShares: 9000,
      totalVolume: 55_000_000_000,
      liquidityPool: 27_000_000_000,
      yesPrice: 0.64,
      noPrice: 0.36,
      resolved: false,
      createdAt: now - 86400 * 6,
    }),
    withAmmDefaults({
      id: "demo-9",
      publicKey: "Demo99999999999999999999999999999999999999",
      question: "Will Congress pass a federal stablecoin bill in 2026?",
      description:
        "Resolves YES if both chambers of the US Congress pass stablecoin regulatory legislation before December 31, 2026.",
      creator: "PolWatch2222222222222222222222222222222222222",
      category: "politics",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://www.congress.gov/",
      outcome: "unresolved",
      yesShares: 10000,
      noShares: 15000,
      totalVolume: 30_000_000_000,
      liquidityPool: 15_000_000_000,
      yesPrice: 0.4,
      noPrice: 0.6,
      resolved: false,
      createdAt: now - 86400 * 14,
    }),
    withAmmDefaults({
      id: "demo-10",
      publicKey: "DemoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      question: "Will the EU finalize MiCA enforcement by mid-2026?",
      description:
        "Resolves YES if MiCA crypto regulation is fully enforced across all EU member states before July 1, 2026.",
      creator: "EUWatch3333333333333333333333333333333333333",
      category: "politics",
      resolutionDate: now + 86400 * 120,
      dataSourceUrl: "https://www.europarl.europa.eu/",
      outcome: "unresolved",
      yesShares: 19000,
      noShares: 6000,
      totalVolume: 42_000_000_000,
      liquidityPool: 21_000_000_000,
      yesPrice: 0.76,
      noPrice: 0.24,
      resolved: false,
      createdAt: now - 86400 * 11,
    }),
    // ── World Events ──
    withAmmDefaults({
      id: "demo-11",
      publicKey: "DemoBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
      question: "Will a ceasefire in Ukraine hold for 90+ days in 2026?",
      description:
        "Resolves YES if an official ceasefire agreement between Russia and Ukraine lasts at least 90 consecutive days during 2026.",
      creator: "WorldWatch444444444444444444444444444444444444",
      category: "world",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://www.reuters.com/",
      outcome: "unresolved",
      yesShares: 7000,
      noShares: 18000,
      totalVolume: 40_000_000_000,
      liquidityPool: 20_000_000_000,
      yesPrice: 0.28,
      noPrice: 0.72,
      resolved: false,
      createdAt: now - 86400 * 8,
    }),
    withAmmDefaults({
      id: "demo-12",
      publicKey: "DemoCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
      question:
        "Will global average temperature set a new record in 2026?",
      description:
        "Resolves YES if 2026 becomes the hottest year on record per NASA GISS data, surpassing 2024/2025.",
      creator: "WorldWatch444444444444444444444444444444444444",
      category: "world",
      coverImage:
        "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=800&q=80",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://data.giss.nasa.gov/gistemp/",
      outcome: "unresolved",
      yesShares: 13000,
      noShares: 12000,
      totalVolume: 25_000_000_000,
      liquidityPool: 12_000_000_000,
      yesPrice: 0.52,
      noPrice: 0.48,
      resolved: false,
      createdAt: now - 86400 * 2,
    }),
    withAmmDefaults({
      id: "demo-13",
      publicKey: "DemoDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDDD",
      question:
        "Will El Salvador issue a Bitcoin-backed bond in 2026?",
      description:
        "Resolves YES if El Salvador successfully issues a sovereign bond backed by or denominated in Bitcoin before December 31, 2026.",
      creator: "WorldWatch444444444444444444444444444444444444",
      category: "world",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://www.reuters.com/",
      outcome: "unresolved",
      yesShares: 9000,
      noShares: 16000,
      totalVolume: 18_000_000_000,
      liquidityPool: 9_000_000_000,
      yesPrice: 0.36,
      noPrice: 0.64,
      resolved: false,
      createdAt: now - 86400 * 13,
    }),
    // ── Tech ──
    withAmmDefaults({
      id: "demo-14",
      publicKey: "DemoEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEEE",
      question: "Will GPT-5 be released before September 2026?",
      description:
        "Resolves YES if OpenAI publicly releases GPT-5 (or equivalent next-gen model) before September 1, 2026.",
      creator: "AiTrader6666666666666666666666666666666666666",
      category: "tech",
      coverImage:
        "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80",
      videoUrl: "https://www.youtube.com/watch?v=_dDh3eOtJuI",
      resolutionDate: now + 86400 * 180,
      dataSourceUrl: "https://openai.com/",
      outcome: "unresolved",
      yesShares: 25000,
      noShares: 10000,
      totalVolume: 120_000_000_000,
      liquidityPool: 60_000_000_000,
      yesPrice: 0.71,
      noPrice: 0.29,
      resolved: false,
      createdAt: now - 86400 * 2,
    }),
    withAmmDefaults({
      id: "demo-15",
      publicKey: "DemoFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
      question: "Will Apple ship an AI-native Siri in iOS 20?",
      description:
        "Resolves YES if Apple announces and ships a fully LLM-powered Siri replacement in iOS 20 at WWDC 2026.",
      creator: "TechBull5555555555555555555555555555555555555",
      category: "tech",
      resolutionDate: now + 86400 * 100,
      dataSourceUrl: "https://developer.apple.com/",
      outcome: "unresolved",
      yesShares: 17000,
      noShares: 8000,
      totalVolume: 55_000_000_000,
      liquidityPool: 27_000_000_000,
      yesPrice: 0.68,
      noPrice: 0.32,
      resolved: false,
      createdAt: now - 86400 * 1,
    }),
    withAmmDefaults({
      id: "demo-16",
      publicKey: "DemoGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG",
      question:
        "Will an AI model score above 90% on the ARC-AGI benchmark?",
      description:
        "Resolves YES if any publicly benchmarked AI model achieves above 90% on the ARC-AGI evaluation before December 31, 2026.",
      creator: "AiTrader6666666666666666666666666666666666666",
      category: "tech",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://arcprize.org/",
      outcome: "unresolved",
      yesShares: 6000,
      noShares: 19000,
      totalVolume: 35_000_000_000,
      liquidityPool: 17_000_000_000,
      yesPrice: 0.24,
      noPrice: 0.76,
      resolved: false,
      createdAt: now - 86400 * 3,
    }),
    // ── Sports ──
    withAmmDefaults({
      id: "demo-17",
      publicKey: "DemoHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
      question:
        "Will the US win the most gold medals at the 2026 Winter Olympics?",
      description:
        "Resolves YES if the United States wins the most gold medals at the 2026 Milan-Cortina Winter Olympics.",
      creator: "SportsBet777777777777777777777777777777777777",
      category: "sports",
      coverImage:
        "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&q=80",
      resolutionDate: now + 86400 * 350,
      dataSourceUrl: "https://olympics.com/",
      outcome: "unresolved",
      yesShares: 7000,
      noShares: 18000,
      totalVolume: 22_000_000_000,
      liquidityPool: 11_000_000_000,
      yesPrice: 0.28,
      noPrice: 0.72,
      resolved: false,
      createdAt: now - 86400 * 4,
    }),
    withAmmDefaults({
      id: "demo-18",
      publicKey: "DemoIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIIII",
      question:
        "Will a FIFA Club World Cup match draw 100K+ viewers on-chain?",
      description:
        "Resolves YES if any 2025 FIFA Club World Cup match token/NFT engagement exceeds 100,000 unique on-chain interactions.",
      creator: "SportsBet777777777777777777777777777777777777",
      category: "sports",
      resolutionDate: now + 86400 * 90,
      dataSourceUrl: "https://www.fifa.com/",
      outcome: "unresolved",
      yesShares: 4000,
      noShares: 21000,
      totalVolume: 12_000_000_000,
      liquidityPool: 6_000_000_000,
      yesPrice: 0.16,
      noPrice: 0.84,
      resolved: false,
      createdAt: now - 86400 * 6,
    }),
    withAmmDefaults({
      id: "demo-19",
      publicKey: "DemoJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJJ",
      question:
        "Will an NBA team be tokenized on Solana by end of 2026?",
      description:
        "Resolves YES if any NBA franchise launches an official fan/ownership token on the Solana blockchain before December 31, 2026.",
      creator: "SportsBet777777777777777777777777777777777777",
      category: "sports",
      resolutionDate: now + 86400 * 300,
      dataSourceUrl: "https://www.nba.com/",
      outcome: "unresolved",
      yesShares: 5000,
      noShares: 20000,
      totalVolume: 15_000_000_000,
      liquidityPool: 7_500_000_000,
      yesPrice: 0.2,
      noPrice: 0.8,
      resolved: false,
      createdAt: now - 86400 * 1,
    }),
  ];
}

// Crypto Up/Down demo markets kept for reference but removed from main feed.
// Binary markets are now platform-controlled via the /binaries page.
function _unusedCryptoDefaults() {
  const now = Math.floor(Date.now() / 1000);
  return [
    withCryptoDefaults({
      id: "demo-crypto-1",
      publicKey: "DemoC1111111111111111111111111111111111111111",
      question: "BTC Up or Down in 15 Minutes?",
      description:
        "Will Bitcoin price go up or down from $84,750 within 15 minutes? Resolved automatically via Pyth Network oracle.",
      creator: "CryptoTrader111111111111111111111111111111111",
      category: "crypto",
      resolutionDate: now + 900,
      dataSourceUrl: "https://pyth.network/",
      outcome: "unresolved",
      yesShares: 8000,
      noShares: 6000,
      totalVolume: 10_000_000_000,
      liquidityPool: 5_000_000_000,
      yesPrice: 0.57,
      noPrice: 0.43,
      resolved: false,
      createdAt: now - 600,
      cryptoAsset: "BTC",
      cryptoTimeframe: "15m",
      cryptoSubtype: "up_down",
      startPrice: 84750,
      oracleSource: "pyth",
    }),
    withCryptoDefaults({
      id: "demo-crypto-2",
      publicKey: "DemoC2222222222222222222222222222222222222222",
      question: "Will ETH be above $2,200 in 1 Hour?",
      description:
        "Will Ethereum exceed $2,200 within 1 hour? Current price: $2,185. Resolved automatically via Pyth Network oracle.",
      creator: "CryptoTrader222222222222222222222222222222222",
      category: "crypto",
      resolutionDate: now + 3600,
      dataSourceUrl: "https://pyth.network/",
      outcome: "unresolved",
      yesShares: 5000,
      noShares: 7000,
      totalVolume: 8_000_000_000,
      liquidityPool: 4_000_000_000,
      yesPrice: 0.42,
      noPrice: 0.58,
      resolved: false,
      createdAt: now - 1200,
      cryptoAsset: "ETH",
      cryptoTimeframe: "1h",
      cryptoSubtype: "price_target",
      strikePrice: 2200,
      startPrice: 2185,
      oracleSource: "pyth",
    }),
    withCryptoDefaults({
      id: "demo-crypto-3",
      publicKey: "DemoC3333333333333333333333333333333333333333",
      question: "SOL Up or Down in 5 Minutes?",
      description:
        "Will Solana price go up or down from $128.50 within 5 minutes? Resolved automatically via Pyth Network oracle.",
      creator: "CryptoTrader333333333333333333333333333333333",
      category: "crypto",
      resolutionDate: now + 300,
      dataSourceUrl: "https://pyth.network/",
      outcome: "unresolved",
      yesShares: 6000,
      noShares: 6000,
      totalVolume: 5_000_000_000,
      liquidityPool: 2_500_000_000,
      yesPrice: 0.5,
      noPrice: 0.5,
      resolved: false,
      createdAt: now - 120,
      cryptoAsset: "SOL",
      cryptoTimeframe: "5m",
      cryptoSubtype: "up_down",
      startPrice: 128.5,
      oracleSource: "pyth",
    }),
    withCryptoDefaults({
      id: "demo-crypto-4",
      publicKey: "DemoC4444444444444444444444444444444444444444",
      question: "Will BTC be above $85,000 in 4 Hours?",
      description:
        "Will Bitcoin exceed $85,000 within 4 hours? Current price: $84,750. Resolved automatically via Pyth Network oracle.",
      creator: "CryptoTrader111111111111111111111111111111111",
      category: "crypto",
      resolutionDate: now + 14400,
      dataSourceUrl: "https://pyth.network/",
      outcome: "unresolved",
      yesShares: 12000,
      noShares: 8000,
      totalVolume: 15_000_000_000,
      liquidityPool: 8_000_000_000,
      yesPrice: 0.6,
      noPrice: 0.4,
      resolved: false,
      createdAt: now - 3600,
      cryptoAsset: "BTC",
      cryptoTimeframe: "4h",
      cryptoSubtype: "price_target",
      strikePrice: 85000,
      startPrice: 84750,
      oracleSource: "pyth",
    }),
    withCryptoDefaults({
      id: "demo-crypto-5",
      publicKey: "DemoC5555555555555555555555555555555555555555",
      question: "ETH Up or Down in 24 Hours?",
      description:
        "Will Ethereum price go up or down from $2,185 within 24 hours? Resolved automatically via Pyth Network oracle.",
      creator: "CryptoTrader222222222222222222222222222222222",
      category: "crypto",
      resolutionDate: now + 86400,
      dataSourceUrl: "https://pyth.network/",
      outcome: "unresolved",
      yesShares: 9000,
      noShares: 11000,
      totalVolume: 20_000_000_000,
      liquidityPool: 10_000_000_000,
      yesPrice: 0.45,
      noPrice: 0.55,
      resolved: false,
      createdAt: now - 7200,
      cryptoAsset: "ETH",
      cryptoTimeframe: "24h",
      cryptoSubtype: "up_down",
      startPrice: 2185,
      oracleSource: "pyth",
    }),
  ];
}

export function getDemoMarketById(id: string): Market | null {
  const markets = getDemoMarkets();
  return markets.find((m) => m.id === id) || null;
}

export async function getDemoMarketByIdLive(id: string): Promise<Market | null> {
  const markets = await getDemoMarketsLive();
  return markets.find((m) => m.id === id) || null;
}

export function getDemoTrades(marketId: string): Trade[] {
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      id: "t1",
      marketId,
      trader: "Trader1111111111111111111111111111111111111",
      outcome: "yes",
      direction: "buy",
      shares: 500,
      price: 0.58,
      cost: 290_000_000,
      timestamp: now - 3600,
      fee: 5_800_000,
      txSignature: "5xAbC...demo1",
    },
    {
      id: "t2",
      marketId,
      trader: "Trader2222222222222222222222222222222222222",
      outcome: "no",
      direction: "buy",
      shares: 300,
      price: 0.41,
      cost: 123_000_000,
      timestamp: now - 7200,
      fee: 2_460_000,
      txSignature: "5xDeF...demo2",
    },
    {
      id: "t3",
      marketId,
      trader: "Trader3333333333333333333333333333333333333",
      outcome: "yes",
      direction: "sell",
      shares: 150,
      price: 0.62,
      cost: 93_000_000,
      timestamp: now - 10800,
      fee: 1_860_000,
      txSignature: "5xGhI...demo3",
    },
    {
      id: "t4",
      marketId,
      trader: "Trader1111111111111111111111111111111111111",
      outcome: "yes",
      direction: "buy",
      shares: 1000,
      price: 0.55,
      cost: 550_000_000,
      timestamp: now - 21600,
      fee: 11_000_000,
      txSignature: "5xJkL...demo4",
    },
    {
      id: "t5",
      marketId,
      trader: "Trader4444444444444444444444444444444444444",
      outcome: "no",
      direction: "buy",
      shares: 800,
      price: 0.38,
      cost: 304_000_000,
      timestamp: now - 43200,
      fee: 6_080_000,
      txSignature: "5xMnO...demo5",
    },
  ];
}
