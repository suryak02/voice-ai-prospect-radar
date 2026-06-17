import { describe, expect, it } from "vitest";
import {
  ReceptionistSandboxBriefSchema,
  buildReceptionistSandboxBrief,
  type ReceptionistSandboxBrief,
} from "./receptionist-sandbox-brief";
import { buildProspectContextFromBusiness } from "./prospect-context";
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
    recommendedUseCase: "AI receptionist for appointment booking and missed-call cover.",
    reasoning: "Strong appointment-led fit from public signals.",
    aiSummary: "Deep research found service pages for private and NHS dental appointments.",
    aiAngle: "Frame the call around polite enquiry capture and appointment routing.",
    aiCategory: "dental",
    aiDepth: "deep",
    aiEnrichedAt: "2026-06-09T09:00:00.000Z",
    status: "needs_review",
    ...overrides,
  };
}

function briefFor(business: Business = prospect()): ReceptionistSandboxBrief {
  return buildReceptionistSandboxBrief(business, buildProspectContextFromBusiness(business));
}

describe("buildReceptionistSandboxBrief", () => {
  it("generates a sandbox brief from a deep-enriched business", () => {
    const brief = briefFor();

    expect(brief.business).toMatchObject({
      id: "prospect-1",
      name: "Platinum Dental Care",
      category: "dental",
      address: "1 Canary Wharf, London",
    });
    expect(brief.aiContext).toMatchObject({
      depth: "deep",
      summary: "Deep research found service pages for private and NHS dental appointments.",
      angle: "Frame the call around polite enquiry capture and appointment routing.",
    });
    expect(brief.publicSignals).toMatchObject({
      phone: "+44 20 7000 1101",
      website: "https://platinumdental.example.com",
      rating: 4.7,
      reviewCount: 420,
      hasWebsite: true,
      hasVisiblePhone: true,
      hasOnlineBooking: false,
    });
    expect(brief.voiceAiFit.scoreBreakdown.categoryFit).toBe(2);
    expect(brief.prospectContext.available).toBe(true);
    expect(brief.prospectContext.depth).toBe("deep");
    expect(brief.prospectContext.claims.length).toBeGreaterThan(0);
    expect(brief.prospectContext.evidence.length).toBeGreaterThan(0);
  });

  it("uses careful booking wording when no obvious booking signal is detected", () => {
    const brief = briefFor(prospect({ hasOnlineBooking: false }));
    const wording = `${brief.publicSignals.bookingSignalWording} ${brief.guardrails.bookingWording}`.toLowerCase();

    expect(brief.publicSignals.bookingSignal).toBe("no_obvious_online_booking_signal_detected");
    expect(wording).toContain("no obvious online booking signal");
    expect(wording).toContain("does not prove");
    expect(wording).not.toContain("no online booking exists");
    expect(wording).not.toContain("does not have online booking");
  });

  it("keeps guardrails and unknowns explicit", () => {
    const brief = briefFor();

    expect(brief.guardrails.unknowns).toEqual(
      expect.arrayContaining([
        "Actual call volume is unknown.",
        "Missed-call volume is unknown.",
        "Front-desk staffing levels and workload are unknown.",
        "Revenue impact is unknown.",
      ]),
    );
    expect(brief.guardrails.prohibitedClaims.join(" ")).toContain("staff overload");
    expect(brief.guardrails.prohibitedClaims.join(" ")).toContain("lost revenue");
    expect(brief.publicSignals.reviewProxyHypotheses[0]).toContain("not a verified customer complaint");
  });

  it("passes schema validation", () => {
    const brief = briefFor();

    expect(() => ReceptionistSandboxBriefSchema.parse(brief)).not.toThrow();
  });

  it("generates scenario seeds for the separate Scenario Lab", () => {
    const brief = briefFor();

    expect(brief.scenarioSeeds.map((seed) => seed.id)).toEqual([
      "new-service-enquiry",
      "booking-route-clarification",
      "contact-and-location-question",
    ]);
    expect(brief.scenarioSeeds[0].contextForAgent.join(" ")).toContain("Platinum Dental Care");
    expect(brief.scenarioSeeds[1].guardrailNotes.join(" ")).toContain("No obvious online booking signal");
    expect(brief.scenarioSeeds.every((seed) => seed.guardrailNotes.join(" ").includes("Do not infer call volume"))).toBe(true);
  });
});
