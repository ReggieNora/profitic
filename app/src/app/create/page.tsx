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
      // Combine date and time into a Unix timestamp
      const dateTime = new Date(
        `${form.resolutionDate}T${form.resolutionTime}`
      );
      const resolutionTimestamp = Math.floor(dateTime.getTime() / 1000);

      // In production, this calls the Anchor program's createMarket instruction
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

  // Minimum date is tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Create Market</h1>
        <p className="mt-2 text-gray-400">
          Create a new prediction market for others to trade on.
        </p>
      </div>

      {!connected ? (
        <div className="card flex flex-col items-center py-12">
          <svg
            className="mb-4 h-12 w-12 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <p className="mb-4 text-lg font-medium text-gray-400">
            Connect your wallet to create a market
          </p>
          <WalletMultiButton />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Question */}
          <div className="card space-y-5">
            <div>
              <label
                htmlFor="question"
                className="mb-2 block text-sm font-medium text-gray-300"
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
              <p className="mt-1.5 text-xs text-gray-500">
                Ask a clear yes/no question. Min 10 characters.
              </p>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="mb-2 block text-sm font-medium text-gray-300"
              >
                Description <span className="text-red-400">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={form.description}
                onChange={handleChange}
                placeholder="Describe the resolution criteria clearly. What exactly needs to happen for this to resolve YES?"
                rows={4}
                className="input-field resize-none"
                maxLength={1000}
              />
              <p className="mt-1.5 text-xs text-gray-500">
                Be specific about resolution criteria. Min 20 characters.
              </p>
            </div>

            {/* Resolution Date + Time */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="resolutionDate"
                  className="mb-2 block text-sm font-medium text-gray-300"
                >
                  Resolution Date <span className="text-red-400">*</span>
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
                  className="mb-2 block text-sm font-medium text-gray-300"
                >
                  Resolution Time (UTC)
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
                className="mb-2 block text-sm font-medium text-gray-300"
              >
                Data Source URL <span className="text-red-400">*</span>
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
              <p className="mt-1.5 text-xs text-gray-500">
                URL of the data source used to verify the outcome.
              </p>
            </div>
          </div>

          {/* Preview */}
          {form.question && (
            <div className="card border-primary-500/20">
              <h3 className="mb-2 text-sm font-medium text-gray-400">
                Preview
              </h3>
              <p className="text-lg font-semibold text-white">
                {form.question}
              </p>
              {form.description && (
                <p className="mt-2 text-sm text-gray-400">
                  {form.description}
                </p>
              )}
              {form.resolutionDate && (
                <p className="mt-2 text-xs text-gray-500">
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
            className="btn-primary w-full py-3"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Creating Market...
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
