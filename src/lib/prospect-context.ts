import { z } from "zod";
import { CATEGORY_META } from "./categories";
import type { Business, ScoreBreakdown } from "./types";

export const PROSPECT_CONTEXT_VERSION = 1;

export const evidenceSourceTypeValues = ["places", "website", "scoring", "category_meta", "stored_ai"] as const;
export const claimConfidenceValues = ["supported", "inferred", "weak", "unsupported"] as const;

export const EvidenceSourceTypeSchema = z.enum(evidenceSourceTypeValues);
export const ClaimConfidenceSchema = z.enum(claimConfidenceValues);

export type EvidenceSourceType = z.infer<typeof EvidenceSourceTypeSchema>;
export type ClaimConfidence = z.infer<typeof ClaimConfidenceSchema>;

export const EvidenceSnippetSchema = z.object({
  id: z.string().min(1),
  sourceType: EvidenceSourceTypeSchema,
  sourceLabel: z.string().min(1),
  text: z.string().min(1),
  url: z.string().url().optional(),
});

export type EvidenceSnippet = z.infer<typeof EvidenceSnippetSchema>;

export const GeneratedClaimSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["score", "reasoning", "ai_summary", "ai_angle", "ai_category"]),
  text: z.string().min(1),
  confidence: ClaimConfidenceSchema,
  evidenceIds: z.array(z.string().min(1)),
});

export type GeneratedClaim = z.infer<typeof GeneratedClaimSchema>;

export const ExtractedServiceSchema = z.object({
  name: z.string().min(1),
  category: z.string().optional(),
  confidence: ClaimConfidenceSchema,
  evidenceIds: z.array(z.string().min(1)),
});

export type ExtractedService = z.infer<typeof ExtractedServiceSchema>;

export const ContactSignalSchema = z.object({
  type: z.enum(["phone", "website", "no_phone_signal_detected", "no_website_signal_detected"]),
  label: z.string().min(1),
  value: z.string().optional(),
  confidence: ClaimConfidenceSchema,
  evidenceIds: z.array(z.string().min(1)),
});

export type ContactSignal = z.infer<typeof ContactSignalSchema>;

export const BookingSignalSchema = z.object({
  type: z.enum(["booking_url_token", "booking_signal_detected", "no_obvious_booking_signal"]),
  label: z.string().min(1),
  value: z.string().optional(),
  confidence: ClaimConfidenceSchema,
  evidenceIds: z.array(z.string().min(1)),
});

export type BookingSignal = z.infer<typeof BookingSignalSchema>;

export const OpeningHoursSignalSchema = z.object({
  label: z.string().min(1),
  hoursText: z.string().optional(),
  confidence: ClaimConfidenceSchema,
  evidenceIds: z.array(z.string().min(1)),
});

export type OpeningHoursSignal = z.infer<typeof OpeningHoursSignalSchema>;

export const PainHypothesisSignalSchema = z.object({
  label: z.string().min(1),
  basis: z.enum(["category_heuristic", "score_heuristic", "review_count_proxy", "rating_proxy", "stored_review_signal"]),
  confidence: ClaimConfidenceSchema,
  evidenceIds: z.array(z.string().min(1)),
});

export type PainHypothesisSignal = z.infer<typeof PainHypothesisSignalSchema>;

export const ProspectContextSchema = z.object({
  version: z.literal(PROSPECT_CONTEXT_VERSION),
  businessId: z.string().min(1),
  businessName: z.string().min(1),
  category: z.string().min(1),
  generatedAt: z.string().datetime().nullable(),
  depth: z.enum(["standard", "deep", "deterministic"]),
  evidence: z.array(EvidenceSnippetSchema),
  services: z.array(ExtractedServiceSchema),
  contactSignals: z.array(ContactSignalSchema),
  bookingSignals: z.array(BookingSignalSchema),
  openingHoursSignals: z.array(OpeningHoursSignalSchema),
  painHypotheses: z.array(PainHypothesisSignalSchema),
  generatedClaims: z.array(GeneratedClaimSchema),
});

export type ProspectContext = z.infer<typeof ProspectContextSchema>;

const bookingTokens = ["book", "booking", "appoint", "cliniko", "doctify", "dentally", "zocdoc", "resdiary", "opentable"];

export function buildProspectContextFromBusiness(business: Business): ProspectContext {
  const evidence = buildEvidenceSnippets(business);
  const evidenceIds = new Set(evidence.map((snippet) => snippet.id));
  const generatedClaims = downgradeUnsupportedClaims(buildGeneratedClaims(business, evidenceIds));

  return ProspectContextSchema.parse({
    version: PROSPECT_CONTEXT_VERSION,
    businessId: business.id,
    businessName: business.name,
    category: business.category,
    generatedAt: business.aiEnrichedAt ?? null,
    depth: business.aiDepth === "deep" ? "deep" : business.aiDepth === "standard" ? "standard" : "deterministic",
    evidence,
    services: [],
    contactSignals: buildContactSignals(business, evidenceIds),
    bookingSignals: buildBookingSignals(business, evidenceIds),
    openingHoursSignals: [],
    painHypotheses: buildPainHypotheses(business, evidenceIds),
    generatedClaims,
  });
}

export function downgradeUnsupportedClaims<T extends GeneratedClaim>(claims: T[]): T[] {
  return claims.map((claim) =>
    claim.evidenceIds.length > 0
      ? claim
      : {
          ...claim,
          confidence: "unsupported",
        },
  );
}

export function isPromotableConfidence(confidence: ClaimConfidence): boolean {
  return confidence === "supported" || confidence === "inferred";
}

export function getPromotableClaims(claims: GeneratedClaim[]): GeneratedClaim[] {
  return claims.filter((claim) => isPromotableConfidence(claim.confidence) && claim.evidenceIds.length > 0);
}

export function formatConfidenceLabel(confidence: ClaimConfidence): string {
  if (confidence === "supported") return "Supported";
  if (confidence === "inferred") return "Inferred";
  if (confidence === "weak") return "Weak signal";
  return "Unsupported";
}

function buildEvidenceSnippets(business: Business): EvidenceSnippet[] {
  const snippets: EvidenceSnippet[] = [
    {
      id: evidenceId("places", "identity"),
      sourceType: "places",
      sourceLabel: "Google Places business record",
      text: `${business.name} is stored as a ${CATEGORY_META[business.category].label} prospect in ${business.borough}.`,
    },
    {
      id: evidenceId("places", "address"),
      sourceType: "places",
      sourceLabel: "Google Places address",
      text: `Address: ${business.address}.`,
    },
    {
      id: evidenceId("category", business.category),
      sourceType: "category_meta",
      sourceLabel: "Product category metadata",
      text: `${CATEGORY_META[business.category].label}: ${CATEGORY_META[business.category].useCase}`,
    },
    {
      id: evidenceId("scoring", "score"),
      sourceType: "scoring",
      sourceLabel: "Voice AI fit scoring",
      text: `Voice AI fit score is ${business.voiceAiScore}/9. Score breakdown: ${formatScoreBreakdown(business.scoreBreakdown)}.`,
    },
  ];

  if (business.phone) {
    snippets.push({
      id: evidenceId("places", "phone"),
      sourceType: "places",
      sourceLabel: "Google Places phone",
      text: `Phone: ${business.phone}.`,
    });
  } else if (!business.hasVisiblePhone) {
    snippets.push({
      id: evidenceId("scoring", "missing-phone"),
      sourceType: "scoring",
      sourceLabel: "Phone visibility heuristic",
      text: "No stored public phone signal was detected in the available business data.",
    });
  }

  if (business.website) {
    snippets.push({
      id: evidenceId("places", "website"),
      sourceType: "places",
      sourceLabel: "Google Places website",
      text: `Website: ${business.website}.`,
      url: normalizeHttpUrl(business.website),
    });
  } else if (!business.hasWebsite) {
    snippets.push({
      id: evidenceId("scoring", "missing-website"),
      sourceType: "scoring",
      sourceLabel: "Website visibility heuristic",
      text: "No stored website signal was detected in the available business data.",
    });
  }

  if (typeof business.rating === "number") {
    snippets.push({
      id: evidenceId("places", "rating"),
      sourceType: "places",
      sourceLabel: "Google Places rating",
      text: `Google rating: ${business.rating}.`,
    });
  }

  if (typeof business.reviewCount === "number") {
    snippets.push({
      id: evidenceId("places", "review-count"),
      sourceType: "places",
      sourceLabel: "Google Places review count",
      text: `Google review count: ${business.reviewCount}.`,
    });
  }

  if (business.hasOnlineBooking) {
    const token = findBookingToken(business.website);
    snippets.push({
      id: evidenceId("scoring", "online-booking"),
      sourceType: "scoring",
      sourceLabel: "Online booking heuristic",
      text: token
        ? `A booking-related token ("${token}") was detected in the stored website URL.`
        : "The existing business record is flagged with an online booking signal, but no source snippet is stored yet.",
    });
  } else {
    snippets.push({
      id: evidenceId("scoring", "no-obvious-online-booking"),
      sourceType: "scoring",
      sourceLabel: "Online booking heuristic",
      text: "No obvious online booking signal was detected from the available public data.",
    });
  }

  if (business.reviewPainSignals.length > 0) {
    snippets.push({
      id: evidenceId("scoring", "review-pain-signals"),
      sourceType: "scoring",
      sourceLabel: "Review and demand proxy signals",
      text: `Stored pain hypothesis signals: ${business.reviewPainSignals.join("; ")}.`,
    });
  }

  return snippets;
}

function buildContactSignals(business: Business, evidenceIds: Set<string>): ContactSignal[] {
  const signals: ContactSignal[] = [];

  if (business.phone && evidenceIds.has(evidenceId("places", "phone"))) {
    signals.push({
      type: "phone",
      label: "Public phone number is available in the business record.",
      value: business.phone,
      confidence: "supported",
      evidenceIds: [evidenceId("places", "phone")],
    });
  } else {
    signals.push({
      type: "no_phone_signal_detected",
      label: "No stored public phone signal was detected in the available data.",
      confidence: "weak",
      evidenceIds: evidenceIds.has(evidenceId("scoring", "missing-phone")) ? [evidenceId("scoring", "missing-phone")] : [],
    });
  }

  if (business.website && evidenceIds.has(evidenceId("places", "website"))) {
    signals.push({
      type: "website",
      label: "Public website URL is available in the business record.",
      value: business.website,
      confidence: "supported",
      evidenceIds: [evidenceId("places", "website")],
    });
  } else {
    signals.push({
      type: "no_website_signal_detected",
      label: "No stored website signal was detected in the available data.",
      confidence: "weak",
      evidenceIds: evidenceIds.has(evidenceId("scoring", "missing-website")) ? [evidenceId("scoring", "missing-website")] : [],
    });
  }

  return signals;
}

function buildBookingSignals(business: Business, evidenceIds: Set<string>): BookingSignal[] {
  const sourceIds = [
    evidenceId("scoring", "online-booking"),
    evidenceId("places", "website"),
  ].filter((id) => evidenceIds.has(id));

  if (business.hasOnlineBooking) {
    const token = findBookingToken(business.website);
    return [
      {
        type: token ? "booking_url_token" : "booking_signal_detected",
        label: token
          ? `Booking-related URL token detected: "${token}".`
          : "Online booking signal detected by the existing public-data heuristic.",
        value: token,
        confidence: "inferred",
        evidenceIds: sourceIds,
      },
    ];
  }

  return [
    {
      type: "no_obvious_booking_signal",
      label: "No obvious online booking signal was detected from the available public data.",
      confidence: "weak",
      evidenceIds: [evidenceId("scoring", "no-obvious-online-booking"), evidenceId("places", "website")].filter((id) =>
        evidenceIds.has(id),
      ),
    },
  ];
}

function buildPainHypotheses(business: Business, evidenceIds: Set<string>): PainHypothesisSignal[] {
  const hypotheses: PainHypothesisSignal[] = [
    {
      label: CATEGORY_META[business.category].copy.missedCallPain,
      basis: "category_heuristic",
      confidence: "inferred",
      evidenceIds: [evidenceId("category", business.category)].filter((id) => evidenceIds.has(id)),
    },
  ];

  if (business.voiceAiScore >= 7) {
    hypotheses.push({
      label: "The score suggests this prospect is worth human review, but the underlying workflow still needs validation.",
      basis: "score_heuristic",
      confidence: "inferred",
      evidenceIds: [evidenceId("scoring", "score")].filter((id) => evidenceIds.has(id)),
    });
  }

  if ((business.reviewCount ?? 0) >= 100) {
    hypotheses.push({
      label: "High review volume is a demand proxy; it does not prove missed-call or front-desk pain.",
      basis: "review_count_proxy",
      confidence: "weak",
      evidenceIds: [evidenceId("places", "review-count")].filter((id) => evidenceIds.has(id)),
    });
  }

  if (typeof business.rating === "number" && business.rating < 4.3) {
    hypotheses.push({
      label: "Lower rating may indicate service or responsiveness friction, but the specific cause is not known.",
      basis: "rating_proxy",
      confidence: "weak",
      evidenceIds: [evidenceId("places", "rating")].filter((id) => evidenceIds.has(id)),
    });
  }

  for (const signal of business.reviewPainSignals) {
    hypotheses.push({
      label: `${signal}. Treat as a hypothesis unless backed by actual review text or website evidence.`,
      basis: "stored_review_signal",
      confidence: "weak",
      evidenceIds: [evidenceId("scoring", "review-pain-signals")].filter((id) => evidenceIds.has(id)),
    });
  }

  return hypotheses;
}

function buildGeneratedClaims(business: Business, evidenceIds: Set<string>): GeneratedClaim[] {
  const coreEvidenceIds = [
    evidenceId("places", "identity"),
    evidenceId("places", "address"),
    evidenceId("category", business.category),
    evidenceId("scoring", "score"),
  ].filter((id) => evidenceIds.has(id));

  const claims: GeneratedClaim[] = [
    {
      id: generatedClaimId("score"),
      kind: "score",
      text: `${business.name} is scored ${business.voiceAiScore}/9 for Voice AI fit by the existing scoring rubric.`,
      confidence: "inferred",
      evidenceIds: [evidenceId("scoring", "score")].filter((id) => evidenceIds.has(id)),
    },
    {
      id: generatedClaimId("reasoning"),
      kind: "reasoning",
      text: business.reasoning,
      confidence: "inferred",
      evidenceIds: coreEvidenceIds,
    },
  ];

  if (business.aiSummary) {
    claims.push({
      id: generatedClaimId("ai-summary"),
      kind: "ai_summary",
      text: business.aiSummary,
      confidence: "inferred",
      evidenceIds: coreEvidenceIds,
    });
  }

  if (business.aiAngle) {
    claims.push({
      id: generatedClaimId("ai-angle"),
      kind: "ai_angle",
      text: business.aiAngle,
      confidence: "inferred",
      evidenceIds: coreEvidenceIds,
    });
  }

  if (business.aiCategory) {
    claims.push({
      id: generatedClaimId("ai-category"),
      kind: "ai_category",
      text: `AI category read: ${business.aiCategory}.`,
      confidence: "inferred",
      evidenceIds: [evidenceId("places", "identity"), evidenceId("category", business.category)].filter((id) => evidenceIds.has(id)),
    });
  }

  return claims;
}

function evidenceId(source: string, name: string): string {
  return `${source}:${slugify(name)}`;
}

function generatedClaimId(name: string): string {
  return `claim:${slugify(name)}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatScoreBreakdown(breakdown: ScoreBreakdown): string {
  return Object.entries(breakdown)
    .map(([key, value]) => `${key} ${value >= 0 ? "+" : ""}${value}`)
    .join(", ");
}

function findBookingToken(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.toLowerCase();
  return bookingTokens.find((token) => normalized.includes(token));
}

function normalizeHttpUrl(value: string): string | undefined {
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
