import { describe, expect, it } from "vitest";
import { isInUk, UK_BOUNDS } from "./uk-bounds";

describe("UK search bounding box", () => {
  it.each([
    ["London", 51.5074, -0.1278],
    ["Cardiff", 51.4816, -3.1791],
    ["Edinburgh", 55.9533, -3.1883],
    ["Belfast", 54.5973, -5.9301],
    ["Lerwick", 60.155, -1.145],
  ])("keeps %s inside the supported search area", (_place, latitude, longitude) => {
    expect(isInUk(latitude, longitude)).toBe(true);
  });

  it("includes all four boundary corners", () => {
    for (const latitude of [UK_BOUNDS.minLat, UK_BOUNDS.maxLat]) {
      for (const longitude of [UK_BOUNDS.minLng, UK_BOUNDS.maxLng]) {
        expect(isInUk(latitude, longitude)).toBe(true);
      }
    }
  });

  it("rejects coordinates immediately outside each edge", () => {
    expect(isInUk(UK_BOUNDS.minLat - 0.001, -1)).toBe(false);
    expect(isInUk(UK_BOUNDS.maxLat + 0.001, -1)).toBe(false);
    expect(isInUk(55, UK_BOUNDS.minLng - 0.001)).toBe(false);
    expect(isInUk(55, UK_BOUNDS.maxLng + 0.001)).toBe(false);
  });

  it("rejects overseas namesakes and swapped latitude/longitude", () => {
    expect(isInUk(42.9956, -71.4548)).toBe(false); // Manchester, New Hampshire
    expect(isInUk(-0.1278, 51.5074)).toBe(false);
  });

  it("rejects non-finite coordinates on either axis", () => {
    for (const coordinate of [Number.NaN, Infinity, -Infinity]) {
      expect(isInUk(coordinate, -1)).toBe(false);
      expect(isInUk(55, coordinate)).toBe(false);
    }
  });
});
