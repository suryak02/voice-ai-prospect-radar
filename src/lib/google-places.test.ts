import { afterEach, describe, expect, it, vi } from "vitest";
import { searchGooglePlacesProspects } from "./google-places";

const originalGoogleMapsKey = process.env.GOOGLE_MAPS_API_KEY;
const originalGooglePlacesKey = process.env.GOOGLE_PLACES_API_KEY;
const originalPageLimit = process.env.PLACES_SEARCH_PAGE_LIMIT;

afterEach(() => {
  restoreEnv("GOOGLE_MAPS_API_KEY", originalGoogleMapsKey);
  restoreEnv("GOOGLE_PLACES_API_KEY", originalGooglePlacesKey);
  restoreEnv("PLACES_SEARCH_PAGE_LIMIT", originalPageLimit);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("searchGooglePlacesProspects", () => {
  it("requests and follows Google Places pagination tokens", async () => {
    process.env.GOOGLE_MAPS_API_KEY = " test-key ";
    process.env.PLACES_SEARCH_PAGE_LIMIT = "2";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        places: [place("place-1", "Alpha Plumbing")],
        nextPageToken: "token-page-2",
      }))
      .mockResolvedValueOnce(jsonResponse({
        places: [place("place-2", "Beta Plumbing")],
      }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await searchGooglePlacesProspects({
      area: "Pagination Test Town A",
      categories: ["plumber"],
    });

    expect(result.businesses).toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      "X-Goog-FieldMask": expect.stringContaining("nextPageToken"),
    });
    expect(requestBody(fetchMock, 0)).toMatchObject({
      textQuery: "plumber in Pagination Test Town A",
      maxResultCount: 20,
      regionCode: "GB",
    });
    expect(requestBody(fetchMock, 1)).toMatchObject({
      textQuery: "plumber in Pagination Test Town A",
      pageToken: "token-page-2",
    });
  });

  it("caps live search pagination at three pages per vertical", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    process.env.PLACES_SEARCH_PAGE_LIMIT = "99";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ places: [place("place-3", "Gamma Plumbing")], nextPageToken: "token-page-2" }))
      .mockResolvedValueOnce(jsonResponse({ places: [place("place-4", "Delta Plumbing")], nextPageToken: "token-page-3" }))
      .mockResolvedValueOnce(jsonResponse({ places: [place("place-5", "Epsilon Plumbing")], nextPageToken: "token-page-4" }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await searchGooglePlacesProspects({
      area: "Pagination Test Town B",
      categories: ["plumber"],
    });

    expect(result.businesses).toHaveLength(3);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("reports failed Google Places responses without aborting other verticals", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(textResponse({ error: { message: "Daily Places quota exceeded." } }, { ok: false, status: 429 }))
      .mockResolvedValueOnce(jsonResponse({ places: [place("place-6", "Zeta Dental")] }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await searchGooglePlacesProspects({
      area: "Provider Error Test Town",
      categories: ["plumber", "dental"],
    });

    expect(result.businesses).toHaveLength(1);
    expect(result.errors).toEqual(["plumber: Daily Places quota exceeded."]);
  });
});

function jsonResponse(body: unknown): Response {
  return textResponse(body);
}

function textResponse(body: unknown, init: { ok?: boolean; status?: number; statusText?: string } = {}): Response {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    text: async () => JSON.stringify(body),
  } as Response;
}

function place(id: string, name: string) {
  return {
    id,
    displayName: { text: name },
    formattedAddress: "1 High Street, London, UK",
    location: { latitude: 51.5, longitude: -0.1 },
    rating: 4.6,
    userRatingCount: 80,
    nationalPhoneNumber: "020 7000 0000",
    websiteUri: `https://${id}.example.com`,
    businessStatus: "OPERATIONAL",
    types: ["plumber"],
  };
}

function requestBody(fetchMock: ReturnType<typeof vi.fn>, callIndex: number) {
  return JSON.parse(String(fetchMock.mock.calls[callIndex][1]?.body));
}

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
