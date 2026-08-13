import { z } from "zod";
import { CATEGORY_META } from "./categories";
import { getPromotableClaims, type ClaimConfidence, type ProspectContext } from "./prospect-context";
import type { Business, ScoreBreakdown } from "./types";

export const RECEPTIONIST_SANDBOX_BRIEF_VERSION = 1;

const ClaimConfidenceSchema = z.enum(["supported", "inferred", "weak", "unsupported"]);

const ScoreBreakdownSchema = z.object({
  categoryFit: z.number(),
  callDependency: z.number(),
  schedulingComplexity: z.number(),
  websiteFriction: z.number(),
  reviewPain: z.number(),
  businessValue: z.number(),
  confidencePenalty: z.number(),
});

const SandboxContextEvidenceSchema = z.object({
  id: z.string().min(1),
  sourceType: z.string().min(1),
  sourceLabel: z.string().min(1),
  text: z.string().min(1),
  url: z.string().optional(),
});

const SandboxContextClaimSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  text: z.string().min(1),
  confidence: ClaimConfidenceSchema,
  evidenceIds: z.array(z.string().min(1)),
});

export const SandboxPublicSignalsSchema = z.object({
  phone: z.string().nullable(),
  website: z.string().nullable(),
  rating: z.number().nullable(),
  reviewCount: z.number().nonnegative().nullable(),
  hasWebsite: z.boolean(),
  hasVisiblePhone: z.boolean(),
  hasOnlineBooking: z.boolean(),
  phoneSignalWording: z.string().min(1),
  websiteSignalWording: z.string().min(1),
  bookingSignal: z.enum(["online_booking_signal_detected", "no_obvious_online_booking_signal_detected"]),
  bookingSignalWording: z.string().min(1),
  reviewProxyHypotheses: z.array(z.string().min(1)),
});

export type SandboxPublicSignals = z.infer<typeof SandboxPublicSignalsSchema>;

export const SandboxGuardrailsSchema = z.object({
  allowedUse: z.string().min(1),
  unknowns: z.array(z.string().min(1)),
  prohibitedClaims: z.array(z.string().min(1)),
  evidenceRules: z.array(z.string().min(1)),
  bookingWording: z.string().min(1),
  reviewProxyWording: z.string().min(1),
});

export type SandboxGuardrails = z.infer<typeof SandboxGuardrailsSchema>;

export const SandboxScenarioSeedSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  callerType: z.string().min(1),
  callerGoal: z.string().min(1),
  openingLine: z.string().min(1),
  contextForAgent: z.array(z.string().min(1)),
  evidenceBasis: z.array(z.string().min(1)),
  guardrailNotes: z.array(z.string().min(1)),
});

export type SandboxScenarioSeed = z.infer<typeof SandboxScenarioSeedSchema>;

export const ReceptionistSandboxBriefSchema = z.object({
  version: z.literal(RECEPTIONIST_SANDBOX_BRIEF_VERSION),
  generatedAt: z.string().datetime(),
  business: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    category: z.string().min(1),
    categoryLabel: z.string().min(1),
    address: z.string().min(1),
  }),
  publicSignals: SandboxPublicSignalsSchema,
  voiceAiFit: z.object({
    score: z.number(),
    scoreMax: z.literal(9),
    scoreBreakdown: ScoreBreakdownSchema,
    recommendedUseCase: z.string().min(1),
    reasoning: z.string().min(1),
    framing: z.string().min(1),
  }),
  aiContext: z.object({
    summary: z.string().nullable(),
    angle: z.string().nullable(),
    category: z.string().nullable(),
    depth: z.string().nullable(),
  }),
  prospectContext: z.object({
    available: z.boolean(),
    depth: z.enum(["standard", "deep", "deterministic"]).nullable(),
    claims: z.array(SandboxContextClaimSchema),
    evidence: z.array(SandboxContextEvidenceSchema),
  }),
  guardrails: SandboxGuardrailsSchema,
  scenarioSeeds: z.array(SandboxScenarioSeedSchema).min(1),
});

export type ReceptionistSandboxBrief = z.infer<typeof ReceptionistSandboxBriefSchema>;

export function buildReceptionistSandboxBrief(
  business: Business,
  prospectContext?: ProspectContext,
): ReceptionistSandboxBrief {
  const publicSignals = buildPublicSignals(business);
  const guardrails = buildGuardrails(publicSignals);

  const brief: ReceptionistSandboxBrief = {
    version: RECEPTIONIST_SANDBOX_BRIEF_VERSION,
    generatedAt: validIsoOrNow(prospectContext?.generatedAt ?? business.aiEnrichedAt),
    business: {
      id: business.id,
      name: business.name,
      category: business.category,
      categoryLabel: CATEGORY_META[business.category].label,
      address: business.address,
    },
    publicSignals,
    voiceAiFit: {
      score: business.voiceAiScore,
      scoreMax: 9,
      scoreBreakdown: business.scoreBreakdown,
      recommendedUseCase: business.recommendedUseCase,
      reasoning: business.reasoning,
      framing: "Use the score and rationale as prioritization context only; validate workflow pain in conversation.",
    },
    aiContext: {
      summary: business.aiSummary ?? null,
      angle: business.aiAngle ?? null,
      category: business.aiCategory ?? null,
      depth: business.aiDepth ?? null,
    },
    prospectContext: buildSandboxContext(prospectContext),
    guardrails,
    scenarioSeeds: buildScenarioSeeds(business, publicSignals, guardrails, prospectContext),
  };

  return ReceptionistSandboxBriefSchema.parse(brief);
}

function buildPublicSignals(business: Business): SandboxPublicSignals {
  return {
    phone: business.phone ?? null,
    website: business.website ?? null,
    rating: business.rating ?? null,
    reviewCount: business.reviewCount ?? null,
    hasWebsite: business.hasWebsite,
    hasVisiblePhone: business.hasVisiblePhone,
    hasOnlineBooking: business.hasOnlineBooking,
    phoneSignalWording: buildPhoneSignalWording(business),
    websiteSignalWording: buildWebsiteSignalWording(business),
    bookingSignal: business.hasOnlineBooking
      ? "online_booking_signal_detected"
      : "no_obvious_online_booking_signal_detected",
    bookingSignalWording: buildBookingSignalWording(business.hasOnlineBooking),
    reviewProxyHypotheses: business.reviewPainSignals.map(
      (signal) => `Hypothesis from a public proxy signal: ${signal}. This is not a verified customer complaint.`,
    ),
  };
}

function buildGuardrails(publicSignals: SandboxPublicSignals): SandboxGuardrails {
  return {
    allowedUse:
      "Sandbox-ready public business context for testing receptionist-style scenarios; not a factual operational audit.",
    unknowns: [
      "Actual call volume is unknown.",
      "Missed-call volume is unknown.",
      "Front-desk staffing levels and workload are unknown.",
      "Revenue impact is unknown.",
      "Actual booking workflow is unknown unless direct website evidence is present.",
      "Customer complaint themes are unknown unless backed by direct review text.",
    ],
    prohibitedClaims: [
      "Do not claim actual call volume, missed-call volume, staff overload, or lost revenue from this brief.",
      "Do not present review-count, rating, or stored review proxy signals as proven customer complaints.",
      "Do not state the business lacks online booking unless separately verified by direct evidence.",
      "Do not provide medical, legal, financial, or other regulated advice in the simulated receptionist flow.",
    ],
    evidenceRules: [
      "Use phone, website, rating, review count, address, and category as public-record facts only when present.",
      "Use score, reasoning, AI summary, AI angle, and generated claims as hypotheses or sales-context framing.",
      "If a claim has weak or unsupported confidence, ask a clarifying question instead of asserting it.",
    ],
    bookingWording: publicSignals.bookingSignalWording,
    reviewProxyWording:
      "Review proxy signals may suggest outreach questions, but they are hypotheses and not proven complaints.",
  };
}

function buildSandboxContext(prospectContext?: ProspectContext): ReceptionistSandboxBrief["prospectContext"] {
  if (!prospectContext) {
    return {
      available: false,
      depth: null,
      claims: [],
      evidence: [],
    };
  }

  return {
    available: true,
    depth: prospectContext.depth,
    claims: getPromotableClaims(prospectContext.generatedClaims).map((claim) => ({
      id: claim.id,
      kind: claim.kind,
      text: claim.text,
      confidence: claim.confidence,
      evidenceIds: claim.evidenceIds,
    })),
    evidence: prospectContext.evidence.map((snippet) => ({
      id: snippet.id,
      sourceType: snippet.sourceType,
      sourceLabel: snippet.sourceLabel,
      text: snippet.text,
      url: snippet.url,
    })),
  };
}

function buildScenarioSeeds(
  business: Business,
  publicSignals: SandboxPublicSignals,
  guardrails: SandboxGuardrails,
  prospectContext?: ProspectContext,
): SandboxScenarioSeed[] {
  const categoryLabel = CATEGORY_META[business.category].label;
  const baseContext = [
    `${business.name} is a ${categoryLabel} prospect at ${business.address}.`,
    publicSignals.phoneSignalWording,
    publicSignals.websiteSignalWording,
    publicSignals.bookingSignalWording,
    `Suggested use case from the scoring rubric: ${business.recommendedUseCase}`,
  ];
  const evidenceBasis = buildEvidenceBasis(prospectContext);
  const guardrailNotes = [
    guardrails.bookingWording,
    guardrails.reviewProxyWording,
    "Do not infer call volume, staffing pressure, or revenue loss.",
  ];

  return [
    {
      id: "new-service-enquiry",
      title: "New service enquiry",
      callerType: "Prospective customer",
      callerGoal: `Ask about ${categoryLabel.toLowerCase()} services and request the next practical contact or appointment route.`,
      openingLine: `Hi, I am interested in ${business.name}. Can you help me understand the best way to make an enquiry?`,
      contextForAgent: baseContext,
      evidenceBasis,
      guardrailNotes,
    },
    {
      id: "booking-route-clarification",
      title: "Booking route clarification",
      callerType: "Prospective or returning customer",
      callerGoal: "Find out whether to use an online route, phone route, or callback for an appointment-style request.",
      openingLine: "Hello, I wanted to check how bookings or callbacks usually work before I send my details.",
      contextForAgent: [
        ...baseContext,
        "If online booking is unclear, acknowledge uncertainty and offer to take details for human follow-up in the sandbox flow.",
      ],
      evidenceBasis,
      guardrailNotes,
    },
    {
      id: "contact-and-location-question",
      title: "Contact and location question",
      callerType: "Customer checking public details",
      callerGoal: "Confirm public contact details, website availability, and location before deciding next steps.",
      openingLine: `Hi, I am checking details for ${business.name}. Could you confirm the public contact and location information?`,
      contextForAgent: [
        `${business.name} public address: ${business.address}.`,
        publicSignals.phone ? `Public phone in the record: ${publicSignals.phone}.` : publicSignals.phoneSignalWording,
        publicSignals.website ? `Public website in the record: ${publicSignals.website}.` : publicSignals.websiteSignalWording,
      ],
      evidenceBasis,
      guardrailNotes,
    },
  ];
}

function buildEvidenceBasis(prospectContext?: ProspectContext): string[] {
  if (!prospectContext) {
    return ["Business public fields and deterministic Voice AI scoring fields from the prospect intelligence app."];
  }

  const claimIds = getPromotableClaims(prospectContext.generatedClaims).map((claim) => claim.id);
  const evidenceIds = prospectContext.evidence.map((snippet) => snippet.id);

  return [
    `ProspectContext depth: ${prospectContext.depth}.`,
    `Usable claim IDs: ${claimIds.length ? claimIds.join(", ") : "none"}.`,
    `Evidence IDs available: ${evidenceIds.length ? evidenceIds.join(", ") : "none"}.`,
  ];
}

function buildPhoneSignalWording(business: Business): string {
  if (business.phone) return "A public phone number is available in the business record.";
  if (business.hasVisiblePhone) return "A visible phone signal is flagged, but no phone number is stored in this brief.";
  return "No stored public phone signal was detected in the available data.";
}

function buildWebsiteSignalWording(business: Business): string {
  if (business.website) return "A public website URL is available in the business record.";
  if (business.hasWebsite) return "A website signal is flagged, but no website URL is stored in this brief.";
  return "No stored website signal was detected in the available data.";
}

function buildBookingSignalWording(hasOnlineBooking: boolean): string {
  if (hasOnlineBooking) {
    return "An online booking signal was detected by the existing public-data heuristic; verify the actual workflow before relying on it.";
  }

  return "No obvious online booking signal was detected from the available public data; this does not prove the business lacks online booking.";
}

function validIsoOrNow(value?: string | null): string {
  if (value) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return new Date().toISOString();
}

export function formatScoreBreakdownForSandbox(breakdown: ScoreBreakdown): string {
  return Object.entries(breakdown)
    .map(([key, value]) => `${key}: ${value >= 0 ? "+" : ""}${value}`)
    .join(", ");
}

export function formatConfidenceForSandbox(confidence: ClaimConfidence): string {
  if (confidence === "supported") return "supported";
  if (confidence === "inferred") return "inferred";
  if (confidence === "weak") return "weak signal";
  return "unsupported";
}

export function summarizeSandboxEvidence(brief: ReceptionistSandboxBrief): string {
  const evidenceCount = brief.prospectContext.evidence.length;
  const claimCount = brief.prospectContext.claims.length;

  if (!brief.prospectContext.available) {
    return "No generated prospect context is attached; use public business fields and scoring only.";
  }

  return `${claimCount} promotable claim${claimCount === 1 ? "" : "s"} backed by ${evidenceCount} evidence snippet${
    evidenceCount === 1 ? "" : "s"
  }.`;
}
