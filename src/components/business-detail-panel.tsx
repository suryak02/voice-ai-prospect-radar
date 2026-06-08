"use client";

import { useState } from "react";
import { ExternalLink, Navigation, Phone, ShieldCheck, Sparkles } from "lucide-react";
import { buildSpecificReasoning, buildVoiceAiAngle } from "@/lib/prospect-insights";
import { getScoreLabel, getScorePillClasses } from "@/lib/scoring";
import type { Business } from "@/lib/types";

type BusinessDetailPanelProps = {
  business: Business;
  onOpenTicket: (business: Business) => void | Promise<void>;
  onReject: (business: Business) => void | Promise<void>;
  hasOpenTicket: boolean;
  canUseDeepResearch?: boolean;
};

type ResearchDepth = "standard" | "deep";

type EnrichmentState = {
  summary?: string;
  angle?: string;
  category?: string;
  depth?: string;
  enrichedAt?: string;
};

function formatEnrichedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(date);
}

function googleMapsDirectionsUrl(business: Business): string {
  const destination = encodeURIComponent(`${business.name}, ${business.address}`);
  const url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
  return business.googlePlaceId ? `${url}&destination_place_id=${business.googlePlaceId}` : url;
}

function safeExternalUrl(url?: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

const breakdownLabels: Record<keyof Business["scoreBreakdown"], string> = {
  categoryFit: "Category fit",
  callDependency: "Call dependency",
  schedulingComplexity: "Scheduling complexity",
  websiteFriction: "Website friction",
  reviewPain: "Review pain",
  businessValue: "Demand (reviews)",
  confidencePenalty: "Confidence penalty",
};

export function BusinessDetailPanel({
  business,
  onOpenTicket,
  onReject,
  hasOpenTicket,
  canUseDeepResearch = false,
}: BusinessDetailPanelProps) {
  const entries = Object.entries(business.scoreBreakdown) as [keyof Business["scoreBreakdown"], number][];
  const reasoning = buildSpecificReasoning(business);
  const voiceAiAngle = buildVoiceAiAngle(business);
  const websiteUrl = safeExternalUrl(business.website);

  const [generated, setGenerated] = useState<EnrichmentState | null>(null);
  const [enrichStatus, setEnrichStatus] = useState<"idle" | "loading" | "error">("idle");
  const [enrichError, setEnrichError] = useState("");
  const [depthMode, setDepthMode] = useState<ResearchDepth>("standard");
  const [trackedBusinessId, setTrackedBusinessId] = useState(business.id);

  // Reset transient AI state when a different prospect is selected (the
  // React-recommended "adjust state during render" pattern — no effect needed).
  if (business.id !== trackedBusinessId) {
    setTrackedBusinessId(business.id);
    setGenerated(null);
    setEnrichStatus("idle");
    setEnrichError("");
    setDepthMode("standard");
  }

  // Freshly generated analysis wins; otherwise fall back to the DB-cached one.
  const enrichment: EnrichmentState | null =
    generated ??
    (business.aiSummary
      ? { summary: business.aiSummary, angle: business.aiAngle, category: business.aiCategory, depth: business.aiDepth, enrichedAt: business.aiEnrichedAt }
      : null);

  async function generateAiAnalysis(mode: ResearchDepth) {
    setEnrichStatus("loading");
    setEnrichError("");
    try {
      const response = await fetch("/api/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: business.id, mode }),
      });
      const data = (await response.json()) as EnrichmentState & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "AI analysis failed.");
      setGenerated({ summary: data.summary, angle: data.angle, category: data.category, depth: data.depth, enrichedAt: data.enrichedAt });
      setEnrichStatus("idle");
    } catch (error) {
      setEnrichStatus("error");
      setEnrichError(error instanceof Error ? error.message : "AI analysis failed.");
    }
  }

  return (
    <aside className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-indigo-200/70">Selected prospect</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{business.name}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-400">{business.address}</p>
        </div>
        <div className={`rounded-2xl border px-3 py-2 text-center ${getScorePillClasses(business.voiceAiScore)}`}>
          <p className="text-3xl font-black leading-none">{business.voiceAiScore}</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wider">/9</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium">
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-slate-300">{business.borough}</span>
        <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 capitalize text-slate-300">{business.category}</span>
        <span className={`rounded-full border px-3 py-1 ${getScorePillClasses(business.voiceAiScore)}`}>
          {getScoreLabel(business.voiceAiScore)}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-slate-500">Google rating</p>
          <p className="mt-1 font-semibold text-white">{business.rating ?? "Unknown"}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <p className="text-slate-500">Reviews</p>
          <p className="mt-1 font-semibold text-white">{business.reviewCount ?? "Unknown"}</p>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-indigo-300/20 bg-indigo-300/[0.06] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles className="h-4 w-4 text-indigo-300" /> AI analysis
          </h3>
          <div className="flex items-center gap-2">
            {enrichment?.depth === "deep" && (
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-100">
                Deep research
              </span>
            )}
            {enrichment?.enrichedAt && (
              <span className="text-[10px] text-slate-500">updated {formatEnrichedAt(enrichment.enrichedAt)}</span>
            )}
          </div>
        </div>

        {canUseDeepResearch && (
          <div className="mt-3">
            <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-0.5 text-xs">
              {(["standard", "deep"] as ResearchDepth[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setDepthMode(mode)}
                  disabled={enrichStatus === "loading"}
                  className={`rounded-full px-3 py-1 font-medium transition disabled:opacity-50 ${
                    depthMode === mode ? "bg-indigo-500 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {mode === "standard" ? "Standard" : "Deep research"}
                </button>
              ))}
            </div>
            {depthMode === "deep" && (
              <p className="mt-1.5 text-[11px] leading-4 text-slate-500">
                Deep research uses website text when it can be fetched. Admin only.
              </p>
            )}
          </div>
        )}

        {enrichment?.summary ? (
          <div className="mt-3 space-y-2 text-sm leading-6 text-slate-200">
            {enrichment.category && enrichment.category !== business.category && (
              <p className="text-xs text-indigo-200/80">
                AI read: <span className="font-semibold capitalize">{enrichment.category.replace(/_/g, " ")}</span>
              </p>
            )}
            <p>{enrichment.summary}</p>
            {enrichment.angle && (
              <p className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-slate-300">
                <span className="font-semibold text-white">Outreach: </span>
                {enrichment.angle}
              </p>
            )}
            <button
              type="button"
              onClick={() => generateAiAnalysis(depthMode)}
              disabled={enrichStatus === "loading"}
              className="text-xs font-medium text-indigo-300 transition hover:text-indigo-200 disabled:opacity-50"
            >
              {enrichStatus === "loading"
                ? depthMode === "deep"
                  ? "Researching…"
                  : "Refreshing…"
                : depthMode === "deep"
                  ? enrichment.depth === "deep"
                    ? "Refresh deep research"
                    : "Run deep research"
                  : "Refresh analysis"}
            </button>
          </div>
        ) : (
          <div className="mt-3">
            <p className="text-sm leading-6 text-slate-400">
              Generate a personalized, OpenAI-written read on this specific business. It&apos;s saved and reused for a week.
            </p>
            <button
              type="button"
              onClick={() => generateAiAnalysis(depthMode)}
              disabled={enrichStatus === "loading"}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:bg-white/10 disabled:text-slate-500"
            >
              <Sparkles className="h-4 w-4" />
              {enrichStatus === "loading"
                ? depthMode === "deep"
                  ? "Researching…"
                  : "Analyzing…"
                : depthMode === "deep"
                  ? "Generate deep research"
                  : "Generate AI analysis"}
            </button>
          </div>
        )}

        {enrichStatus === "error" && <p className="mt-2 text-xs text-rose-300">{enrichError}</p>}
      </div>

      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold text-white">Why this score</h3>
        <div className="space-y-2 text-sm leading-6 text-slate-300">
          {reasoning.map((point) => (
            <p key={point} className="rounded-2xl border border-white/10 bg-black/20 px-3 py-2">
              {point}
            </p>
          ))}
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <h3 className="text-sm font-semibold text-white">Score breakdown</h3>
        <div className="space-y-2">
          {entries.map(([key, value]) => {
            const normalized = key === "confidencePenalty" ? Math.abs(value) : value;
            const width = `${Math.min(100, (normalized / 2) * 100)}%`;

            return (
              <div key={key} className="space-y-1.5">
                <div className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs">
                  <span className="text-slate-400">{breakdownLabels[key]}</span>
                  <span className={value < 0 ? "font-semibold text-rose-300" : "font-semibold text-slate-100"}>
                    {value > 0 ? `+${value}` : value}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full ${value < 0 ? "bg-rose-400" : "bg-indigo-400"}`}
                    style={{ width }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4">
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <div>
            <h3 className="text-sm font-semibold text-emerald-50">Recommended Voice AI angle</h3>
            <p className="mt-1 text-sm leading-6 text-emerald-100/80">{voiceAiAngle}</p>
          </div>
        </div>
      </div>

      {business.reviewPainSignals.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {business.reviewPainSignals.map((signal) => (
            <span key={signal} className="rounded-full border border-rose-300/20 bg-rose-300/10 px-3 py-1 text-xs font-medium text-rose-100">
              {signal}
            </span>
          ))}
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => onOpenTicket(business)}
          disabled={hasOpenTicket}
          className="rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:bg-white/10 disabled:text-slate-500"
        >
          {hasOpenTicket ? "Ticket opened" : "Open review ticket"}
        </button>
        <button
          type="button"
          onClick={() => onReject(business)}
          className="rounded-full border border-white/10 bg-white/[0.03] px-5 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07]"
        >
          {hasOpenTicket ? "Change to not fit" : "Mark not fit"}
        </button>
      </div>

      <div className="mt-6 space-y-2 border-t border-white/10 pt-5 text-xs text-slate-400">
        {business.phone && (
          <a
            href={`tel:${business.phone.replace(/[^+\d]/g, "")}`}
            className="flex items-center gap-2 transition hover:text-white"
          >
            <Phone className="h-3.5 w-3.5 shrink-0 text-slate-500" /> {business.phone}
          </a>
        )}
        {websiteUrl && (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 break-all transition hover:text-white"
          >
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-500" /> {business.website}
          </a>
        )}
        <a
          href={googleMapsDirectionsUrl(business)}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 font-medium text-indigo-300 transition hover:text-indigo-200"
        >
          <Navigation className="h-3.5 w-3.5 shrink-0" /> Get directions on Google Maps
        </a>
        <p className="pt-1 text-slate-500">
          Caveat: this is a prioritization signal from public data, not proof of the business&apos;s internal workflow.
        </p>
      </div>
    </aside>
  );
}
