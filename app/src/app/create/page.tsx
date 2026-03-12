"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  MarketFormData,
  MarketCategory,
  MarketType,
  CryptoUpDownFormData,
  CryptoAsset,
  CryptoTimeframe,
  CryptoMarketSubtype,
  CRYPTO_ASSETS,
  CRYPTO_TIMEFRAMES,
} from "@/types";
import { MARKET_CATEGORIES } from "@/lib/constants";
import { useCryptoPrice } from "@/hooks/useCryptoPrice";

const CATEGORY_OPTIONS = MARKET_CATEGORIES.filter((c) => c.value !== "all") as readonly { label: string; value: string }[];

// ---------------------------------------------------------------------------
// Market Type Selector
// ---------------------------------------------------------------------------
function MarketTypeSelector({
  selected,
  onChange,
}: {
  selected: MarketType;
  onChange: (t: MarketType) => void;
}) {
  return (
    <div className="mb-6 animate-fade-up">
      <h1 className="text-2xl font-bold text-white">Create Market</h1>
      <p className="mt-1 text-sm text-gray-400">Choose a market type to get started.</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange("prediction")}
          className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all ${
            selected === "prediction"
              ? "border-primary-500/50 bg-primary-500/10 shadow-lg shadow-primary-500/10"
              : "border-surface-50/50 bg-surface-300 hover:border-primary-500/20"
          }`}
        >
          <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
            selected === "prediction" ? "bg-primary-500/20" : "bg-surface-400"
          }`}>
            <svg className={`h-5 w-5 ${selected === "prediction" ? "text-primary-400" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
          </div>
          <p className={`text-sm font-bold ${selected === "prediction" ? "text-white" : "text-gray-300"}`}>
            Prediction Market
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            Any yes/no question with custom resolution criteria
          </p>
        </button>

        <button
          type="button"
          onClick={() => onChange("crypto_updown")}
          className={`group relative overflow-hidden rounded-2xl border p-5 text-left transition-all ${
            selected === "crypto_updown"
              ? "border-primary-500/50 bg-primary-500/10 shadow-lg shadow-primary-500/10"
              : "border-surface-50/50 bg-surface-300 hover:border-primary-500/20"
          }`}
        >
          {/* Trending badge */}
          <span className="absolute right-3 top-3 rounded-full bg-orange-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-orange-400">
            New
          </span>
          <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl ${
            selected === "crypto_updown" ? "bg-primary-500/20" : "bg-surface-400"
          }`}>
            <svg className={`h-5 w-5 ${selected === "crypto_updown" ? "text-primary-400" : "text-gray-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
            </svg>
          </div>
          <p className={`text-sm font-bold ${selected === "crypto_updown" ? "text-white" : "text-gray-300"}`}>
            Crypto Up/Down
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            Fast crypto price bets with oracle resolution
          </p>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Crypto Up/Down Form
// ---------------------------------------------------------------------------
function CryptoUpDownForm() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CryptoUpDownFormData>({
    asset: "BTC",
    timeframe: "15m",
    subtype: "up_down",
    strikePrice: "",
    initialYesLiquidity: "500",
    initialNoLiquidity: "500",
  });

  const { price: livePrice, loading: priceLoading, source: priceSource } = useCryptoPrice(form.asset);
  const assetMeta = CRYPTO_ASSETS.find((a) => a.value === form.asset)!;
  const timeframeMeta = CRYPTO_TIMEFRAMES.find((t) => t.value === form.timeframe)!;

  const yesLiq = parseFloat(form.initialYesLiquidity) || 0;
  const noLiq = parseFloat(form.initialNoLiquidity) || 0;
  const totalLiq = yesLiq + noLiq;
  const startingProb = totalLiq > 0 ? ((yesLiq / totalLiq) * 100).toFixed(0) : "50";

  const strikeVal = parseFloat(form.strikePrice) || 0;
  const strikePriceValid = form.subtype === "up_down" || strikeVal > 0;

  const isValid = yesLiq > 0 && noLiq > 0 && strikePriceValid;

  // Auto-generate question
  const question =
    form.subtype === "up_down"
      ? `${form.asset} Up or Down in ${timeframeMeta.label}?`
      : `Will ${form.asset} be above $${strikeVal.toLocaleString()} in ${timeframeMeta.label}?`;

  const description =
    form.subtype === "up_down"
      ? `Will ${assetMeta.label} (${form.asset}) price go up or down from $${livePrice.toLocaleString()} within ${timeframeMeta.label.toLowerCase()}? Resolved automatically via Pyth Network oracle.`
      : `Will ${assetMeta.label} (${form.asset}) exceed $${strikeVal.toLocaleString()} within ${timeframeMeta.label.toLowerCase()}? Current price: $${livePrice.toLocaleString()}. Resolved automatically via Pyth Network oracle.`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) return;
    setLoading(true);
    try {
      const resolutionTimestamp = Math.floor(Date.now() / 1000) + timeframeMeta.seconds;
      console.log("Creating Crypto Up/Down market:", {
        marketType: "crypto_updown",
        asset: form.asset,
        timeframe: form.timeframe,
        subtype: form.subtype,
        strikePrice: form.subtype === "price_target" ? strikeVal : null,
        startPrice: livePrice,
        question,
        description,
        resolutionTimestamp,
        creator: publicKey?.toBase58(),
        initialYesLiquidity: yesLiq,
        initialNoLiquidity: noLiq,
        oracleSource: "pyth",
      });

      alert(
        `Crypto Up/Down market created!\n\n${question}\n\nStart price: $${livePrice.toLocaleString()}\nExpires: ${timeframeMeta.label}\nPool: ${totalLiq} SOL (${yesLiq} YES / ${noLiq} NO)\nProbability: YES ${startingProb}%\nOracle: Pyth Network\n2% protocol fee on all trades.\n\nIn production, this sends a createMarket transaction to Solana.`
      );
      router.push("/");
    } catch (err) {
      console.error("Failed to create crypto market:", err);
      alert("Failed to create market. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 animate-fade-up">
      {/* Asset Selection */}
      <div className="space-y-4 rounded-2xl border border-surface-50/50 bg-surface-300 p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Select Asset</p>
        <div className="grid grid-cols-3 gap-3">
          {CRYPTO_ASSETS.map((asset) => (
            <button
              key={asset.value}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, asset: asset.value }))}
              className={`relative overflow-hidden rounded-xl border p-4 text-center transition-all active:scale-95 ${
                form.asset === asset.value
                  ? "border-primary-500/50 bg-primary-500/10 shadow-lg shadow-primary-500/10"
                  : "border-surface-50/50 bg-surface-400 hover:border-primary-500/20"
              }`}
            >
              <div className={`text-2xl font-black ${asset.color}`}>
                {asset.icon}
              </div>
              <p className="mt-1 text-xs font-semibold text-gray-300">{asset.label}</p>
              <p className="mt-0.5 text-[11px] font-medium tabular-nums text-gray-500">
                {livePrice > 0 && form.asset === asset.value
                  ? `$${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "..."}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Live Price Display */}
      <div className="flex items-center gap-3 rounded-2xl border border-surface-50/50 bg-surface-300 p-4">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-surface-400 text-lg font-black ${assetMeta.color}`}>
          {assetMeta.icon}
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-500">{assetMeta.label} Price</p>
          {priceLoading && livePrice === 0 ? (
            <div className="mt-1 h-6 w-32 animate-pulse rounded bg-surface-400" />
          ) : (
            <p className="text-xl font-bold tabular-nums text-white">
              ${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-bold text-green-400">LIVE</span>
          </div>
          <span className="text-[9px] text-gray-600">{({ pyth: "Pyth", coincap: "CoinCap", coingecko: "CoinGecko", jupiter: "Jupiter", fallback: "Cached" })[priceSource]}</span>
        </div>
      </div>

      {/* Timeframe */}
      <div className="space-y-4 rounded-2xl border border-surface-50/50 bg-surface-300 p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Timeframe</p>
        <div className="flex flex-wrap gap-2">
          {CRYPTO_TIMEFRAMES.map((tf) => (
            <button
              key={tf.value}
              type="button"
              onClick={() => setForm((prev) => ({ ...prev, timeframe: tf.value }))}
              className={`rounded-full px-4 py-2 text-xs font-semibold transition-all active:scale-95 ${
                form.timeframe === tf.value
                  ? "bg-white text-black shadow-lg"
                  : "bg-white/10 text-white/70 hover:bg-white/20"
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* Market Subtype */}
      <div className="space-y-4 rounded-2xl border border-surface-50/50 bg-surface-300 p-5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Market Type</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, subtype: "up_down" }))}
            className={`rounded-xl border p-4 text-left transition-all active:scale-95 ${
              form.subtype === "up_down"
                ? "border-primary-500/50 bg-primary-500/10"
                : "border-surface-50/50 bg-surface-400 hover:border-primary-500/20"
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
              </svg>
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
              </svg>
            </div>
            <p className="mt-2 text-sm font-bold text-white">Up / Down</p>
            <p className="mt-0.5 text-[11px] text-gray-500">Will price go up or down?</p>
          </button>

          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, subtype: "price_target" }))}
            className={`rounded-xl border p-4 text-left transition-all active:scale-95 ${
              form.subtype === "price_target"
                ? "border-primary-500/50 bg-primary-500/10"
                : "border-surface-50/50 bg-surface-400 hover:border-primary-500/20"
            }`}
          >
            <div className="flex items-center gap-1">
              <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="mt-2 text-sm font-bold text-white">Price Target</p>
            <p className="mt-0.5 text-[11px] text-gray-500">Will price hit a specific level?</p>
          </button>
        </div>

        {/* Strike Price Input (only for price_target) */}
        {form.subtype === "price_target" && (
          <div className="animate-fade-in">
            <label htmlFor="strikePrice" className="mb-1.5 block text-xs font-semibold text-amber-400">
              Target Price (USD) <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
              <input
                id="strikePrice"
                type="number"
                value={form.strikePrice}
                onChange={(e) => setForm((prev) => ({ ...prev, strikePrice: e.target.value }))}
                placeholder={livePrice.toLocaleString()}
                min="0"
                step="0.01"
                className="input-field pl-7"
              />
            </div>
            <p className="mt-1 text-[11px] text-gray-600">
              Current {form.asset} price: ${livePrice.toLocaleString()}
            </p>
          </div>
        )}
      </div>

      {/* Initial Liquidity */}
      <div className="space-y-4 rounded-2xl border border-primary-500/20 bg-primary-500/5 p-5">
        <div>
          <p className="text-xs font-semibold text-primary-400 uppercase tracking-wider">
            Seed Liquidity <span className="text-red-400">*</span>
          </p>
          <p className="mt-1 text-[11px] text-gray-500">
            Deposit liquidity to create the market. This determines starting probability and is locked until resolution.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="cyesLiq" className="mb-1.5 block text-xs font-semibold text-green-400">
              {form.subtype === "up_down" ? "UP" : "YES"} Pool (SOL)
            </label>
            <input
              id="cyesLiq"
              type="number"
              value={form.initialYesLiquidity}
              onChange={(e) => setForm((prev) => ({ ...prev, initialYesLiquidity: e.target.value }))}
              placeholder="500"
              min="0"
              step="0.1"
              className="input-field"
            />
          </div>
          <div>
            <label htmlFor="cnoLiq" className="mb-1.5 block text-xs font-semibold text-red-400">
              {form.subtype === "up_down" ? "DOWN" : "NO"} Pool (SOL)
            </label>
            <input
              id="cnoLiq"
              type="number"
              value={form.initialNoLiquidity}
              onChange={(e) => setForm((prev) => ({ ...prev, initialNoLiquidity: e.target.value }))}
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
                <span className="text-sm font-bold text-green-400">
                  {form.subtype === "up_down" ? "UP" : "YES"} {startingProb}%
                </span>
                <span className="text-xs text-gray-600">/</span>
                <span className="text-sm font-bold text-red-400">
                  {form.subtype === "up_down" ? "DOWN" : "NO"} {100 - parseInt(startingProb)}%
                </span>
              </div>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-green-400 to-green-500"
                style={{ width: `${startingProb}%` }}
              />
            </div>
            <p className="text-[10px] text-gray-600">
              Liquidity locked until market resolution. 2% protocol fee on all trades.
            </p>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="relative overflow-hidden rounded-2xl border border-primary-500/20 bg-primary-500/5 animate-fade-in">
        <div className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Preview</span>
            <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-400">
              Crypto Up/Down
            </span>
            <span className={`rounded-full bg-surface-400 px-2.5 py-0.5 text-[10px] font-bold ${assetMeta.color}`}>
              {form.asset}
            </span>
          </div>
          <p className="text-base font-bold text-white">{question}</p>
          <p className="mt-2 text-xs text-gray-400 leading-relaxed">{description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-gray-500">
              {timeframeMeta.label}
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-gray-500">
              Pyth Oracle
            </span>
            <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] text-gray-500">
              Auto-resolve
            </span>
          </div>
        </div>
      </div>

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
          `Create ${form.asset} ${form.subtype === "up_down" ? "Up/Down" : "Price Target"} Market`
        )}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Prediction Market Form (existing, extracted)
// ---------------------------------------------------------------------------
function PredictionMarketForm() {
  const router = useRouter();
  const { publicKey } = useWallet();
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
    if (!isValid) return;

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
    <form onSubmit={handleSubmit} className="space-y-5 animate-fade-up">
      <div className="space-y-4 rounded-2xl border border-surface-50/50 bg-surface-300 p-5">
        {/* Question */}
        <div>
          <label htmlFor="question" className="mb-1.5 block text-xs font-semibold text-gray-400">
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
          <p className="mt-1 text-[11px] text-gray-600">Clear yes/no question. Min 10 characters.</p>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="mb-1.5 block text-xs font-semibold text-gray-400">
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
          <p className="mt-1 text-[11px] text-gray-600">Resolution criteria. Min 20 characters.</p>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="mb-1.5 block text-xs font-semibold text-gray-400">
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
          <label className="mb-1.5 block text-xs font-semibold text-gray-400">Cover Image</label>
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
                <input type="file" accept="image/*" onChange={handleImageFile} className="hidden" />
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
          <label htmlFor="videoUrl" className="mb-1.5 block text-xs font-semibold text-gray-400">
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
          <p className="mt-1 text-[11px] text-gray-600">YouTube or X/Twitter video link. Plays inline on the card.</p>
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
            <label htmlFor="initialYesLiquidity" className="mb-1.5 block text-xs font-semibold text-green-400">
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
            <label htmlFor="initialNoLiquidity" className="mb-1.5 block text-xs font-semibold text-red-400">
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
            <label htmlFor="resolutionDate" className="mb-1.5 block text-xs font-semibold text-gray-400">
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
            <label htmlFor="resolutionTime" className="mb-1.5 block text-xs font-semibold text-gray-400">
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
          <label htmlFor="dataSourceUrl" className="mb-1.5 block text-xs font-semibold text-gray-400">
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
          <p className="mt-1 text-[11px] text-gray-600">URL to verify the outcome.</p>
        </div>
      </div>

      {/* Preview */}
      {form.question && (
        <div className="relative overflow-hidden rounded-2xl border border-primary-500/20 bg-primary-500/5 animate-fade-in">
          {(imagePreview || form.coverImage) && (
            <img src={imagePreview || form.coverImage} alt="" className="h-32 w-full object-cover opacity-40" />
          )}
          <div className="p-5">
            <div className="mb-2 flex items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Preview</p>
              {form.category && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-white/60">
                  {form.category}
                </span>
              )}
            </div>
            <p className="text-base font-bold text-white">{form.question}</p>
            {form.description && (
              <p className="mt-2 text-xs text-gray-400 leading-relaxed">{form.description}</p>
            )}
            {form.resolutionDate && (
              <p className="mt-2 text-[11px] text-gray-500">
                Resolves: {new Date(`${form.resolutionDate}T${form.resolutionTime}`).toLocaleString()}
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
  );
}

// ---------------------------------------------------------------------------
// Main Page — prediction markets only (binaries are platform-controlled)
// ---------------------------------------------------------------------------
export default function CreateMarketPage() {
  const { connected } = useWallet();

  return (
    <div className="mx-auto max-w-lg px-4 py-6 pb-24 sm:max-w-2xl sm:px-6 md:pb-6">
      <div className="mb-6 animate-fade-up">
        <h1 className="text-2xl font-bold text-white">Create Market</h1>
        <p className="mt-1 text-sm text-gray-400">
          Create a custom prediction market with any yes/no question.
        </p>
        <p className="mt-1 text-[11px] text-gray-600">
          Looking for crypto price bets? Check out{" "}
          <a href="/binaries" className="text-primary-400 hover:underline">Binaries</a>{" "}
          for live 5-minute rounds.
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
        <PredictionMarketForm />
      )}
    </div>
  );
}
