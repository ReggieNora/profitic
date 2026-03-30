"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCrashGame } from "@/hooks/useCrashGame";

export default function CrashGamePage() {
  const { publicKey } = useWallet();
  const {
    round, currentMultiplier, userBalances,
    placeBet, lockAndPrecompute, runRound, resetRound, fundWallet
  } = useCrashGame();

  const [amount, setAmount] = useState("10");
  const [target, setTarget] = useState("2.0");

  const me = publicKey ? publicKey.toBase58().slice(0, 6) : "Player1";

  // Auto fund for testing
  useEffect(() => {
    if (!userBalances[me]) fundWallet(me, 1000);
  }, [me, userBalances, fundWallet]);

  const handleBet = () => {
    if (parseFloat(amount) > 0 && parseFloat(target) >= 1.01) {
      placeBet(me, parseFloat(amount), parseFloat(target));
    }
  };

  const addDummyBet = () => {
    const dummyNames = ["Alice", "Bob", "Charlie", "Dave", "Eve", "Frank"];
    const name = dummyNames[Math.floor(Math.random() * dummyNames.length)] + Math.floor(Math.random() * 100);
    fundWallet(name, 500);
    const amt = Math.floor(Math.random() * 50) + 10;
    const tgt = (Math.random() * 4 + 1.1).toFixed(2);
    placeBet(name, amt, parseFloat(tgt));
  };

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] w-full bg-black p-4 sm:p-6 pb-24">
      <div className="mx-auto max-w-4xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-orange-500 text-lg">
                💥
              </div>
              <h1 className="text-2xl font-black text-white sm:text-3xl">PvP Crash</h1>
            </div>
            <p className="mt-1 text-sm text-white/50">Player vs Player. Deterministic pool payouts.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-surface-300/50 px-4 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wider text-white/50">Your Balance</p>
            <p className="text-xl font-bold text-emerald-400">{(userBalances[me] || 0).toFixed(2)}</p>
          </div>
        </div>

        {/* Main Game Screen */}
        <div className="relative flex h-64 flex-col items-center justify-center rounded-3xl border border-white/5 bg-surface-200 overflow-hidden shadow-2xl">
          <div className="absolute inset-0 bg-gradient-to-t from-red-500/5 to-transparent shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]" />

          <p className={`relative z-10 text-7xl sm:text-9xl font-black tracking-tighter transition-all duration-75 ${round.status === "ENDED" ? "text-red-500 scale-110 drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]" : "text-white drop-shadow-md"
            }`}>
            {currentMultiplier.toFixed(2)}x
          </p>

          <p className="relative z-10 mt-6 rounded-full bg-black/50 px-4 py-1 text-sm font-bold uppercase tracking-widest text-white/60 backdrop-blur-md border border-white/10">
            {round.status === "OPEN" && "Accepting Bets..."}
            {round.status === "LOCKED" && "Round Locked - Calculating"}
            {round.status === "RUNNING" && "Flying..."}
            {round.status === "ENDED" && "Crashed!"}
          </p>
        </div>

        {/* Admin / Flow Controls */}
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-blue-400/60">Game Loop Controls (Testing Engine)</p>
          <div className="flex flex-wrap gap-2">
            <button onClick={addDummyBet} disabled={round.status !== "OPEN"} className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-30 transition-all active:scale-95">
              + Inject Random Player
            </button>
            <button onClick={lockAndPrecompute} disabled={round.status !== "OPEN"} className="rounded-lg bg-yellow-500/20 px-4 py-2 text-sm font-semibold text-yellow-500 hover:bg-yellow-500/30 disabled:opacity-30 transition-all active:scale-95">
              Lock & Calc Pool
            </button>
            <button onClick={runRound} disabled={round.status !== "LOCKED"} className="rounded-lg bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-30 transition-all active:scale-95">
              Run Animation
            </button>
            <button onClick={resetRound} disabled={round.status !== "ENDED"} className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 disabled:opacity-30 transition-all active:scale-95">
              Next Round
            </button>
          </div>
        </div>

        {/* Action Area */}
        <div className="grid gap-4 md:grid-cols-3">

          <div className="col-span-1 space-y-4 rounded-3xl border border-white/5 bg-surface-300 p-5 sm:p-6">
            <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">Place Bet</h2>

            <div>
              <label className="text-[10px] uppercase font-bold text-white/40">Bet Amount</label>
              <div className="relative mt-1">
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} disabled={round.status !== "OPEN"} className="w-full rounded-xl border border-white/10 bg-black p-3 pl-8 text-white outline-none transition-all focus:border-emerald-500/50" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30">$</span>
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-white/40">Target Multiplier</label>
              <div className="relative mt-1">
                <input type="number" step="0.1" value={target} onChange={e => setTarget(e.target.value)} disabled={round.status !== "OPEN"} className="w-full rounded-xl border border-white/10 bg-black p-3 pr-8 text-white outline-none transition-all focus:border-emerald-500/50" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 font-bold">x</span>
              </div>
            </div>

            <button onClick={handleBet} disabled={round.status !== "OPEN"} className="mt-2 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-4 text-sm font-black uppercase tracking-wider text-black shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-30 disabled:grayscale">
              Enter Round
            </button>
          </div>

          <div className="col-span-1 md:col-span-2 space-y-4 rounded-3xl border border-white/5 bg-surface-300 p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">PvP Pot Data</h2>
              <div className="flex gap-4 rounded-lg bg-black/50 px-3 py-1.5 text-xs text-white/50 border border-white/5">
                <p>Total: <span className="font-bold text-white">{round.totalPot.toFixed(2)}</span></p>
                <p className="border-l border-white/10 pl-4">Payout Pool (97%): <span className="font-bold text-emerald-400">{round.payoutPool.toFixed(2)}</span></p>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto rounded-xl border border-white/5 bg-black/20">
              <table className="w-full text-left text-sm text-white/70">
                <thead className="sticky top-0 bg-surface-200 text-[10px] uppercase tracking-wider text-white/40 shadow-sm">
                  <tr>
                    <th className="px-4 py-3 font-medium">Player</th>
                    <th className="px-4 py-3 font-medium">Bet</th>
                    <th className="px-4 py-3 font-medium">Target</th>
                    <th className="px-4 py-3 font-medium text-right">Result</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {[...round.bets].sort((a, b) => b.amount - a.amount).map(bet => (
                    <tr key={bet.id} className="transition-colors hover:bg-white/5">
                      <td className="px-4 py-3 font-mono text-xs">{bet.user}</td>
                      <td className="px-4 py-3 font-bold text-white">{bet.amount.toFixed(2)}</td>
                      <td className="px-4 py-3">{bet.targetMultiplier.toFixed(2)}x</td>
                      <td className="px-4 py-3 text-right">
                        {round.status === "OPEN" || round.status === "LOCKED" || round.status === "RUNNING" ? (
                          <span className="rounded-md bg-white/5 px-2 py-1 text-[10px] uppercase text-white/40 border border-white/5">Pending</span>
                        ) : bet.isWinner ? (
                          <span className="rounded-md bg-emerald-500/10 px-2 py-1 text-[10px] uppercase font-bold text-emerald-400 border border-emerald-500/20">+{bet.payout.toFixed(2)}</span>
                        ) : (
                          <span className="rounded-md bg-red-500/10 px-2 py-1 text-[10px] uppercase font-bold text-red-500 border border-red-500/20">Crashed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {round.bets.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-xs text-white/30">Pool is empty. Place a bet to start.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
