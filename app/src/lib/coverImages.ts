/**
 * Auto-generates a relevant cover image URL based on the market question.
 * Uses curated Unsplash photos mapped to keywords, with category fallbacks.
 */

type ImageEntry = { keywords: string[]; url: string };

const KEYWORD_IMAGES: ImageEntry[] = [
  // Crypto — specific coins
  { keywords: ["bitcoin", "btc"], url: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800&q=80" },
  { keywords: ["ethereum", "eth", "danksharding"], url: "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=800&q=80" },
  { keywords: ["solana", "sol"], url: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80" },
  { keywords: ["nft"], url: "https://images.unsplash.com/photo-1646463535957-10e0e3333266?w=800&q=80" },
  { keywords: ["etf", "sec", "regulation"], url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80" },

  // Finance
  { keywords: ["fed", "federal reserve", "interest rate", "rate cut"], url: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&q=80" },
  { keywords: ["s&p", "stock", "nasdaq", "dow"], url: "https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=800&q=80" },
  { keywords: ["inflation", "cpi", "prices"], url: "https://images.unsplash.com/photo-1554672408-730436b60dde?w=800&q=80" },
  { keywords: ["recession", "gdp", "economy"], url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80" },
  { keywords: ["bond", "treasury", "debt"], url: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&q=80" },

  // Politics
  { keywords: ["tiktok", "ban"], url: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80" },
  { keywords: ["election", "vote", "president", "presidential"], url: "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?w=800&q=80" },
  { keywords: ["congress", "senate", "legislation", "bill", "stablecoin"], url: "https://images.unsplash.com/photo-1523995462485-3d171b5c8fa9?w=800&q=80" },
  { keywords: ["eu ", "europe", "mica", "european"], url: "https://images.unsplash.com/photo-1519677100203-a0e668c92439?w=800&q=80" },

  // World Events
  { keywords: ["war", "ceasefire", "ukraine", "conflict", "peace"], url: "https://images.unsplash.com/photo-1569025743873-ea3a9ber?w=800&q=80" },
  { keywords: ["temperature", "climate", "warming", "weather"], url: "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=800&q=80" },
  { keywords: ["el salvador", "latin america"], url: "https://images.unsplash.com/photo-1592420714673-64ee2e75dc0d?w=800&q=80" },
  { keywords: ["china", "chinese"], url: "https://images.unsplash.com/photo-1547981609-4b6bfe67ca0b?w=800&q=80" },
  { keywords: ["india", "indian"], url: "https://images.unsplash.com/photo-1524492412937-b28074a5d7da?w=800&q=80" },

  // Tech
  { keywords: ["gpt", "openai", "chatgpt", "llm", "ai model"], url: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80" },
  { keywords: ["apple", "siri", "ios", "iphone"], url: "https://images.unsplash.com/photo-1491933382434-500287f9b54b?w=800&q=80" },
  { keywords: ["google", "android", "gemini"], url: "https://images.unsplash.com/photo-1573804633927-bfcbcd909acd?w=800&q=80" },
  { keywords: ["ai", "artificial intelligence", "machine learning"], url: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&q=80" },
  { keywords: ["robot", "automation"], url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800&q=80" },
  { keywords: ["space", "spacex", "nasa", "rocket", "mars"], url: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800&q=80" },

  // Sports
  { keywords: ["olympics", "olympic", "winter games"], url: "https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&q=80" },
  { keywords: ["fifa", "world cup", "soccer", "football"], url: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80" },
  { keywords: ["nba", "basketball"], url: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80" },
  { keywords: ["nfl", "super bowl"], url: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800&q=80" },
  { keywords: ["f1", "formula", "racing"], url: "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&q=80" },
  { keywords: ["tennis", "wimbledon"], url: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?w=800&q=80" },
];

const CATEGORY_FALLBACKS: Record<string, string> = {
  crypto: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800&q=80",
  finance: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80",
  politics: "https://images.unsplash.com/photo-1523995462485-3d171b5c8fa9?w=800&q=80",
  world: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80",
  tech: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80",
  sports: "https://images.unsplash.com/photo-1461896836934-bd45ba0be903?w=800&q=80",
};

const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=800&q=80";

export function getAutoCoverImage(question: string, category?: string): string {
  const q = question.toLowerCase();

  // Try keyword match first (most specific)
  for (const entry of KEYWORD_IMAGES) {
    if (entry.keywords.some((kw) => q.includes(kw))) {
      return entry.url;
    }
  }

  // Fall back to category
  if (category && CATEGORY_FALLBACKS[category]) {
    return CATEGORY_FALLBACKS[category];
  }

  return DEFAULT_IMAGE;
}
