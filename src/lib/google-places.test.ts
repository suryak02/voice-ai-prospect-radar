import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_LIVE_SEARCH_CATEGORIES } from "./categories";
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
  it("rejects blank live-search areas before calling Google Places", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    const result = await searchGooglePlacesProspects({
      area: "   ",
      categories: ["plumber"],
    });

    expect(result).toEqual({ businesses: [], cached: false, errors: ["Search area is required."] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects empty live-search category selections before calling Google Places", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    const fetchMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);

    const result = await searchGooglePlacesProspects({
      area: "London",
      categories: [],
    });

    expect(result).toEqual({ businesses: [], cached: false, errors: ["Select at least one prospect category."] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

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

  it("deduplicates repeated verticals before calling Google Places", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ places: [place("place-6", "Zeta Plumbing")] }));

    vi.stubGlobal("fetch", fetchMock);

    const result = await searchGooglePlacesProspects({
      area: "Duplicate Vertical Test Town",
      categories: ["plumber", "plumber"],
    });

    expect(result.businesses).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the shared live-search category cap for provider fanout", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    let callCount = 0;
    const fetchMock = vi.fn(() => {
      callCount += 1;
      return Promise.resolve(jsonResponse({ places: [place(`place-cap-${callCount}`, `Capped Prospect ${callCount}`)] }));
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await searchGooglePlacesProspects({
      area: "Category Cap Test Town",
      categories: ["dental", "aesthetics", "veterinary", "physiotherapy", "chiropractor", "optometry", "dermatology"],
    });

    expect(result.businesses).toHaveLength(MAX_LIVE_SEARCH_CATEGORIES);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_LIVE_SEARCH_CATEGORIES);
    expect(requestBody(fetchMock, MAX_LIVE_SEARCH_CATEGORIES - 1).textQuery).toContain("opticians or optometrist");
  });

  it("trims blank contact fields before scoring live prospects", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        places: [
          {
            ...place("place-contact-cleanup", "Contact Cleanup Dental"),
            formattedAddress: "   ",
            nationalPhoneNumber: "   ",
            internationalPhoneNumber: " +44 20 7000 0001 ",
            websiteUri: "   ",
            googleMapsUri: " https://maps.google.com/?cid=contact-cleanup ",
          },
        ],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await searchGooglePlacesProspects({
      area: "Contact Cleanup Test Town",
      categories: ["dental"],
    });

    expect(result.businesses[0]).toMatchObject({
      address: "Contact Cleanup Test Town",
      phone: "+44 20 7000 0001",
      website: "https://maps.google.com/?cid=contact-cleanup",
      hasWebsite: false,
      hasVisiblePhone: true,
    });
  });

  it("detects common booking-platform website URLs as online booking signals", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        places: [
          {
            ...place("place-booking-platform", "Fresha Dental Studio"),
            websiteUri: "https://www.fresha.com/a/fresha-dental-studio-london",
            types: ["dentist"],
          },
        ],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await searchGooglePlacesProspects({
      area: "Booking Platform Test Town",
      categories: ["dental"],
    });

    expect(result.businesses[0]).toMatchObject({
      hasOnlineBooking: true,
    });
    expect(result.businesses[0].reasoning).toContain("Dental is an appointment-led vertical");
    expect(result.businesses[0].reasoning).toContain("Visible booking signals");
  });

  it("uses category-specific reasoning for lower-fit contrast categories", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        places: [
          {
            ...place("place-retail-contrast", "High Street Retail Shop"),
            types: ["store"],
          },
        ],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await searchGooglePlacesProspects({
      area: "Reasoning Contrast Test Town",
      categories: ["retail"],
    });

    expect(result.businesses[0]).toMatchObject({
      category: "retail",
    });
    expect(result.businesses[0].reasoning).toContain("Retail (contrast) is a lower-fit customer-service workflow");
    expect(result.businesses[0].reasoning).not.toContain("appointment-led vertical");
  });

  it("creates readable stable IDs for accented, punctuation-only, or long place names", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        places: [
          place("google-place-accent-12345678", "Café Santé & Co"),
          place("google-place-symbols-87654321", "!!!"),
          place("google-place-long-11223344", "North London Emergency Dental and Implant Clinic with Same Day Appointments"),
        ],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await searchGooglePlacesProspects({
      area: "Stable ID Test Town",
      categories: ["dental"],
    });

    expect(result.businesses.map((business) => business.id)).toEqual([
      "cafe-sante-and-co-12345678",
      "prospect-87654321",
      "north-london-emergency-dental-and-implant-clinic-with-same-day-appoint-11223344",
    ]);
  });

  it("skips places without usable coordinates instead of placing them on the fallback map point", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        places: [
          place("place-with-coordinates", "Mapped Dental"),
          { ...place("place-no-location", "Unmapped Dental"), location: undefined },
          { ...place("place-partial-location", "Partial Dental"), location: { latitude: 51.5 } },
        ],
      }),
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await searchGooglePlacesProspects({
      area: "Coordinate Quality Test Town",
      categories: ["dental"],
    });

    expect(result.businesses.map((business) => business.googlePlaceId)).toEqual(["place-with-coordinates"]);
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

  it("keeps provider error messages in requested category order", async () => {
    process.env.GOOGLE_MAPS_API_KEY = "test-key";
    const fetchMock = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      const textQuery = String(JSON.parse(String(init?.body)).textQuery);
      if (textQuery.startsWith("dentist")) {
        return new Promise<Response>((resolve) => {
          setTimeout(() => {
            resolve(textResponse({ error: { message: "Dental search timed out." } }, { ok: false, status: 504 }));
          }, 5);
        });
      }
      return Promise.resolve(textResponse({ error: { message: "Plumber quota exhausted." } }, { ok: false, status: 429 }));
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await searchGooglePlacesProspects({
      area: "Ordered Error Test Town",
      categories: ["dental", "plumber"],
    });

    expect(result.errors).toEqual(["dental: Dental search timed out.", "plumber: Plumber quota exhausted."]);
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
