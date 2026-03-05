"use client";

import { useState, useEffect, useCallback } from "react";
import { Comment } from "@/types";
import { API_URL } from "@/lib/constants";

interface UseCommentsReturn {
  comments: Comment[];
  total: number;
  loading: boolean;
  posting: boolean;
  error: string | null;
  postComment: (userAddress: string, body: string) => Promise<boolean>;
  refetch: () => void;
}

export function useComments(marketId: string): UseCommentsReturn {
  const [comments, setComments] = useState<Comment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    if (!marketId) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/markets/${marketId}/comments?limit=100`);
      if (!res.ok) throw new Error("Failed to load comments");
      const data = await res.json();
      setComments(data.data || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error("Error fetching comments:", err);
      setError(err instanceof Error ? err.message : "Failed to load comments");
      setComments(getDemoComments(marketId));
      setTotal(3);
    } finally {
      setLoading(false);
    }
  }, [marketId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const postComment = useCallback(
    async (userAddress: string, body: string): Promise<boolean> => {
      setPosting(true);
      try {
        const res = await fetch(`${API_URL}/markets/${marketId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_address: userAddress, body }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Failed to post comment" }));
          throw new Error(err.error || "Failed to post comment");
        }
        const newComment: Comment = await res.json();
        setComments((prev) => [newComment, ...prev]);
        setTotal((prev) => prev + 1);
        return true;
      } catch (err) {
        console.error("Error posting comment:", err);
        setError(err instanceof Error ? err.message : "Failed to post comment");
        return false;
      } finally {
        setPosting(false);
      }
    },
    [marketId],
  );

  return { comments, total, loading, posting, error, postComment, refetch: fetchComments };
}

function getDemoComments(marketId: string): Comment[] {
  const now = new Date();
  return [
    {
      id: 1,
      market_id: parseInt(marketId, 10) || 1,
      user_address: "Trader1111111111111111111111111111111111111",
      body: "I think BTC will easily break 100k with the current momentum. Going heavy on YES.",
      created_at: new Date(now.getTime() - 3600_000).toISOString(),
    },
    {
      id: 2,
      market_id: parseInt(marketId, 10) || 1,
      user_address: "Trader2222222222222222222222222222222222222",
      body: "Not so sure about this one. Macro headwinds are real.",
      created_at: new Date(now.getTime() - 7200_000).toISOString(),
    },
    {
      id: 3,
      market_id: parseInt(marketId, 10) || 1,
      user_address: "Trader3333333333333333333333333333333333333",
      body: "The data source looks solid. CoinGecko is reliable for price tracking.",
      created_at: new Date(now.getTime() - 86400_000).toISOString(),
    },
  ];
}
