// ── Chat Types ──
// Architecture: messages are typed for future real-time integration
// (e.g. WebSocket / Supabase Realtime / Socket.io).
// The demo generates fake messages; the live version will swap in
// a real provider that pushes ChatMessage objects through the same interface.

import { CryptoAsset } from "./index";

export interface ChatMessage {
  id: string;
  roomId: string;           // e.g. "BTC-5m-42" (asset-timeframe-roundNumber)
  wallet: string;           // sender wallet (truncated for display)
  displayName?: string;     // optional display name
  avatar?: string;          // optional avatar URL
  body: string;
  timestamp: number;        // unix ms
  side?: "up" | "down";     // optional: shows which side the user is betting
}

export interface ChatRoom {
  id: string;
  asset: CryptoAsset;
  roundNumber: number;
  messages: ChatMessage[];
}

// For future real-time provider interface
export interface ChatProvider {
  subscribe(roomId: string, onMessage: (msg: ChatMessage) => void): () => void;
  send(roomId: string, message: Omit<ChatMessage, "id" | "timestamp">): Promise<void>;
}
