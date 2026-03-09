/**
 * Profitic Backend — Markets REST API Routes
 *
 * Endpoints:
 *   GET /markets               List markets (paginated, filterable by status/search/market_type)
 *   GET /markets/trending      Get trending markets by volume
 *   GET /markets/:id           Get a single market by on-chain ID
 *   GET /markets/:id/trades    Get trade history for a market
 *   GET /markets/:id/evidence  Get evidence logs for a market
 *   GET /markets/:id/liquidity Get liquidity provisions for a market
 *   GET /markets/:id/price     Get live oracle price (crypto markets only)
 *   GET /treasury              Get treasury fee summary
 */

import { Router, Request, Response } from "express";
import {
  getMarkets,
  getMarketById,
  getTradesByMarket,
  getEvidenceByMarket,
  getCommentsByMarket,
  insertComment,
  getLiquidityProvisions,
  getTrendingMarkets,
  getTreasurySummary,
} from "../services/database";
import { getPrice } from "../services/oracle";
import { MarketStatus, PaginatedResponse, Market, Trade, Comment, MarketDetailResponse, LiquidityProvision } from "../models/types";

const router = Router();

// ---------------------------------------------------------------------------
// GET /markets
// ---------------------------------------------------------------------------
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    if (status && !Object.values(MarketStatus).includes(status as MarketStatus)) {
      res.status(400).json({
        error: `Invalid status filter. Must be one of: ${Object.values(MarketStatus).join(", ")}`,
      });
      return;
    }

    const marketType = req.query.market_type as string | undefined;

    const { data, total } = await getMarkets({
      status: status as MarketStatus | undefined,
      search,
      page,
      limit,
      marketType,
    });

    const response: PaginatedResponse<Market> = { data, total, page, limit };
    res.json(response);
  } catch (err) {
    console.error("[markets] GET /markets error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /markets/trending
// ---------------------------------------------------------------------------
router.get("/trending", async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const markets = await getTrendingMarkets(limit);
    res.json({ data: markets });
  } catch (err) {
    console.error("[markets] GET /markets/trending error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /markets/:id
// ---------------------------------------------------------------------------
router.get("/:id", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Market ID must be an integer" });
      return;
    }

    const market = await getMarketById(id);
    if (!market) {
      res.status(404).json({ error: "Market not found" });
      return;
    }

    const { data: recent_trades } = await getTradesByMarket(id, { limit: 10 });

    const response: MarketDetailResponse = { market, recent_trades };
    res.json(response);
  } catch (err) {
    console.error(`[markets] GET /markets/${req.params.id} error:`, err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /markets/:id/trades
// ---------------------------------------------------------------------------
router.get("/:id/trades", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Market ID must be an integer" });
      return;
    }

    const market = await getMarketById(id);
    if (!market) {
      res.status(404).json({ error: "Market not found" });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    const { data, total } = await getTradesByMarket(id, { page, limit });

    const response: PaginatedResponse<Trade> = { data, total, page, limit };
    res.json(response);
  } catch (err) {
    console.error(`[markets] GET /markets/${req.params.id}/trades error:`, err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /markets/:id/evidence
// ---------------------------------------------------------------------------
router.get("/:id/evidence", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Market ID must be an integer" });
      return;
    }

    const market = await getMarketById(id);
    if (!market) {
      res.status(404).json({ error: "Market not found" });
      return;
    }

    const evidence = await getEvidenceByMarket(id);
    res.json({ data: evidence });
  } catch (err) {
    console.error(`[markets] GET /markets/${req.params.id}/evidence error:`, err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /markets/:id/liquidity
// ---------------------------------------------------------------------------
router.get("/:id/liquidity", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Market ID must be an integer" });
      return;
    }

    const market = await getMarketById(id);
    if (!market) {
      res.status(404).json({ error: "Market not found" });
      return;
    }

    const provisions = await getLiquidityProvisions(id);
    const totalLiquidity = (BigInt(market.yes_pool) + BigInt(market.no_pool)).toString();

    res.json({
      market_id: id,
      total_liquidity: totalLiquidity,
      yes_pool: market.yes_pool,
      no_pool: market.no_pool,
      creator_yes_liquidity: market.creator_yes_liquidity,
      creator_no_liquidity: market.creator_no_liquidity,
      creator_liquidity_withdrawn: market.creator_liquidity_withdrawn,
      fees_collected: market.fees_collected,
      provisions,
    });
  } catch (err) {
    console.error(`[markets] GET /markets/${req.params.id}/liquidity error:`, err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /markets/:id/comments
// ---------------------------------------------------------------------------
router.get("/:id/comments", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Market ID must be an integer" });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    const { data, total } = await getCommentsByMarket(id, { page, limit });

    const response: PaginatedResponse<Comment> = { data, total, page, limit };
    res.json(response);
  } catch (err) {
    console.error(`[markets] GET /markets/${req.params.id}/comments error:`, err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// POST /markets/:id/comments
// ---------------------------------------------------------------------------
router.post("/:id/comments", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Market ID must be an integer" });
      return;
    }

    const { user_address, body } = req.body;
    if (!user_address || typeof user_address !== "string") {
      res.status(400).json({ error: "user_address is required" });
      return;
    }
    if (!body || typeof body !== "string" || body.trim().length === 0) {
      res.status(400).json({ error: "body is required and must not be empty" });
      return;
    }
    if (body.length > 1000) {
      res.status(400).json({ error: "body must be 1000 characters or fewer" });
      return;
    }

    const market = await getMarketById(id);
    if (!market) {
      res.status(404).json({ error: "Market not found" });
      return;
    }

    const comment = await insertComment({ market_id: id, user_address, body: body.trim() });
    res.status(201).json(comment);
  } catch (err) {
    console.error(`[markets] POST /markets/${req.params.id}/comments error:`, err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /markets/:id/price — Live oracle price for crypto markets
// ---------------------------------------------------------------------------
router.get("/:id/price", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Market ID must be an integer" });
      return;
    }

    const market = await getMarketById(id);
    if (!market) {
      res.status(404).json({ error: "Market not found" });
      return;
    }

    if (market.market_type !== "crypto_updown" || !market.crypto_asset) {
      res.status(400).json({ error: "Price endpoint only available for Crypto Up/Down markets" });
      return;
    }

    const priceData = await getPrice(market.crypto_asset);
    res.json({
      market_id: id,
      asset: market.crypto_asset,
      current_price: priceData.price,
      start_price: market.start_price,
      strike_price: market.strike_price,
      confidence: priceData.confidence,
      source: priceData.source,
      timestamp: priceData.timestamp,
    });
  } catch (err) {
    console.error(`[markets] GET /markets/${req.params.id}/price error:`, err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
