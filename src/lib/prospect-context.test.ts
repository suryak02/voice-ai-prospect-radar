import { describe, expect, it } from "vitest";
import {
  ProspectContextSchema,
  buildProspectContextFromBusiness,
  downgradeUnsupportedClaims,
  formatConfidenceLabel,
  getPromotableClaims,
  isPromotableConfidence,
  type GeneratedClaim,
} from "./prospect-context";
import type { Business } from "./types";

function prospect(overrides: Partial<Business> = {}): Business {
  return {
    id: "prospect-1",
    googlePlaceId: "places-1",
    name: "Platinum Dental Care",
    category: "dental",
    address: "1 Canary Wharf, London",
    borough: "London",
    latitude: 51.5,
    longitude: -0.1,
    phone: "+44 20 7000 1101",
    website: "https://platinumdental.example.com",
    rating: 4.7,
    reviewCount: 420,
    hasWebsite: true,
    hasOnlineBooking: false,
    hasVisiblePhone: true,
    appointmentBased: true,
    highValueService: true,
    reviewPainSignals: ["high review volume suggests meaningful inbound demand"],
    voiceAiScore: 9,
    scoreBreakdown: {
      categoryFit: 2,
      callDependency: 2,
      schedulingComplexity: 2,
      websiteFriction: 1,
      reviewPain: 0.5,
      businessValue: 2,
      confidencePenalty: 0,
    },
    recommendedUseCase: "AI receptionist for appointment booking and missed calls.",
    reasoning: "Strong appointment-led fit from public signals.",
    aiSummary: "This looks like a strong fit because the practice has visible demand and a phone-led booking path.",
    aiAngle: "Ask how they handle missed new-patient calls while reception is busy.",
    aiCategory: "dental",
    aiDepth: "standard",
    aiEnrichedAt: "2026-06-09T09:00:00.000Z",
    status: "needs_review",
    ...overrides,
  };
}

describe("buildProspectContextFromBusiness", () => {
  it("marks direct phone, website, rating, and review-count facts as supported evidence", () => {
    const context = buildProspectContextFromBusiness(prospect());

    expect(context.contactSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "phone", confidence: "supported", value: "+44 20 7000 1101" }),
        expect.objectContaining({ type: "website", confidence: "supported", value: "https://platinumdental.example.com" }),
      ]),
    );
    expect(context.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "places:rating", sourceType: "places", text: "Google rating: 4.7." }),
        expect.objectContaining({ id: "places:review-count", sourceType: "places", text: "Google review count: 420." }),
      ]),
    );
  });

  it("creates weak missing-signal entries when phone and website are absent", () => {
    const context = buildProspectContextFromBusiness(
      prospect({
        phone: undefined,
        website: undefined,
        hasVisiblePhone: false,
        hasWebsite: false,
      }),
    );

    expect(context.contactSignals).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "no_phone_signal_detected", confidence: "weak" }),
        expect.objectContaining({ type: "no_website_signal_detected", confidence: "weak" }),
      ]),
    );
  });

  it("phrases absent booking data as no obvious signal detected", () => {
    const context = buildProspectContextFromBusiness(prospect({ hasOnlineBooking: false }));
    const [bookingSignal] = context.bookingSignals;

    expect(bookingSignal).toMatchObject({
      type: "no_obvious_booking_signal",
      confidence: "weak",
      label: "No obvious online booking signal was detected from the available public data.",
    });
    expect(bookingSignal.label.toLowerCase()).not.toContain("no online booking exists");
  });

  it("does not mark review proxy pain hypotheses as supported", () => {
    const context = buildProspectContextFromBusiness(prospect());
    const reviewProxySignals = context.painHypotheses.filter((signal) =>
      signal.basis === "review_count_proxy" || signal.basis === "stored_review_signal",
    );

    expect(reviewProxySignals.length).toBeGreaterThan(0);
    expect(reviewProxySignals.every((signal) => signal.confidence !== "supported")).toBe(true);
    expect(reviewProxySignals.map((signal) => signal.confidence)).toContain("weak");
  });

  it("passes the exported schema validation", () => {
    const context = buildProspectContextFromBusiness(prospect());

    expect(() => ProspectContextSchema.parse(context)).not.toThrow();
  });
});

describe("prospect context claim helpers", () => {
  it("downgrades generated claims without evidence IDs to unsupported", () => {
    const claims: GeneratedClaim[] = [
      {
        id: "claim:no-evidence",
        kind: "ai_summary",
        text: "This generated claim has no evidence.",
        confidence: "inferred",
        evidenceIds: [],
      },
    ];

    expect(downgradeUnsupportedClaims(claims)[0]).toMatchObject({
      confidence: "unsupported",
      evidenceIds: [],
    });
  });

  it("returns only claims with promotable confidence and evidence", () => {
    const claims = downgradeUnsupportedClaims([
      {
        id: "claim:supported",
        kind: "score",
        text: "Supported claim.",
        confidence: "supported",
        evidenceIds: ["places:phone"],
      },
      {
        id: "claim:weak",
        kind: "reasoning",
        text: "Weak claim.",
        confidence: "weak",
        evidenceIds: ["scoring:score"],
      },
      {
        id: "claim:no-evidence",
        kind: "ai_angle",
        text: "No evidence claim.",
        confidence: "inferred",
        evidenceIds: [],
      },
    ]);

    expect(getPromotableClaims(claims).map((claim) => claim.id)).toEqual(["claim:supported"]);
    expect(isPromotableConfidence("inferred")).toBe(true);
    expect(isPromotableConfidence("weak")).toBe(false);
    expect(formatConfidenceLabel("weak")).toBe("Weak signal");
  });
});
