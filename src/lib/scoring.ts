import { CATEGORY_META } from "./categories";
import type { ScoreBreakdown, ScoreInput } from "./types";

export type ScoreResult = {
  score: number;
  breakdown: ScoreBreakdown;
};

export function calculateVoiceAiScore(input: ScoreInput): ScoreResult {
  const fitTier = CATEGORY_META[input.category]?.fitTier ?? "low";
  const categoryFit = fitTier === "high" ? 2 : fitTier === "mid" ? 1 : 0;

  const callDependency = input.hasVisiblePhone
    ? input.appointmentBased || input.highValueService
      ? 2
      : 1
    : 0;

  const schedulingComplexity = input.appointmentBased
    ? input.highValueService
      ? 2
      : 1
    : 0;

  const websiteFriction = !input.hasOnlineBooking
    ? input.hasWebsite
      ? 1
      : 0.5
    : 0;

  const reviewPain = input.reviewPainSignals.length >= 2 ? 1 : input.reviewPainSignals.length === 1 ? 0.5 : 0;

  // Demand proxy from public review volume. Tiered (0/1/2) instead of a flat
  // "is high-value" point, so it varies across businesses and the score
  // actually discriminates rather than clustering every clinic at the top.
  const reviewCount = input.reviewCount ?? 0;
  const businessValue = reviewCount >= 400 ? 2 : reviewCount >= 100 ? 1 : 0;

  // Penalize each missing public signal (website / phone / reviews) so
  // thin-data prospects rank below well-evidenced ones.
  const missingSignals =
    (input.hasWebsite ? 0 : 1) + (input.hasVisiblePhone ? 0 : 1) + (input.reviewCount === undefined ? 1 : 0);
  const confidencePenalty = -Math.min(2, missingSignals);

  const rawScore =
    categoryFit +
    callDependency +
    schedulingComplexity +
    websiteFriction +
    reviewPain +
    businessValue +
    confidencePenalty;

  return {
    score: clampScore(Math.round(rawScore)),
    breakdown: {
      categoryFit,
      callDependency,
      schedulingComplexity,
      websiteFriction,
      reviewPain,
      businessValue,
      confidencePenalty,
    },
  };
}

export function clampScore(score: number): number {
  return Math.max(0, Math.min(9, score));
}

export function getScoreLabel(score: number): string {
  if (score >= 9) return "Highest priority";
  if (score >= 7) return "Strong candidate";
  if (score >= 5) return "Promising";
  if (score >= 3) return "Low priority";
  return "Poor fit";
}

export function getScoreColorClasses(score: number): string {
  if (score >= 9) return "bg-fuchsia-500 text-white ring-fuchsia-300/30 shadow-[0_0_34px_rgba(217,70,239,0.35)]";
  if (score >= 7) return "bg-rose-500 text-white ring-rose-300/30 shadow-[0_0_28px_rgba(244,63,94,0.32)]";
  if (score >= 5) return "bg-amber-400 text-slate-950 ring-amber-200/40 shadow-[0_0_26px_rgba(251,191,36,0.24)]";
  if (score >= 3) return "bg-sky-500 text-white ring-sky-300/30 shadow-[0_0_24px_rgba(14,165,233,0.28)]";
  return "bg-slate-600 text-white ring-slate-300/20 shadow-[0_0_18px_rgba(148,163,184,0.18)]";
}

export function getScorePillClasses(score: number): string {
  if (score >= 9) return "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-100";
  if (score >= 7) return "border-rose-400/30 bg-rose-400/10 text-rose-100";
  if (score >= 5) return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  if (score >= 3) return "border-sky-400/30 bg-sky-400/10 text-sky-100";
  return "border-white/10 bg-white/[0.04] text-slate-200";
}
