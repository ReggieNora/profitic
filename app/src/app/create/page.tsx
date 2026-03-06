"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { MarketFormData } from "@/types";

export default function CreateMarketPage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<MarketFormData>({
    question: "",
    description: "",
    resolutionDate: "",
    resolutionTime: "12:00",
    dataSourceUrl: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const isValid =
    form.question.trim().length >= 10 &&
    form.description.trim().length >= 20 &&
    form.resolutionDate &&
    form.dataSourceUrl.trim().startsWith("http");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected || !isValid) return;

    setLoading(true);
    try {
      const dateTime = new Date(
        `${form.resolutionDate}T${form.resolutionTime}`
      );
      const resolutionTimestamp = Math.floor(dateTime.getTime() / 1000);

      console.log("Creating market:", {
        ...form,
        resolutionTimestamp,
        creator: publicKey?.toBase58(),
      });

      alert(
        "Market creation submitted!\n\nIn production, this sends a createMarket transaction to the Solana program."
      );
      router.push("/");
    } catch (err) {
      console.error("Failed to create market:", err);
      alert("Failed to create market. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:max-w-2xl sm:px-6">
      <div className="mb-6 animate-fade-up">
        <h1 className="text-2xl font-bold text-white">Create Market</h1>
        <p className="mt-1 text-sm text-gray-400">
          Create a prediction market for others to trade on.
        </p>
      </div>

      {!connected ? (
        <div className="rounded-2xl border border-surface-50/50 bg-surface-300 py-16 text-center animate-fade-up">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-400">
            <svg
              className="h-7 w-7 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <p className="mb-4 text-sm font-medium text-gray-400">
            Connect wallet to create a market
          </p>
          <WalletMultiButton />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5 animate-fade-up">
          <div className="space-y-4 rounded-2xl border border-surface-50/50 bg-surface-300 p-5">
            {/* Question */}
            <div>
              <label
                htmlFor="question"
                className="mb-1.5 block text-xs font-semibold text-gray-400"
              >
                Question <span className="text-red-400">*</span>
              </label>
              <input
                id="question"
                name="question"
                type="text"
                value={form.question}
                onChange={handleChange}
                placeholder="Will Bitcoin exceed $100,000 by end of 2026?"
                className="input-field"
                maxLength={200}
              />
              <p className="mt-1 text-[11px] text-gray-600">
                Clear yes/no question. Min 10 characters.
              </p>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="mb-1.5 block text-xs font-semibold text-gray-400"
              >
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe the resolution criteria clearly..."
                rows={3}
                className="input-field resize-none"
                maxLength={1000}
              />
              <p className="mt-1 text-[11px] text-gray-600">
                Resolution criteria. Min 20 characters.
              </p>
            </div>

            {/* Resolution Date + Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="resolutionDate"
                  className="mb-1.5 block text-xs font-semibold text-gray-400"
                >
                  Date <span className="text-red-400">*</span>
                </label>
                <input
                  id="resolutionDate"
                  name="resolutionDate"
                  type="date"
                  value={form.resolutionDate}
                  onChange={handleChange}
                  min={minDate}
                  className="input-field"
                />
              </div>
              <div>
                <label
                  htmlFor="resolutionTime"
                  className="mb-1.5 block text-xs font-semibold text-gray-400"
                >
                  Time (UTC)
                </label>
                <input
                  id="resolutionTime"
                  name="resolutionTime"
                  type="time"
                  value={form.resolutionTime}
                  onChange={handleChange}
                  className="input-field"
                />
              </div>
            </div>

            {/* Data Source URL */}
            <div>
              <label
                htmlFor="dataSourceUrl"
                className="mb-1.5 block text-xs font-semibold text-gray-400"
              >
                Data Source <span className="text-red-400">*</span>
              </label>
              <input
                id="dataSourceUrl"
                name="dataSourceUrl"
                type="url"
                value={form.dataSourceUrl}
                onChange={handleChange}
                placeholder="https://www.coingecko.com/en/coins/bitcoin"
                className="input-field"
              />
              <p className="mt-1 text-[11px] text-gray-600">
                URL to verify the outcome.
              </p>
            </div>
          </div>

          {/* Preview */}
          {form.question && (
            <div className="rounded-2xl border border-primary-500/20 bg-primary-500/5 p-5 animate-fade-in">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Preview
              </p>
              <p className="text-base font-bold text-white">
                {form.question}
              </p>
              {form.description && (
                <p className="mt-2 text-xs text-gray-400 leading-relaxed">
                  {form.description}
                </p>
              )}
              {form.resolutionDate && (
                <p className="mt-2 text-[11px] text-gray-500">
                  Resolves:{" "}
                  {new Date(
                    `${form.resolutionDate}T${form.resolutionTime}`
                  ).toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!isValid || loading}
            className="btn-primary w-full py-3.5"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating...
              </span>
            ) : (
              "Create Market"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
