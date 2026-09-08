import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockBusinesses } from "../mock-businesses";

const mocks = vi.hoisted(() => ({
  getEnvValue: vi.fn(),
  findMany: vi.fn(),
}));

// Keep saved-map regression tests offline; never instantiate a real DB client.
vi.mock("../env", () => ({ getEnvValue: mocks.getEnvValue }));
vi.mock("../prisma", () => ({ prisma: { business: { findMany: mocks.findMany } } }));

beforeEach(() => {
  vi.resetModules();
  mocks.getEnvValue.mockReset();
  mocks.findMany.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function storedBusiness(overrides: Record<string, unknown> = {}) {
  return {
    ...mockBusinesses[0],
    googlePlaceId: null,
    phone: null,
    website: null,
    rating: null,
    reviewCount: null,
    aiSummary: null,
    aiAngle: null,
    aiCategory: null,
    aiModel: null,
    aiDepth: null,
    aiEnrichedAt: null,
    ...overrides,
  };
}

describe("saved prospect loading", () => {
  it("uses the demo dataset without querying a database when none is configured", async () => {
    const { getBusinesses } = await import("./businesses");

    expect(await getBusinesses()).toEqual(mockBusinesses);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it("maps nullable database fields while preserving zero-valued public signals", async () => {
    mocks.getEnvValue.mockReturnValue("configured");
    mocks.findMany.mockResolvedValue([
      storedBusiness(),
      storedBusiness({ id: "zero-signals", rating: 0, reviewCount: 0, aiEnrichedAt: new Date("2026-06-09T09:00:00.000Z") }),
    ]);
    const { getBusinesses } = await import("./businesses");
    const businesses = await getBusinesses();

    expect(mocks.findMany).toHaveBeenCalledExactlyOnceWith({
      orderBy: [{ voiceAiScore: "desc" }, { name: "asc" }],
    });
    expect(businesses).toHaveLength(2);
    expect(businesses[0]).toEqual({
      ...storedBusiness(),
      googlePlaceId: undefined,
      phone: undefined,
      website: undefined,
      rating: undefined,
      reviewCount: undefined,
      aiSummary: undefined,
      aiAngle: undefined,
      aiCategory: undefined,
      aiModel: undefined,
      aiDepth: undefined,
      aiEnrichedAt: undefined,
    });
    expect(businesses[1]).toMatchObject({ rating: 0, reviewCount: 0, aiEnrichedAt: "2026-06-09T09:00:00.000Z" });
  });

  it("keeps UK prospects in database order and excludes overseas or invalid coordinates", async () => {
    mocks.getEnvValue.mockReturnValue("configured");
    mocks.findMany.mockResolvedValue([
      storedBusiness({ id: "belfast", latitude: 54.597, longitude: -5.93 }),
      storedBusiness({ id: "manchester-us", latitude: 42.9956, longitude: -71.4548 }),
      storedBusiness({ id: "invalid", latitude: Number.NaN, longitude: -0.1 }),
      storedBusiness({ id: "london", latitude: 51.5, longitude: -0.1 }),
    ]);
    const { getBusinesses } = await import("./businesses");

    expect((await getBusinesses()).map((business) => business.id)).toEqual(["belfast", "london"]);
  });

  it("keeps a successfully loaded empty database empty instead of inventing saved prospects", async () => {
    mocks.getEnvValue.mockReturnValue("configured");
    mocks.findMany.mockResolvedValue([]);
    const { getBusinesses } = await import("./businesses");

    expect(await getBusinesses()).toEqual([]);
  });

  it("falls back to the demo dataset and reports a database read failure", async () => {
    mocks.getEnvValue.mockReturnValue("configured");
    const error = new Error("Database unavailable");
    mocks.findMany.mockRejectedValue(error);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { getBusinesses } = await import("./businesses");

    expect(await getBusinesses()).toEqual(mockBusinesses);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("Falling back to mock seed data"), error);
  });
});
