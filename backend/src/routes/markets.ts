/**
 * Profitic Backend — Markets REST API Routes
 *
 * Endpoints:
 *   GET /markets             List markets (paginated, filterable by status/search)
 *   GET /markets/:id         Get a single market by on-chain ID
 *   GET /markets/:id/trades  Get trade history for a market
 *   GET /markets/:id/evidence Get evidence logs for a market
 */

import { Router, Request, Response } from "express";
import {
  getMarkets,
  getMarketById,
  getTradesByMarket,
  getEvidenceByMarket,
  getCommentsByMarket,
  insertComment,
} from "../services/database";
import { MarketStatus, PaginatedResponse, Market, Trade, Comment, MarketDetailResponse } from "../models/types";

const router = Router();

// ---------------------------------------------------------------------------
// GET /markets
// ---------------------------------------------------------------------------
// Query params:
//   status  — filter by market status (active, proposed_resolution, resolved, cancelled)
//   search  — full-text search on the market question
//   page    — page number (default 1)
//   limit   — results per page (default 20, max 100)
//
// Response: PaginatedResponse<Market>
// ---------------------------------------------------------------------------
router.get("/", async (req: Request, res: Response): Promise<void> => {
  try {
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    // Validate the status filter if provided.
    if (status && !Object.values(MarketStatus).includes(status as MarketStatus)) {
      res.status(400).json({
        error: `Invalid status filter. Must be one of: ${Object.values(MarketStatus).join(", ")}`,
      });
      return;
    }

    const { data, total } = await getMarkets({
      status: status as MarketStatus | undefined,
      search,
      page,
      limit,
    });

    const response: PaginatedResponse<Market> = {
      data,
      total,
      page,
      limit,
    };

    res.json(response);
  } catch (err) {
    console.error("[markets] GET /markets error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /markets/:id
// ---------------------------------------------------------------------------
// Path params:
//   id — on-chain market ID (integer)
//
// Response: MarketDetailResponse (market + 10 most recent trades)
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

    // Include the 10 most recent trades for this market in the detail response.
    const { data: recent_trades } = await getTradesByMarket(id, { limit: 10 });

    const response: MarketDetailResponse = {
      market,
      recent_trades,
    };

    res.json(response);
  } catch (err) {
    console.error(`[markets] GET /markets/${req.params.id} error:`, err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /markets/:id/trades
// ---------------------------------------------------------------------------
// Path params:
//   id — on-chain market ID
//
// Query params:
//   page  — page number (default 1)
//   limit — results per page (default 50, max 200)
//
// Response: PaginatedResponse<Trade>
// ---------------------------------------------------------------------------
router.get("/:id/trades", async (req: Request, res: Response): Promise<void> => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Market ID must be an integer" });
      return;
    }

    // Verify the market exists before querying trades.
    const market = await getMarketById(id);
    if (!market) {
      res.status(404).json({ error: "Market not found" });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

    const { data, total } = await getTradesByMarket(id, { page, limit });

    const response: PaginatedResponse<Trade> = {
      data,
      total,
      page,
      limit,
    };

    res.json(response);
  } catch (err) {
    console.error(`[markets] GET /markets/${req.params.id}/trades error:`, err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ---------------------------------------------------------------------------
// GET /markets/:id/evidence
// ---------------------------------------------------------------------------
// Path params:
//   id — on-chain market ID
//
// Response: { data: EvidenceLog[] }
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

export default router;
