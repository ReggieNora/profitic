/**
 * Profitic Backend — Users REST API Routes
 *
 * Endpoints:
 *   GET /users/:address/positions  Active and historical positions for a wallet
 *   GET /users/:address/history    Paginated trade history for a wallet
 */

import { Router, Request, Response } from "express";
import { PublicKey } from "@solana/web3.js";
import {
  getUserPositions,
  getUserTradeHistory,
} from "../services/database";
import { UserPositionResponse, UserHistoryResponse } from "../models/types";

const router = Router();

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

/**
 * Validate that a string looks like a valid Solana public key (base-58).
 * Returns `true` if valid, `false` otherwise.
 */
function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// GET /users/:address/positions
// ---------------------------------------------------------------------------
// Path params:
//   address — Solana wallet public key (base-58)
//
// Response: UserPositionResponse
//   Each position is enriched with the market question and current status
//   so the frontend can render a "My Positions" dashboard without extra calls.
// ---------------------------------------------------------------------------
router.get(
  "/:address/positions",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { address } = req.params;

      if (!isValidSolanaAddress(address)) {
        res.status(400).json({ error: "Invalid Solana wallet address" });
        return;
      }

      const positions = await getUserPositions(address);

      const response: UserPositionResponse = { positions };
      res.json(response);
    } catch (err) {
      console.error(`[users] GET /users/${req.params.address}/positions error:`, err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ---------------------------------------------------------------------------
// GET /users/:address/history
// ---------------------------------------------------------------------------
// Path params:
//   address — Solana wallet public key (base-58)
//
// Query params:
//   page  — page number (default 1)
//   limit — results per page (default 50, max 200)
//
// Response: UserHistoryResponse
//   Each trade is enriched with the market question for context.
// ---------------------------------------------------------------------------
router.get(
  "/:address/history",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { address } = req.params;

      if (!isValidSolanaAddress(address)) {
        res.status(400).json({ error: "Invalid Solana wallet address" });
        return;
      }

      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string, 10) || 50));

      const { data: trades, total } = await getUserTradeHistory(address, { page, limit });

      const response: UserHistoryResponse = {
        trades,
        total,
        page,
        limit,
      };

      res.json(response);
    } catch (err) {
      console.error(`[users] GET /users/${req.params.address}/history error:`, err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

export default router;
