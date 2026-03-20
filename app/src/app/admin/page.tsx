"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { Market } from "@/types";
import { ADMIN_WALLETS, PROGRAM_ID } from "@/lib/constants";
import { formatProbability, formatSol, lamportsToSol } from "@/lib/bondingCurve";
import { useProgram } from "@/hooks/useProgram";

export default function AdminPage() {
  const { connected, publicKey } = useWallet();
  const { program } = useProgram();
  const [markets, setMarkets] = useState<Array<{ pubkey: string; data: Record<string, unknown> }>>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolveForm, setResolveForm] = useState<{
    [marketPubkey: string]: { outcome: "yes" | "no" | "invalid"; evidenceUrl: string };
  }>({});
  const [txResult, setTxResult] = useState<{ pubkey: string; success: boolean; message: string; txSignature?: string } | null>(null);

  const isAdmin =
    connected && publicKey && ADMIN_WALLETS.includes(publicKey.toBase58());

  // Fetch on-chain markets
  const fetchMarkets = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    try {
      // Fetch all Market accounts from the program
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allMarkets = await (program.account as any)["market"].all();
      // Filter to markets past resolution date and not yet resolved
      const now = Math.floor(Date.now() / 1000);
      const pending = allMarkets.filter((m: { account: Record<string, unknown> }) => {
        const status = m.account.status as Record<string, unknown> | undefined;
        const isActive = status && ("active" in status);
        const resTs = m.account.resolutionTimestamp as { toNumber?: () => number } | undefined;
        const resTime = typeof resTs?.toNumber === "function" ? resTs.toNumber() : Number(resTs);
        return isActive && resTime <= now;
      });
      setMarkets(
        pending.map((m: { publicKey: PublicKey; account: Record<string, unknown> }) => ({
          pubkey: m.publicKey.toBase58(),
          data: m.account,
        }))
      );
    } catch (err) {
      console.error("Failed to fetch markets:", err);
      // Fallback to demo data if program not deployed
      setMarkets([]);
    } finally {
      setLoading(false);
    }
  }, [program]);

  useEffect(() => {
    if (isAdmin && program) {
      fetchMarkets();
    }
  }, [isAdmin, program, fetchMarkets]);

  const handleResolve = async (marketPubkey: string) => {
    const form = resolveForm[marketPubkey];
    if (!form || !form.evidenceUrl.trim()) {
      return;
    }
    if (!program || !publicKey) return;

    setResolving(marketPubkey);
    setTxResult(null);

    try {
      // Map outcome to u8: yes=0, no=1, invalid=2
      const outcomeMap: Record<string, number> = { yes: 0, no: 1, invalid: 2 };
      const winningOutcome = outcomeMap[form.outcome] ?? 0;

      // Derive platform PDA
      const [platformPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("platform")],
        new PublicKey(PROGRAM_ID)
      );

      const marketPk = new PublicKey(marketPubkey);

      const tx = await program.methods
        .resolveMarket(winningOutcome, form.evidenceUrl.trim())
        .accounts({
          platform: platformPda,
          market: marketPk,
          admin: publicKey,
        })
        .rpc();

      setTxResult({
        pubkey: marketPubkey,
        success: true,
        message: `Market resolved as ${form.outcome.toUpperCase()}!`,
        txSignature: tx,
      });

      // Remove from list
      setMarkets((prev) => prev.filter((m) => m.pubkey !== marketPubkey));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("Failed to resolve market:", msg);
      setTxResult({
        pubkey: marketPubkey,
        success: false,
        message: `Resolution failed: ${msg.slice(0, 200)}`,
      });
    } finally {
      setResolving(null);
    }
  };

  const updateResolveForm = (
    marketPubkey: string,
    field: string,
    value: string
  ) => {
    setResolveForm((prev) => {
      const existing = prev[marketPubkey] || { outcome: "yes" as const, evidenceUrl: "" };
      return {
        ...prev,
        [marketPubkey]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  if (!connected) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center animate-fade-up">
        <h1 className="mb-3 text-2xl font-bold text-white">Admin Panel</h1>
        <p className="mb-6 text-sm text-gray-400">
          Connect an admin wallet to manage resolutions.
        </p>
        <WalletMultiButton />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center animate-fade-up">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
          <svg
            className="h-7 w-7 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h1 className="mb-2 text-xl font-bold text-white">Access Denied</h1>
        <p className="text-sm text-gray-400">
          This wallet doesn&apos;t have admin privileges.
        </p>
        <p className="mt-2 font-mono text-[11px] text-gray-600">
          {publicKey?.toBase58()}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-24 sm:max-w-5xl sm:px-6 md:pb-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between animate-fade-up">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="mt-1 text-sm text-gray-400">
            Resolve markets past their resolution date.
          </p>
        </div>
        <button
          onClick={fetchMarkets}
          disabled={loading}
          className="rounded-xl bg-surface-300 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-surface-200 active:scale-95 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {/* Transaction Result */}
      {txResult && (
        <div
          className={`mb-6 rounded-2xl p-4 text-sm font-medium animate-fade-in ${
            txResult.success
              ? "bg-green-500/15 text-green-400 border border-green-500/20"
              : "bg-red-500/15 text-red-400 border border-red-500/20"
          }`}
        >
          <p>{txResult.message}</p>
          {txResult.txSignature && (
            <a
              href={`https://explorer.solana.com/tx/${txResult.txSignature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block text-xs text-primary-400 hover:underline"
            >
              View transaction on Solana Explorer
            </a>
          )}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-48" />
          <div className="skeleton h-48" />
        </div>
      ) : markets.length === 0 ? (
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 py-12 text-center animate-fade-up">
          <p className="text-sm font-medium text-gray-400">No markets pending resolution</p>
          <p className="mt-1 text-xs text-gray-500">
            Markets appear here after their resolution date passes.
          </p>
          <p className="mt-3 text-xs text-gray-600">
            {program ? "Connected to on-chain program" : "Program not available — no markets to resolve"}
          </p>
        </div>
      ) : (
        <div className="space-y-5 stagger-children">
          {markets.map((market) => {
            const form = resolveForm[market.pubkey] || {
              outcome: "yes",
              evidenceUrl: "",
            };
            const isCurrentResolving = resolving === market.pubkey;
            const data = market.data;
            const question = data.question as string || "Unknown Market";
            const description = data.description as string || "";
            const dataSource = data.dataSource as string || "";
            const resTs = data.resolutionTimestamp as { toNumber?: () => number };
            const resTime = typeof resTs?.toNumber === "function" ? resTs.toNumber() : Number(resTs);
            const yesSupply = data.yesSupply as { toNumber?: () => number };
            const noSupply = data.noSupply as { toNumber?: () => number };
            const yesCount = typeof yesSupply?.toNumber === "function" ? yesSupply.toNumber() : Number(yesSupply || 0);
            const noCount = typeof noSupply?.toNumber === "function" ? noSupply.toNumber() : Number(noSupply || 0);
            const total = yesCount + noCount;
            const yesPrice = total > 0 ? yesCount / total : 0.5;
            const noPrice = 1 - yesPrice;
            const poolBalance = data.poolBalance as { toNumber?: () => number };
            const pool = typeof poolBalance?.toNumber === "function" ? poolBalance.toNumber() : Number(poolBalance || 0);

            return (
              <div key={market.pubkey} className="rounded-2xl border border-surface-50/50 bg-surface-300 p-5 space-y-4">
                {/* Market Info */}
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-yellow-500/15 px-2.5 py-1 text-[11px] font-bold text-yellow-400">
                      Pending
                    </span>
                    <span className="text-[11px] text-gray-500">
                      Ended{" "}
                      {new Date(resTime * 1000).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {question}
                  </h3>
                  <p className="mt-1 text-xs text-gray-400 leading-relaxed">
                    {description}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-gray-600 truncate">
                    {market.pubkey}
                  </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-[11px] text-gray-500">YES</p>
                    <p className="text-sm font-bold text-green-400">
                      {formatProbability(yesPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500">NO</p>
                    <p className="text-sm font-bold text-red-400">
                      {formatProbability(noPrice)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500">Pool</p>
                    <p className="text-sm font-bold text-white">
                      {formatSol(lamportsToSol(pool))}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-gray-500">Source</p>
                    {dataSource.startsWith("http") ? (
                      <a
                        href={dataSource}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent-400 hover:underline"
                      >
                        View
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">{dataSource || "None"}</span>
                    )}
                  </div>
                </div>

                {/* Resolution Form */}
                <div className="rounded-xl bg-surface-400/80 p-4 space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Resolve On-Chain
                  </h4>
                  <div className="flex gap-2">
                    {(["yes", "no", "invalid"] as const).map((o) => (
                      <button
                        key={o}
                        onClick={() =>
                          updateResolveForm(market.pubkey, "outcome", o)
                        }
                        className={`rounded-xl px-4 py-2 text-xs font-bold capitalize transition-all active:scale-95 ${
                          form.outcome === o
                            ? o === "yes"
                              ? "bg-green-500/15 text-green-400 ring-1 ring-green-500/30"
                              : o === "no"
                              ? "bg-red-500/15 text-red-400 ring-1 ring-red-500/30"
                              : "bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30"
                            : "bg-surface-300 text-gray-400 hover:text-white"
                        }`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                  <input
                    type="url"
                    value={form.evidenceUrl}
                    onChange={(e) =>
                      updateResolveForm(
                        market.pubkey,
                        "evidenceUrl",
                        e.target.value
                      )
                    }
                    placeholder="Evidence URL..."
                    className="input-field text-sm"
                  />
                  <button
                    onClick={() => handleResolve(market.pubkey)}
                    disabled={isCurrentResolving || !form.evidenceUrl.trim()}
                    className="btn-primary w-full"
                  >
                    {isCurrentResolving
                      ? "Sending transaction..."
                      : `Resolve ${form.outcome.toUpperCase()}`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
