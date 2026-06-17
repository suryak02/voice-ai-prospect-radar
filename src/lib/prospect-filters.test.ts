import { describe, expect, it } from "vitest";
import {
  businessMatchesProspectQuery,
  filterProspects,
  hasActiveProspectFilters,
  resolveSelectedProspect,
  resolveSelectionAfterFilterReset,
} from "./prospect-filters";
import type { Business } from "./types";

function prospect(overrides: Partial<Business>): Business {
  return {
    id: "prospect-1",
    name: "Platinum Dental Care",
    category: "dental",
    address: "1 Canary Wharf, London",
    borough: "London",
    latitude: 51.5,
    longitude: -0.1,
    hasWebsite: true,
    hasOnlineBooking: false,
    hasVisiblePhone: true,
    appointmentBased: true,
    highValueService: true,
    reviewPainSignals: ["hard to book appointments"],
    voiceAiScore: 9,
    scoreBreakdown: {
      categoryFit: 2,
      callDependency: 2,
      schedulingComplexity: 2,
      websiteFriction: 1,
      reviewPain: 1,
      businessValue: 1,
      confidencePenalty: 0,
    },
    recommendedUseCase: "After-hours appointment triage",
    reasoning: "Strong appointment-led fit.",
    status: "new",
    ...overrides,
  };
}

describe("prospect filters", () => {
  const businesses = [
    prospect({ id: "dental-1", name: "Platinum Dental Care", category: "dental", voiceAiScore: 9 }),
    prospect({
      id: "legal-1",
      name: "Clifford Chance London",
      category: "legal",
      address: "10 Upper Bank Street, London",
      reviewPainSignals: ["urgent intake calls"],
      recommendedUseCase: "Matter intake routing",
      voiceAiScore: 8,
    }),
    prospect({
      id: "retail-1",
      name: "Corner Retail",
      category: "retail",
      borough: "Bristol",
      reviewPainSignals: [],
      recommendedUseCase: "Basic enquiry handling",
      voiceAiScore: 2,
    }),
  ];

  it("matches text across names, places, vertical labels, use cases, and review signals", () => {
    expect(businessMatchesProspectQuery(businesses[1], "clifford")).toBe(true);
    expect(businessMatchesProspectQuery(businesses[1], "legal")).toBe(true);
    expect(businessMatchesProspectQuery(businesses[1], "matter intake")).toBe(true);
    expect(businessMatchesProspectQuery(businesses[1], "urgent intake")).toBe(true);
    expect(businessMatchesProspectQuery(businesses[1], "manchester")).toBe(false);
  });

  it("combines text, vertical, and minimum score filters", () => {
    expect(
      filterProspects(businesses, {
        query: "london",
        categoryFilter: "legal",
        minimumScore: 7,
      }).map((business) => business.id),
    ).toEqual(["legal-1"]);

    expect(
      filterProspects(businesses, {
        query: "",
        categoryFilter: "all",
        minimumScore: 9,
      }).map((business) => business.id),
    ).toEqual(["dental-1"]);
  });

  it("does not keep a stale selected prospect when active filters have zero matches", () => {
    const filters = { query: "no matching prospect", categoryFilter: "all" as const, minimumScore: 0 };
    const filteredBusinesses = filterProspects(businesses, filters);

    expect(hasActiveProspectFilters(filters)).toBe(true);
    expect(
      resolveSelectedProspect({
        businesses,
        filteredBusinesses,
        selectedBusinessId: "legal-1",
        hasActiveFilters: true,
      }),
    ).toBeUndefined();
  });

  it("falls back to the full dataset only when filters are inactive", () => {
    expect(
      resolveSelectedProspect({
        businesses,
        filteredBusinesses: [],
        selectedBusinessId: "legal-1",
        hasActiveFilters: false,
      })?.id,
    ).toBe("legal-1");
  });

  it("preserves the current selection after clearing filters when the prospect still exists", () => {
    expect(resolveSelectionAfterFilterReset(businesses, "legal-1")).toBe("legal-1");
    expect(resolveSelectionAfterFilterReset(businesses, "missing")).toBe("dental-1");
  });
});
