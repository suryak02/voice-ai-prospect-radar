import { describe, expect, it } from "vitest";
import {
  CATEGORY_META,
  getCategoryLabel,
  getCategoryOptionGroups,
  inferCategoryFromText,
  isCategorySelectionDisabled,
  MAX_LIVE_SEARCH_CATEGORIES,
} from "./categories";

describe("category metadata", () => {
  it("exposes hotels as a first-class hospitality filter", () => {
    expect(CATEGORY_META.hotel).toMatchObject({
      label: "Hotels",
      group: "Hospitality & guest services",
      appointmentBased: true,
      highValueService: true,
      fitTier: "high",
    });

    expect(getCategoryOptionGroups()).toContainEqual({
      group: "Hospitality & guest services",
      options: [{ value: "hotel", label: "Hotels" }],
    });
  });

  it("classifies hotel-like Google Places text as hotels", () => {
    expect(inferCategoryFromText("lodging boutique hotel room reservations", "other")).toBe("hotel");
    expect(inferCategoryFromText("guest house bed and breakfast reception", "other")).toBe("hotel");
  });

  it("keeps selected categories removable when the live-search limit is reached", () => {
    const selected = ["dental", "aesthetics", "veterinary", "physiotherapy", "chiropractor", "optometry"] as const;

    expect(selected).toHaveLength(MAX_LIVE_SEARCH_CATEGORIES);
    expect(isCategorySelectionDisabled(selected, "hotel")).toBe(true);
    expect(isCategorySelectionDisabled(selected, "dental")).toBe(false);
    expect(isCategorySelectionDisabled(selected.slice(0, -1), "hotel")).toBe(false);
  });

  it("returns curated display labels for category badges", () => {
    expect(getCategoryLabel("optometry")).toBe("Opticians / Optometry");
    expect(getCategoryLabel("auto_repair")).toBe("Auto repair / Garage");
  });
});
