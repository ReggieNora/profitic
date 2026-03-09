"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { MarketFormData, MarketCategory } from "@/types";
import { MARKET_CATEGORIES } from "@/lib/constants";

const CATEGORY_OPTIONS = MARKET_CATEGORIES.filter((c) => c.value !== "all") as readonly { label: string; value: string }[];

export default function CreateMarketPage() {
  const router = useRouter();
  const { connected, publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [form, setForm] = useState<MarketFormData>({
    question: "",
    description: "",
    category: "",
    resolutionDate: "",
    resolutionTime: "12:00",
    dataSourceUrl: "",
    coverImage: "",
    videoUrl: "",
    initialYesLiquidity: "500",
    initialNoLiquidity: "500",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImagePreview(url);
    setForm((prev) => ({ ...prev, coverImage: url }));
  };

  const yesLiq = parseFloat(form.initialYesLiquidity) || 0;
  const noLiq = parseFloat(form.initialNoLiquidity) || 0;
  const totalLiq = yesLiq + noLiq;
  const startingProb = totalLiq > 0 ? ((yesLiq / totalLiq) * 100).toFixed(0) : "50";

  const isValid =
    form.question.trim().length >= 10 &&
    form.description.trim().length >= 20 &&
    form.category !== "" &&
    form.resolutionDate &&
    form.dataSourceUrl.trim().startsWith("http") &&
    yesLiq > 0 &&
    noLiq > 0;

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
        initialYesLiquidity: yesLiq,
        initialNoLiquidity: noLiq,
        totalLiquidity: totalLiq,
        startingProbability: `YES ${startingProb}%`,
      });

      alert(
        `Market creation submitted!\n\nInitial liquidity: ${totalLiq} SOL (${yesLiq} YES / ${noLiq} NO)\nStarting probability: YES ${startingProb}%\n2% protocol fee on all trades.\n\nIn production, this sends a createMarket + addLiquidity transaction to the Solana program.`
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
    <div className="mx-auto max-w-lg px-4 py-6 pb-24 sm:max-w-2xl sm:px-6 md:pb-6">
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

            {/* Category */}
            <div>
              <label
                htmlFor="category"
                className="mb-1.5 block text-xs font-semibold text-gray-400"
              >
                Category <span className="text-red-400">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_OPTIONS.map((cat) => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, category: cat.value as MarketCategory }))}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95 ${
                      form.category === cat.value
                        ? "bg-white text-black shadow-lg"
                        : "bg-white/10 text-white/70 hover:bg-white/20"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Media section */}
          <div className="space-y-4 rounded-2xl border border-surface-50/50 bg-surface-300 p-5">
            <p className="text-xs font-semibold text-gray-400">Media</p>

            {/* Cover Image */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-gray-400">
                Cover Image
              </label>
              {imagePreview || form.coverImage ? (
                <div className="relative mb-2 overflow-hidden rounded-xl">
                  <img
                    src={imagePreview || form.coverImage}
                    alt="Cover preview"
                    className="h-40 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => { setImagePreview(null); setForm((prev) => ({ ...prev, coverImage: "" })); }}
                    className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white backdrop-blur-sm hover:bg-black/80"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-50/50 py-8 text-sm text-gray-500 transition-colors hover:border-primary-500/40 hover:text-gray-300">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                    </svg>
                    Upload image
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageFile}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
              <div className="mt-2">
                <input
                  name="coverImage"
                  type="url"
                  value={imagePreview ? "" : form.coverImage}
                  onChange={handleChange}
                  placeholder="Or paste an image URL..."
                  className="input-field text-xs"
                  disabled={!!imagePreview}
                />
              </div>
            </div>

            {/* Video URL */}
            <div>
              <label
                htmlFor="videoUrl"
                className="mb-1.5 block text-xs font-semibold text-gray-400"
              >
                Video URL <span className="text-gray-600">(optional)</span>
              </label>
              <input
                id="videoUrl"
                name="videoUrl"
                type="url"
                value={form.videoUrl}
                onChange={handleChange}
                placeholder="https://youtube.com/watch?v=... or https://x.com/..."
                className="input-field"
              />
              <p className="mt-1 text-[11px] text-gray-600">
                YouTube or X/Twitter video link. Plays inline on the card.
              </p>
            </div>
          </div>

          {/* Initial Liquidity */}
          <div className="space-y-4 rounded-2xl border border-primary-500/20 bg-primary-500/5 p-5">
            <div>
              <p className="text-xs font-semibold text-primary-400 uppercase tracking-wider">
                Initial Liquidity <span className="text-red-400">*</span>
              </p>
              <p className="mt-1 text-[11px] text-gray-500">
                Seed your market with liquidity. This determines the starting probability and is locked until market resolution.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="initialYesLiquidity"
                  className="mb-1.5 block text-xs font-semibold text-green-400"
                >
                  YES Pool (SOL)
                </label>
                <input
                  id="initialYesLiquidity"
                  name="initialYesLiquidity"
                  type="number"
                  value={form.initialYesLiquidity}
                  onChange={handleChange}
                  placeholder="500"
                  min="0"
                  step="0.1"
                  className="input-field"
                />
              </div>
              <div>
                <label
                  htmlFor="initialNoLiquidity"
                  className="mb-1.5 block text-xs font-semibold text-red-400"
                >
                  NO Pool (SOL)
                </label>
                <input
                  id="initialNoLiquidity"
                  name="initialNoLiquidity"
                  type="number"
                  value={form.initialNoLiquidity}
                  onChange={handleChange}
                  placeholder="500"
                  min="0"
                  step="0.1"
                  className="input-field"
                />
              </div>
            </div>

            {totalLiq > 0 && (
              <div className="rounded-xl bg-surface-300/80 p-3 space-y-2 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Total Pool</span>
                  <span className="text-sm font-bold text-white">{totalLiq.toFixed(2)} SOL</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Starting Probability</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-green-400">YES {startingProb}%</span>
                    <span className="text-xs text-gray-600">/</span>
                    <span className="text-sm font-bold text-red-400">NO {100 - parseInt(startingProb)}%</span>
                  </div>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-green-400 to-green-500"
                    style={{ width: `${startingProb}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-600">
                  Liquidity is locked until market resolution. You earn a share of trading fees.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4 rounded-2xl border border-surface-50/50 bg-surface-300 p-5">
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
            <div className="relative overflow-hidden rounded-2xl border border-primary-500/20 bg-primary-500/5 animate-fade-in">
              {(imagePreview || form.coverImage) && (
                <img
                  src={imagePreview || form.coverImage}
                  alt=""
                  className="h-32 w-full object-cover opacity-40"
                />
              )}
              <div className="p-5">
                <div className="mb-2 flex items-center gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Preview
                  </p>
                  {form.category && (
                    <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-white/60">
                      {form.category}
                    </span>
                  )}
                </div>
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
                {form.videoUrl && (
                  <p className="mt-2 flex items-center gap-1 text-[11px] text-primary-400">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                    </svg>
                    Video attached
                  </p>
                )}
              </div>
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
