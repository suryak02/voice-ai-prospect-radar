import { describe, expect, it } from "vitest";
import { CATEGORY_META, getCategoryOptionGroups, inferCategoryFromText } from "./categories";

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
});
