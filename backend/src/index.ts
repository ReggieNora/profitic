/**
 * Profitic Backend — Express Server Entry Point
 *
 * Wires together:
 *   1. Express HTTP server with CORS and JSON body parsing
 *   2. REST API routes (/markets, /users)
 *   3. WebSocket server for real-time price and trade updates
 *   4. Solana on-chain indexer that feeds data into Postgres
 *
 * Lifecycle:
 *   - On startup: connect to Postgres, start the Express + WS server, then
 *     start the Solana log subscription.
 *   - On shutdown (SIGINT / SIGTERM): gracefully close the indexer, WS
 *     server, HTTP server, and DB pool in order.
 */

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";

import marketsRouter from "./routes/markets";
import usersRouter from "./routes/users";
import { healthCheck } from "./services/database";
import { startIndexer, stopIndexer } from "./services/indexer";
import { WsMessage } from "./models/types";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const PORT = parseInt(process.env.PORT || "3001", 10);

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging (lightweight — no external dependency needed).
app.use((req, _res, next) => {
  const start = Date.now();
  _res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(`[http] ${req.method} ${req.path} ${_res.statusCode} ${duration}ms`);
  });
  next();
});

// ---------------------------------------------------------------------------
// REST API routes
// ---------------------------------------------------------------------------

app.use("/api/markets", marketsRouter);
app.use("/api/users", usersRouter);

// Health-check endpoint — useful for load balancers and Docker health probes.
app.get("/api/health", async (_req, res) => {
  try {
    const ok = await healthCheck();
    if (!ok) throw new Error("Supabase query failed");
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("[health] Supabase check failed:", err);
    res.status(503).json({ status: "unhealthy", error: "Database connection failed" });
  }
});

// Catch-all 404 for unmatched routes.
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ---------------------------------------------------------------------------
// HTTP + WebSocket server
// ---------------------------------------------------------------------------

const server = http.createServer(app);

const wss = new WebSocketServer({
  server,
  path: "/ws",
});

/**
 * Set of currently connected WebSocket clients.
 * Used by the broadcast function to push real-time updates.
 */
const clients = new Set<WebSocket>();

wss.on("connection", (ws, req) => {
  const remoteAddr = req.socket.remoteAddress || "unknown";
  console.log(`[ws] Client connected from ${remoteAddr} (total: ${clients.size + 1})`);
  clients.add(ws);

  // Send a welcome message so the client knows the connection is alive.
  ws.send(JSON.stringify({ type: "connected", data: { timestamp: Date.now() } }));

  // Handle client messages (e.g. subscription filters for specific markets).
  ws.on("message", (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      console.log("[ws] Received from client:", msg);
      // Future: handle subscribe/unsubscribe to specific market channels.
      // Example: { type: "subscribe", market_id: 42 }
    } catch {
      // Ignore malformed messages.
    }
  });

  ws.on("close", () => {
    clients.delete(ws);
    console.log(`[ws] Client disconnected (remaining: ${clients.size})`);
  });

  ws.on("error", (err) => {
    console.error("[ws] Client error:", err);
    clients.delete(ws);
  });
});

/**
 * Broadcast a typed message to all connected WebSocket clients.
 * Passed to the indexer so it can push real-time updates without
 * depending on the WS module directly.
 */
function broadcast(msg: WsMessage): void {
  const payload = JSON.stringify(msg);
  let sent = 0;

  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
      sent++;
    }
  }

  if (sent > 0) {
    console.log(`[ws] Broadcast ${msg.type} to ${sent} client(s)`);
  }
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function start(): Promise<void> {
  console.log("=".repeat(60));
  console.log("  Profitic Backend — Solana Prediction Market Indexer");
  console.log("=".repeat(60));

  // Verify Supabase connectivity before accepting traffic.
  try {
    const ok = await healthCheck();
    if (!ok) throw new Error("Supabase query failed");
    console.log("[startup] Supabase connected");
  } catch (err) {
    console.error("[startup] Failed to connect to Supabase:", err);
    console.error("[startup] Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.");
    process.exit(1);
  }

  // Start the HTTP + WS server.
  server.listen(PORT, () => {
    console.log(`[startup] HTTP server listening on port ${PORT}`);
    console.log(`[startup] WebSocket available at ws://localhost:${PORT}/ws`);
    console.log("[startup] REST API:");
    console.log("           GET  /api/health");
    console.log("           GET  /api/markets");
    console.log("           GET  /api/markets/:id");
    console.log("           GET  /api/markets/:id/trades");
    console.log("           GET  /api/markets/:id/evidence");
    console.log("           GET  /api/markets/:id/comments");
    console.log("           POST /api/markets/:id/comments");
    console.log("           GET  /api/users/:address/positions");
    console.log("           GET  /api/users/:address/history");
  });

  // Start the Solana indexer — it subscribes to program logs and writes to Postgres.
  try {
    startIndexer(broadcast);
    console.log("[startup] Solana indexer started");
  } catch (err) {
    console.error("[startup] Failed to start indexer:", err);
    // The server still runs without the indexer — existing data is queryable.
    // The indexer can be restarted by restarting the process.
  }
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[shutdown] Received ${signal}, shutting down gracefully...`);

  // 1. Stop accepting new connections.
  server.close(() => {
    console.log("[shutdown] HTTP server closed");
  });

  // 2. Stop the Solana log subscription.
  await stopIndexer();

  // 3. Close all WebSocket connections.
  for (const client of clients) {
    client.close(1001, "Server shutting down");
  }
  clients.clear();
  console.log("[shutdown] WebSocket connections closed");

  console.log("[shutdown] Shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Handle uncaught errors so the process doesn't silently crash.
process.on("unhandledRejection", (reason) => {
  console.error("[fatal] Unhandled promise rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[fatal] Uncaught exception:", err);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

start().catch((err) => {
  console.error("[fatal] Startup failed:", err);
  process.exit(1);
});
