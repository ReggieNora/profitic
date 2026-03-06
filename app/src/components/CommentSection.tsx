"use client";

import React, { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useComments } from "@/hooks/useComments";

function shortenAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function CommentSection({ marketId }: { marketId: string }) {
  const { publicKey } = useWallet();
  const { comments, total, loading, posting, postComment } = useComments(marketId);
  const [body, setBody] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publicKey || !body.trim()) return;
    const success = await postComment(publicKey.toBase58(), body.trim());
    if (success) setBody("");
  };

  return (
    <div className="rounded-2xl border border-surface-50/50 bg-surface-300 p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">
        Discussion {total > 0 && <span className="font-normal text-gray-500">({total})</span>}
      </h3>

      {/* Comment form */}
      {publicKey ? (
        <form onSubmit={handleSubmit} className="mb-5">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts..."
            maxLength={1000}
            rows={2}
            className="w-full rounded-xl border border-surface-50/50 bg-surface-400 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-primary-500/40 focus:outline-none focus:ring-2 focus:ring-primary-500/15 resize-none transition-all"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-gray-600">
              {body.length}/1000
            </span>
            <button
              type="submit"
              disabled={posting || !body.trim()}
              className="rounded-xl bg-primary-600 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-primary-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {posting ? "Posting..." : "Post"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-5 rounded-xl border border-surface-50/30 bg-surface-400/30 px-4 py-3 text-center text-xs text-gray-500">
          Connect wallet to join the discussion.
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-16" />
          <div className="skeleton h-16" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-8 text-center text-xs text-gray-500">No comments yet. Be the first!</p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-xl border border-surface-50/30 bg-surface-400/20 px-4 py-3">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="font-mono text-[11px] font-medium text-primary-400">
                  {shortenAddress(comment.user_address)}
                </span>
                <span className="text-[11px] text-gray-600">
                  {timeAgo(comment.created_at)}
                </span>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap break-words leading-relaxed">
                {comment.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
