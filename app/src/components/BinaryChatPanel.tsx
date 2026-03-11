"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { BinaryRound, CryptoAsset } from "@/types";
import { ChatMessage } from "@/types/chat";
import { CryptoLogo } from "./CryptoLogos";

// ── Demo data ──

const DEMO_NAMES = [
  "degen_whale", "sol_maxi", "chad_trader", "diamond_hands",
  "pump_king", "ape_in", "rekt_andy", "moon_boy", "ser_dumps",
  "ngmi_ned", "gm_gang", "based_betty", "floor_sweeper",
  "bag_holder", "exit_liquidity", "alpha_hunter", "cope_lord",
  "fomo_frank", "hodl_queen", "paper_hands",
];

const DEMO_WALLETS = DEMO_NAMES.map(() => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789";
  let w = "";
  for (let i = 0; i < 44; i++) w += chars[Math.floor(Math.random() * chars.length)];
  return w;
});

function randomDemoMessage(asset: CryptoAsset, side?: "up" | "down"): string {
  const bullish = [
    `${asset} to the moon!`,
    `Easy UP, ${asset} pumping rn`,
    `Aping UP hard on this one`,
    `${asset} looking bullish af`,
    `Diamond hands UP`,
    `${asset} breakout incoming`,
    `UP gang where you at?`,
    `This is the dip, ${asset} going higher`,
    `Bears are ngmi, UP all day`,
    `Loading more UP on ${asset}`,
  ];
  const bearish = [
    `${asset} going down, easy money`,
    `DOWN on this, charts look weak`,
    `${asset} overextended, shorting this`,
    `Sell the pump, DOWN`,
    `Bearish divergence on ${asset}`,
    `DOWN gang eating good today`,
    `${asset} rejection incoming`,
    `This is the top, going DOWN`,
    `Fading this pump on ${asset}`,
    `DOWN before the lock!`,
  ];
  const neutral = [
    `gm everyone`,
    `What's the play here?`,
    `${asset} looking interesting...`,
    `Anyone else watching the chart?`,
    `LFG!`,
    `Bets are open, let's go`,
    `Good luck degens`,
    `Who's in on this round?`,
    `${asset} vibes`,
    `This round is going to be spicy`,
  ];

  if (side === "up") return bullish[Math.floor(Math.random() * bullish.length)];
  if (side === "down") return bearish[Math.floor(Math.random() * bearish.length)];

  const r = Math.random();
  if (r < 0.4) return bullish[Math.floor(Math.random() * bullish.length)];
  if (r < 0.7) return bearish[Math.floor(Math.random() * bearish.length)];
  return neutral[Math.floor(Math.random() * neutral.length)];
}

function generateDemoMessage(asset: CryptoAsset, roomId: string): ChatMessage {
  const idx = Math.floor(Math.random() * DEMO_NAMES.length);
  const side = Math.random() < 0.6 ? (Math.random() < 0.55 ? "up" : "down") as "up" | "down" : undefined;
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    roomId,
    wallet: DEMO_WALLETS[idx].slice(0, 4) + "..." + DEMO_WALLETS[idx].slice(-4),
    displayName: DEMO_NAMES[idx],
    body: randomDemoMessage(asset, side),
    timestamp: Date.now(),
    side,
  };
}

// ── Component ──

interface BinaryChatPanelProps {
  round: BinaryRound;
  onClose: () => void;
}

export default function BinaryChatPanel({ round, onClose }: BinaryChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isVisible, setIsVisible] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const roomId = `${round.asset}-5m-${round.roundNumber}`;

  // Slide in on mount
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // Seed initial messages
  useEffect(() => {
    const seed: ChatMessage[] = [];
    const now = Date.now();
    for (let i = 0; i < 12; i++) {
      const msg = generateDemoMessage(round.asset, roomId);
      msg.timestamp = now - (12 - i) * 4000 + Math.random() * 2000;
      seed.push(msg);
    }
    setMessages(seed);
  }, [round.asset, roomId]);

  // Auto-generate new demo messages
  useEffect(() => {
    const interval = setInterval(() => {
      const msg = generateDemoMessage(round.asset, roomId);
      setMessages((prev) => [...prev.slice(-80), msg]);
    }, 2500 + Math.random() * 3000);
    return () => clearInterval(interval);
  }, [round.asset, roomId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  }, [onClose]);

  const handleSend = () => {
    const body = inputValue.trim();
    if (!body) return;
    const msg: ChatMessage = {
      id: `msg-${Date.now()}-self`,
      roomId,
      wallet: "You",
      displayName: "You",
      body,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev.slice(-80), msg]);
    setInputValue("");
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={`relative w-full max-w-lg transform transition-transform duration-300 ease-out ${
          isVisible ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ height: "75vh" }}
      >
        <div className="flex h-full flex-col rounded-t-3xl bg-gray-900 border border-white/10 border-b-0 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
            <div className="flex items-center gap-3">
              <CryptoLogo asset={round.asset} size={28} />
              <div>
                <h3 className="text-sm font-bold text-white">
                  {round.asset} Chat
                </h3>
                <p className="text-[10px] text-white/40">
                  Round #{round.roundNumber} &middot; {messages.length} messages
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-bold text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                {Math.floor(20 + Math.random() * 40)} online
              </span>
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/60 transition-all hover:bg-white/20 hover:text-white"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5"
          >
            {messages.map((msg) => {
              const isSelf = msg.displayName === "You";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${isSelf ? "flex-row-reverse" : ""}`}
                >
                  {/* Avatar */}
                  {!isSelf && (
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      msg.side === "up"
                        ? "bg-green-500/20 text-green-400"
                        : msg.side === "down"
                        ? "bg-red-500/20 text-red-400"
                        : "bg-white/10 text-white/60"
                    }`}>
                      {(msg.displayName || msg.wallet)[0].toUpperCase()}
                    </div>
                  )}

                  <div className={`max-w-[75%] ${isSelf ? "text-right" : ""}`}>
                    {/* Name + time */}
                    {!isSelf && (
                      <div className="mb-0.5 flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-white/50">
                          {msg.displayName || msg.wallet}
                        </span>
                        {msg.side && (
                          <span className={`text-[9px] font-bold ${
                            msg.side === "up" ? "text-green-400" : "text-red-400"
                          }`}>
                            {msg.side === "up" ? "↑UP" : "↓DN"}
                          </span>
                        )}
                        <span className="text-[9px] text-white/20">
                          {formatTime(msg.timestamp)}
                        </span>
                      </div>
                    )}

                    {/* Bubble */}
                    <div className={`inline-block rounded-2xl px-3.5 py-2 text-sm ${
                      isSelf
                        ? "bg-primary-500/30 text-white rounded-br-md"
                        : msg.side === "up"
                        ? "bg-green-500/10 text-white/90 rounded-bl-md"
                        : msg.side === "down"
                        ? "bg-red-500/10 text-white/90 rounded-bl-md"
                        : "bg-white/5 text-white/80 rounded-bl-md"
                    }`}>
                      {msg.body}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-white/10 px-4 py-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Say something..."
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none transition-all focus:border-primary-500/40"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-500 text-white transition-all hover:bg-primary-400 active:scale-95 disabled:opacity-30"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                </svg>
              </button>
            </div>
            <p className="mt-1.5 text-center text-[9px] text-white/20">
              Chat is per-round. Connect wallet for live chat.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
