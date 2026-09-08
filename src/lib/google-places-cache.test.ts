import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveProspectSearchInput } from "./google-places";

// Exercise the real in-memory cache without reaching an external Redis service.
vi.mock("./redis", () => ({ getRedis: () => null }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("GOOGLE_MAPS_API_KEY", "test-key");
  vi.stubEnv("PLACES_SEARCH_PAGE_LIMIT", "1");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function placesResponse(id: string) {
  return Response.json({
    places: [{
      id,
      displayName: { text: "Example Plumbing" },
      location: { latitude: 51.5, longitude: -0.1 },
      businessStatus: "OPERATIONAL",
      types: ["plumber"],
    }],
  });
}

const searchInput: LiveProspectSearchInput = { area: "London", categories: ["plumber"] };

describe("live-search result caching", () => {
  it("reuses successful results across normalized areas and reordered categories", async () => {
    const { searchGooglePlacesProspects } = await import("./google-places");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(placesResponse("plumber-1"))
      .mockResolvedValueOnce(placesResponse("dental-1"));
    vi.stubGlobal("fetch", fetchMock);

    const first = await searchGooglePlacesProspects({ area: "  East   London ", categories: ["plumber", "dental"] });
    const second = await searchGooglePlacesProspects({ area: "east london", categories: ["dental", "plumber"] });

    expect(first).toMatchObject({ cached: false, errors: [] });
    expect(first.businesses).toHaveLength(2);
    expect(second).toEqual({ businesses: first.businesses, cached: true, errors: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries an empty search instead of caching the empty result", async () => {
    const { searchGooglePlacesProspects } = await import("./google-places");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ places: [] }))
      .mockResolvedValueOnce(placesResponse("recovered-1"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await searchGooglePlacesProspects(searchInput)).toEqual({ businesses: [], cached: false, errors: [] });
    const retried = await searchGooglePlacesProspects(searchInput);

    expect(retried).toMatchObject({ cached: false, errors: [] });
    expect(retried.businesses).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a failed search instead of caching the provider failure", async () => {
    const { searchGooglePlacesProspects } = await import("./google-places");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: "Temporarily unavailable." }, { status: 503 }))
      .mockResolvedValueOnce(placesResponse("recovered-1"));
    vi.stubGlobal("fetch", fetchMock);

    expect(await searchGooglePlacesProspects(searchInput)).toEqual({
      businesses: [], cached: false, errors: ["plumber: Temporarily unavailable."],
    });
    const retried = await searchGooglePlacesProspects(searchInput);

    expect(retried).toMatchObject({ cached: false, errors: [] });
    expect(retried.businesses).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not cache partial success and hide a failed category on retry", async () => {
    const { searchGooglePlacesProspects } = await import("./google-places");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(placesResponse("plumber-1"))
      .mockResolvedValueOnce(Response.json({ error: "Temporarily unavailable." }, { status: 503 }))
      .mockResolvedValueOnce(placesResponse("plumber-1"))
      .mockResolvedValueOnce(placesResponse("dental-1"));
    vi.stubGlobal("fetch", fetchMock);
    const request: LiveProspectSearchInput = { area: "London", categories: ["plumber", "dental"] };

    const partial = await searchGooglePlacesProspects(request);
    expect(partial.businesses).toHaveLength(1);
    expect(partial.errors).toEqual(["dental: Temporarily unavailable."]);

    const retried = await searchGooglePlacesProspects(request);
    expect(retried).toMatchObject({ cached: false, errors: [] });
    expect(retried.businesses).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
