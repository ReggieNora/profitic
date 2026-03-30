"use client";

import React, { useState, useEffect, useRef } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useCrashGame } from "@/hooks/useCrashGame";

function ShitcoinVisualizer({ status, multiplier }: { status: string, multiplier: number }) {
  const isRunning = status === "RUNNING";
  const isCrashed = status === "ENDED";
  const isLocked = status === "LOCKED";
  const isOpen = status === "OPEN";

  const [points, setPoints] = useState<{x: number, y: number}[]>([]);
  const startTime = useRef<number>(0);

  // Initialize flat line
  useEffect(() => {
    if (isOpen || isLocked) {
      setPoints([{ x: 0, y: 1 }]);
      startTime.current = 0;
    }
  }, [isOpen, isLocked]);

  // Jagged flight recording
  useEffect(() => {
    if (isRunning) {
      if (startTime.current === 0) startTime.current = Date.now();
      const elapsed = (Date.now() - startTime.current) / 1000;
      
      // Inject "jagged" crypto chart noise tracking the multiplier
      const jitter = (Math.random() - 0.5) * 0.15 * multiplier; 
      const y = Math.max(1, multiplier + jitter);
      
      setPoints(prev => {
        const last = prev[prev.length - 1];
        // Cap updates to look like discrete chart ticks
        if (last && elapsed - last.x < 0.08) return prev; 
        return [...prev, { x: elapsed, y }];
      });
    }
  }, [multiplier, isRunning]);

  // Rug pull sheer cliff
  useEffect(() => {
    if (isCrashed) {
      setPoints(prev => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        return [
          ...prev, 
          { x: last.x + 0.01, y: last.y }, // cliff edge
          { x: last.x + 0.1, y: 0.5 }      // bottom of crater
        ];
      });
    }
  }, [isCrashed]);

  // Chart rendering math
  const w = 1000;
  const h = 400;

  const currX = points.length > 0 ? points[points.length - 1].x : 0;
  const maxX = Math.max(5, currX * 1.15); // Auto-scale X but keep minimum 5s horizontal
  const maxM = points.length > 0 ? Math.max(...points.map(p => p.y)) : 1;
  const maxY = Math.max(2.0, maxM * 1.3); // Headroom top
  const minY = isCrashed ? 0.2 : 0.8;     // When crashed, zoom out Y slightly so we see the drop

  const mapX = (x: number) => (x / maxX) * w;
  const mapY = (y: number) => h - ((y - minY) / (maxY - minY)) * h;

  const pathData = points.length > 0 
    ? points.map((p, i) => `${i===0?'M':'L'} ${mapX(p.x)} ${mapY(p.y)}`).join(' ')
    : `M 0 ${mapY(1)}`;
    
  // Connect the chart line to the bottom for the gradient fill
  const fillPathData = `${pathData} L ${mapX(currX)} ${h} L 0 ${h} Z`;

  const lastPoint = points.length > 0 ? points[points.length - 1] : { x: 0, y: 1 };
  const coinX = mapX(lastPoint.x);
  const coinY = mapY(lastPoint.y);

  return (
    <div className="relative w-full h-[350px] sm:h-[450px] rounded-3xl bg-[#0a0a0c] border border-white/10 overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,0.8)] flex flex-col items-center justify-center">
      
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />

      {/* SVG Chart */}
      <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
             <stop offset="0%" stopColor={isCrashed ? "rgba(239,68,68,0.5)" : "rgba(34,197,94,0.5)"} />
             <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
        </defs>

        {/* Base 1.0x line */}
        <line x1="0" y1={mapY(1.0)} x2={w} y2={mapY(1.0)} stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="5,5" vectorEffect="non-scaling-stroke" />

        <path d={fillPathData} fill="url(#chart-fill)" className="transition-all duration-[80ms] ease-linear" />
        <path 
           d={pathData} 
           fill="none" 
           stroke={isCrashed ? "#ef4444" : "#22c55e"} 
           strokeWidth="4" 
           strokeLinejoin="round" 
           strokeLinecap="round" 
           vectorEffect="non-scaling-stroke" 
           className="transition-all duration-[80ms] ease-linear drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]" 
           style={{ filter: isCrashed ? 'drop-shadow(0 0 10px rgba(239,68,68,0.8))' : 'drop-shadow(0 0 10px rgba(34,197,94,0.8))' }} 
        />
      </svg>

      {/* Giant Multiplier Text in Background */}
      <div className="absolute top-8 left-0 w-full flex flex-col items-center z-0 opacity-40 pointer-events-none select-none transition-all">
         <span className={`text-[100px] sm:text-[140px] font-black tabular-nums tracking-tighter ${
             isCrashed ? "text-red-500 scale-100" : 
             isRunning ? "text-white" : "text-white/40"
         }`}>
            {multiplier.toFixed(2)}x
         </span>
      </div>

      {/* RUGGED overlay */}
      {isCrashed && (
         <div className="absolute inset-0 flex flex-col items-center justify-center z-30 pointer-events-none animate-in zoom-in spin-in-2 duration-300">
           <span className="text-[70px] sm:text-[120px] font-black italic text-red-500 drop-shadow-[0_10px_40px_rgba(239,68,68,0.8)] uppercase tracking-tighter mix-blend-screen -rotate-12" style={{ WebkitTextStroke: '3px white' }}>
             RUGGED!
           </span>
         </div>
      )}

      {/* The riding Shitcoin */}
      <div 
        className={`absolute z-20 transition-all ease-linear ${isCrashed ? "duration-300" : "duration-[80ms]"}`}
        style={{ 
          left: `${(coinX / w) * 100}%`, 
          top: `${(coinY / h) * 100}%`,
          transform: 'translate(-50%, -50%)'
        }}
      >
         <div className={`relative flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-[0_0_30px_rgba(234,179,8,0.5)] border-[3px] border-yellow-200 z-10 ${isRunning ? "animate-bounce" : ""} ${isCrashed ? "grayscale rotate-180 scale-75" : ""}`}>
           <span className="text-2xl drop-shadow-lg">💩</span>
         </div>
         {/* Simple thruster tail */}
         {isRunning && !isCrashed && (
           <div className="absolute top-1/2 right-12 w-20 h-4 bg-gradient-to-l from-transparent via-green-400 to-white blur-md rounded-full -translate-y-1/2 opacity-80" />
         )}
      </div>
      
      {/* Current phase subtle label */}
      <div className="absolute bottom-6 bg-black/50 border border-white/10 rounded-full px-6 py-2 backdrop-blur-md z-10 pointer-events-none">
        <span className="text-xs font-bold uppercase tracking-widest text-white/50">
           {status === "OPEN" && "Engine Idling..."}
           {status === "LOCKED" && "Preparing Launch..."}
           {status === "RUNNING" && "Trading Live!"}
           {status === "ENDED" && "Liquidation."}
        </span>
      </div>
    </div>
  );
}

export default function CrashGamePage() {
  const { publicKey } = useWallet();
  const {
    round, currentMultiplier, userBalances,
    placeBet, lockAndPrecompute, runRound, resetRound, fundWallet
  } = useCrashGame();

  const [amount, setAmount] = useState("10");
  const [target, setTarget] = useState("2.0");

  const me = publicKey ? publicKey.toBase58().slice(0, 6) : "Player1";

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
    <div className="relative min-h-[calc(100vh-3.5rem)] w-full bg-black sm:p-6 pb-24 overflow-x-hidden">
      <div className="mx-auto max-w-6xl">
        
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between px-4 sm:px-0 mt-4 sm:mt-0">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-lg shadow-yellow-500/20 border border-yellow-300">
              <span className="text-3xl drop-shadow-md">💩</span>
            </div>
            <div>
              <h1 className="text-2xl sm:text-4xl font-black text-white tracking-wide">
                SHITCOIN <span className="text-yellow-500">CRASH</span>
              </h1>
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest mt-1">PvP Multiplier Engine</p>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-surface-300/50 px-6 py-3 text-right backdrop-blur-md shadow-xl hidden sm:block">
            <p className="text-[10px] uppercase font-bold tracking-wider text-white/50">Your Balance</p>
            <p className="text-xl font-black text-emerald-400">${(userBalances[me] || 0).toFixed(2)}</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3 px-4 sm:px-0">
          
          {/* Left Col: Visualizer */}
          <div className="lg:col-span-2 flex flex-col">
            <ShitcoinVisualizer status={round.status} multiplier={currentMultiplier} />
            
            {/* Developer controls tucked neatly underneath */}
            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 mt-6 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                 <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold">⚙️</span>
                 <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400/60">Engine Dev Controls</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={addDummyBet} disabled={round.status !== "OPEN"} className="rounded-lg bg-surface-400 px-3 py-1.5 text-xs font-bold text-white hover:bg-surface-300 disabled:opacity-30 border border-white/10 transition-all active:scale-95">+ Inject Player</button>
                <button onClick={lockAndPrecompute} disabled={round.status !== "OPEN"} className="rounded-lg bg-yellow-500/20 px-3 py-1.5 text-xs font-bold text-yellow-500 hover:bg-yellow-500/30 disabled:opacity-30 border border-yellow-500/20 transition-all active:scale-95">Lock Round</button>
                <button onClick={runRound} disabled={round.status !== "LOCKED"} className="rounded-lg bg-emerald-500/20 px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 disabled:opacity-30 border border-emerald-500/20 transition-all active:scale-95">Launch</button>
                <button onClick={resetRound} disabled={round.status !== "ENDED"} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 disabled:opacity-30 border border-white/10 transition-all active:scale-95">Reset</button>
              </div>
            </div>
          </div>

          {/* Right Col: Betting panel & Players */}
          <div className="flex flex-col gap-6">
            
            {/* Mobile Balance Card */}
            <div className="rounded-2xl border border-white/10 bg-surface-300/50 px-6 py-3 flex items-center justify-between backdrop-blur-md shadow-xl sm:hidden">
              <p className="text-[10px] uppercase font-bold tracking-wider text-white/50">Your Balance</p>
              <p className="text-xl font-black text-emerald-400">${(userBalances[me] || 0).toFixed(2)}</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-surface-300/40 p-6 backdrop-blur-xl shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-black uppercase tracking-wider text-white">Place Bet</h2>
                <span className={`px-3 py-1 text-[10px] font-bold uppercase rounded-full border ${round.status === 'OPEN' ? 'border-green-500/50 bg-green-500/20 text-green-400 animate-pulse' : 'border-white/10 bg-white/5 text-white/40'}`}>
                  {round.status === 'OPEN' ? 'OPEN' : 'WAITING'}
                </span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs uppercase font-bold text-white/40 ml-1">Bet Amount (SOL)</label>
                  <div className="relative mt-1">
                    <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={round.status !== "OPEN"} className="w-full rounded-2xl border border-white/10 bg-black/50 p-4 pl-12 text-xl font-black text-white outline-none transition-all focus:border-yellow-500/50" />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 font-black">$</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs uppercase font-bold text-white/40 ml-1">Target Multiplier</label>
                  <div className="relative mt-1">
                    <input type="number" step="0.1" value={target} onChange={(e) => setTarget(e.target.value)} disabled={round.status !== "OPEN"} className="w-full rounded-2xl border border-white/10 bg-black/50 p-4 pr-12 text-xl font-black text-white text-right outline-none transition-all focus:border-yellow-500/50" />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-yellow-500 font-black">x</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-2">
                   {[10, 50, 100, "MAX"].map((btn) => (
                     <button
                       key={btn}
                       onClick={() => setAmount(btn === "MAX" ? (userBalances[me] || 0).toFixed(0) : btn.toString())}
                       disabled={round.status !== "OPEN"}
                       className="rounded-xl border border-white/10 bg-white/5 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white transition-all disabled:opacity-30"
                     >
                       {btn}
                     </button>
                   ))}
                </div>

                <button onClick={handleBet} disabled={round.status !== "OPEN"} className="mt-4 w-full rounded-2xl bg-gradient-to-br from-yellow-400 to-yellow-600 py-5 text-sm font-black uppercase tracking-widest text-black shadow-[0_0_30px_rgba(234,179,8,0.2)] transition-all hover:scale-[1.02] active:scale-95 disabled:pointer-events-none disabled:opacity-30 disabled:grayscale">
                  {round.status === "OPEN" ? "Confirm Bet" : "Round Locked"}
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-surface-300/40 p-6 backdrop-blur-xl shadow-2xl flex-1 flex flex-col min-h-[300px] max-h-[500px]">
              <div className="flex items-center justify-between mb-4">
                 <h2 className="text-sm font-bold uppercase tracking-wider text-white/60">Live Players</h2>
                 <div className="text-right">
                   <div className="text-[10px] text-white/40 uppercase font-bold">Payout Pool</div>
                   <div className="text-sm font-black text-yellow-400">${round.payoutPool.toFixed(2)}</div>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto rounded-2xl bg-black/40 border border-white/5 relative">
                <table className="w-full text-left text-xs font-medium text-white/70">
                  <thead className="sticky top-0 bg-surface-300/90 backdrop-blur-md text-[9px] uppercase tracking-wider text-white/40">
                    <tr>
                      <th className="px-3 py-3 rounded-tl-2xl">Player</th>
                      <th className="px-3 py-3">Bet</th>
                      <th className="px-3 py-3 text-right">Target</th>
                      <th className="px-3 py-3 text-right rounded-tr-2xl">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {[...round.bets].sort((a, b) => b.amount - a.amount).map((bet, i) => (
                      <tr key={bet.id} className={`transition-colors hover:bg-white/5 ${bet.user === me ? "bg-yellow-500/5" : ""}`}>
                        <td className="px-3 py-3 font-mono">
                          <div className="flex items-center gap-2">
                             <div className={`h-4 w-4 rounded-full flex items-center justify-center text-[8px] ${bet.user === me ? "bg-yellow-500 text-black font-black" : "bg-white/10 text-white/50"}`}>{i + 1}</div>
                             <span className={bet.user === me ? "text-yellow-400 font-bold" : ""}>{bet.user}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 font-bold text-white">${bet.amount.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right">{bet.targetMultiplier.toFixed(2)}x</td>
                        <td className="px-3 py-3 text-right">
                          {round.status === "OPEN" || round.status === "LOCKED" || round.status === "RUNNING" ? (
                            <span className="text-white/30">—</span>
                          ) : bet.isWinner ? (
                            <span className="font-bold text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.4)]">+{bet.payout.toFixed(2)}</span>
                          ) : (
                            <span className="font-bold text-red-500/60 uppercase text-[10px]">Rekt</span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {round.bets.length === 0 && (
                      <tr><td colSpan={4} className="py-12 text-center text-xs text-white/30">Pool is empty.<br/>Place a bet to start.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
