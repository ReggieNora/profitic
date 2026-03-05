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
    <div className="card">
      <h3 className="mb-4 text-lg font-semibold text-white">
        Discussion {total > 0 && <span className="text-sm font-normal text-gray-500">({total})</span>}
      </h3>

      {/* Comment form */}
      {publicKey ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Share your thoughts on this market..."
            maxLength={1000}
            rows={3}
            className="w-full rounded-lg border border-surface-50 bg-surface-400 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-none"
          />
          <div className="mt-2 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {body.length}/1000
            </span>
            <button
              type="submit"
              disabled={posting || !body.trim()}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {posting ? "Posting..." : "Post Comment"}
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-6 rounded-lg border border-surface-50 bg-surface-400/50 px-4 py-3 text-center text-sm text-gray-400">
          Connect your wallet to join the discussion.
        </div>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-8 text-center text-gray-500">No comments yet. Be the first to share your thoughts!</p>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border border-surface-50 bg-surface-400/30 px-4 py-3">
              <div className="mb-1 flex items-center gap-2">
                <span className="font-mono text-xs text-primary-400">
                  {shortenAddress(comment.user_address)}
                </span>
                <span className="text-xs text-gray-600">
                  {timeAgo(comment.created_at)}
                </span>
              </div>
              <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
                {comment.body}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
