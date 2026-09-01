import { getCache, setCache, cleanupMemoryCache } from "@/lib/cache";
import { CATEGORY_META, MAX_LIVE_SEARCH_CATEGORIES, categorySearchTerm, inferCategoryFromText } from "@/lib/categories";
import { getEnvValue } from "@/lib/env";
import { readJsonResponse } from "@/lib/http-json";
import { calculateVoiceAiScore } from "@/lib/scoring";
import { isInUk, UK_BOUNDS } from "@/lib/uk-bounds";
import type { Business, BusinessCategory, BusinessStatus } from "@/lib/types";

const GOOGLE_PLACES_ENDPOINT = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.types",
  "nextPageToken",
].join(",");

// Google Places "Text Search (New)" returns up to 20 results per page and up
// to roughly 60 across paginated pages for a single query.
const MAX_RESULTS_PER_PAGE = 20;
const DEFAULT_MAX_PAGES_PER_QUERY = 3;
const ABSOLUTE_MAX_PAGES_PER_QUERY = 3;
const CACHE_TTL_SECONDS = 60 * 30;

// Bounding box covering the UK (incl. Northern Ireland). Used as a hard
// locationRestriction so an ambiguous query can't return non-UK businesses and
// skew the map. regionCode alone only biases ranking; it does not restrict.
const UK_RECTANGLE = {
  low: { latitude: UK_BOUNDS.minLat, longitude: UK_BOUNDS.minLng },
  high: { latitude: UK_BOUNDS.maxLat, longitude: UK_BOUNDS.maxLng },
};

type GooglePlace = {
  id: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  types?: string[];
};

type SearchResponse = {
  places?: GooglePlace[];
  nextPageToken?: string;
  error?: { message?: string; status?: string };
};

export type LiveProspectSearchInput = {
  area: string;
  categories: BusinessCategory[];
};

export async function searchGooglePlacesProspects(
  input: LiveProspectSearchInput,
): Promise<{ businesses: Business[]; cached: boolean; errors: string[] }> {
  const apiKey = getEnvValue("GOOGLE_MAPS_API_KEY") ?? getEnvValue("GOOGLE_PLACES_API_KEY");
  if (!apiKey) return { businesses: [], cached: false, errors: ["GOOGLE_MAPS_API_KEY / GOOGLE_PLACES_API_KEY not set at runtime"] };

  const area = normalizeSearchArea(input.area);
  if (!area) return { businesses: [], cached: false, errors: ["Search area is required."] };

  const categories = [...new Set(input.categories)].slice(0, MAX_LIVE_SEARCH_CATEGORIES);
  if (categories.length === 0) return { businesses: [], cached: false, errors: ["Select at least one prospect category."] };

  const pageLimit = getPlacesPageLimit();
  const cacheKey = `places:${area.toLowerCase()}::${[...categories].sort().join(",")}::pages:${pageLimit}`;
  cleanupMemoryCache();
  const cached = await getCache<Business[]>(cacheKey);
  if (cached.value) {
    return { businesses: cached.value, cached: true, errors: [] };
  }

  // Fetch every vertical concurrently. A single failing category degrades to an
  // empty list for that vertical instead of aborting the whole search.
  const resultsByCategory: { category: BusinessCategory; places: GooglePlace[]; error?: string }[] = await Promise.all(
    categories.map((category) =>
      searchPlaces(apiKey, `${categorySearchTerm(category)} in ${area}`, pageLimit)
        .then((places) => ({ category, places }))
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`Live prospect search failed for category "${category}".`, error);
          return { category, places: [] as GooglePlace[], error: `${category}: ${message}` };
        }),
    ),
  );
  const errors = resultsByCategory.flatMap((result) => (result.error ? [result.error] : []));

  const seenPlaceIds = new Set<string>();
  const businesses: Business[] = [];

  for (const { category, places } of resultsByCategory) {
    for (const place of places) {
      if (!place.id || seenPlaceIds.has(place.id)) continue;
      if (place.businessStatus && place.businessStatus !== "OPERATIONAL") continue;
      if (!placeHasUsableCoordinates(place)) continue;
      if (!isInUk(place.location.latitude, place.location.longitude)) {
        continue;
      }
      seenPlaceIds.add(place.id);
      businesses.push(toBusiness(place, category, area));
    }
  }

  const sorted = businesses
    .sort((a, b) => b.voiceAiScore - a.voiceAiScore)
    .slice(0, MAX_RESULTS_PER_PAGE * pageLimit * categories.length);
  // Only cache successful, non-empty results — otherwise a transient failure
  // (e.g. a temporary API error) poisons the cache with an empty list for 30 min.
  if (sorted.length > 0 && errors.length === 0) {
    await setCache(cacheKey, sorted, CACHE_TTL_SECONDS);
  }
  return { businesses: sorted, cached: false, errors };
}

async function searchPlaces(apiKey: string, textQuery: string, pageLimit: number): Promise<GooglePlace[]> {
  const places: GooglePlace[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < pageLimit; page += 1) {
    const data = await searchPlacesPage(apiKey, textQuery, pageToken);
    places.push(...(data.places ?? []));
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }

  return places;
}

async function searchPlacesPage(apiKey: string, textQuery: string, pageToken?: string): Promise<SearchResponse> {
  const response = await fetch(GOOGLE_PLACES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount: MAX_RESULTS_PER_PAGE,
      regionCode: "GB",
      locationRestriction: { rectangle: UK_RECTANGLE },
      ...(pageToken ? { pageToken } : {}),
    }),
  });

  const data = await readJsonResponse<SearchResponse>(response);

  return data;
}

function getPlacesPageLimit(): number {
  const configured = Number(getEnvValue("PLACES_SEARCH_PAGE_LIMIT") ?? DEFAULT_MAX_PAGES_PER_QUERY);
  if (!Number.isFinite(configured)) return DEFAULT_MAX_PAGES_PER_QUERY;
  return Math.min(Math.max(Math.floor(configured), 1), ABSOLUTE_MAX_PAGES_PER_QUERY);
}

function normalizeSearchArea(area: string): string {
  return area.trim().replace(/\s+/g, " ");
}

function toBusiness(place: GooglePlace, requestedCategory: BusinessCategory, area: string): Business {
  const name = place.displayName?.text?.trim() || "Unnamed place";
  const address = optionalText(place.formattedAddress) ?? area;
  const nationalPhoneNumber = optionalText(place.nationalPhoneNumber);
  const internationalPhoneNumber = optionalText(place.internationalPhoneNumber);
  const websiteUri = optionalText(place.websiteUri);
  const googleMapsUri = optionalText(place.googleMapsUri);
  const category = inferCategoryFromText(`${(place.types ?? []).join(" ")} ${name}`, requestedCategory);
  const config = CATEGORY_META[category];
  const hasWebsite = Boolean(websiteUri);
  const hasVisiblePhone = Boolean(nationalPhoneNumber ?? internationalPhoneNumber);
  const hasOnlineBooking = inferOnlineBooking(websiteUri);
  const reviewPainSignals = inferReviewPainSignals(place.userRatingCount, place.rating);
  const { score, breakdown } = calculateVoiceAiScore({
    category,
    hasWebsite,
    hasOnlineBooking,
    hasVisiblePhone,
    appointmentBased: config.appointmentBased,
    highValueService: config.highValueService,
    reviewPainSignals,
    reviewCount: place.userRatingCount,
  });

  return {
    id: stableBusinessId(place.id, name),
    googlePlaceId: place.id,
    name,
    category,
    address,
    borough: inferAreaLabel(address, area),
    latitude: place.location?.latitude ?? 51.52,
    longitude: place.location?.longitude ?? -0.06,
    phone: nationalPhoneNumber ?? internationalPhoneNumber,
    website: websiteUri ?? googleMapsUri,
    rating: place.rating,
    reviewCount: place.userRatingCount,
    hasWebsite,
    hasOnlineBooking,
    hasVisiblePhone,
    appointmentBased: config.appointmentBased,
    highValueService: config.highValueService,
    reviewPainSignals,
    voiceAiScore: score,
    scoreBreakdown: breakdown,
    recommendedUseCase: config.useCase,
    reasoning: buildReasoning({ category, hasWebsite, hasOnlineBooking, hasVisiblePhone, reviewCount: place.userRatingCount, rating: place.rating }),
    status: score >= 7 ? ("needs_review" as BusinessStatus) : ("new" as BusinessStatus),
  };
}

function optionalText(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function placeHasUsableCoordinates(place: GooglePlace): place is GooglePlace & {
  location: { latitude: number; longitude: number };
} {
  return Number.isFinite(place.location?.latitude) && Number.isFinite(place.location?.longitude);
}

function inferAreaLabel(address: string, requestedArea: string): string {
  const knownAreas = [
    "Hackney",
    "Tower Hamlets",
    "Islington",
    "Newham",
    "City of London",
    "Camden",
    "Southwark",
    "Waltham Forest",
    "London",
  ];
  const normalized = address.toLowerCase();
  return knownAreas.find((area) => normalized.includes(area.toLowerCase())) ?? requestedArea;
}

function inferOnlineBooking(websiteUri?: string): boolean {
  if (!websiteUri) return false;
  const normalized = websiteUri.toLowerCase();
  return [
    "book",
    "booking",
    "appoint",
    "acuityscheduling",
    "booksy",
    "calendly",
    "cliniko",
    "dentally",
    "doctify",
    "fresha",
    "mindbody",
    "opentable",
    "phorest",
    "resdiary",
    "setmore",
    "simplybook",
    "treatwell",
    "zocdoc",
  ].some((token) => normalized.includes(token));
}

function inferReviewPainSignals(reviewCount?: number, rating?: number): string[] {
  const signals: string[] = [];
  if ((reviewCount ?? 0) >= 100) signals.push("high review volume suggests meaningful inbound demand");
  if (rating !== undefined && rating < 4.3) signals.push("lower rating may indicate service or responsiveness friction");
  return signals;
}

function buildReasoning(input: {
  category: BusinessCategory;
  hasWebsite: boolean;
  hasOnlineBooking: boolean;
  hasVisiblePhone: boolean;
  reviewCount?: number;
  rating?: number;
}): string {
  const categoryLabel = CATEGORY_META[input.category].label;
  const parts = [
    `${categoryLabel} is an appointment-led vertical worth evaluating for Voice AI.`,
    input.hasVisiblePhone ? "A public phone number indicates a live call path." : "No public phone was found, lowering confidence.",
    input.hasOnlineBooking ? "Visible booking signals reduce urgency but keep reminder/call-cover use cases." : "No obvious booking signal was found, so scheduling friction is plausible.",
  ];
  if (input.hasWebsite) parts.push("A website exists for manual verification before outreach.");
  if (input.reviewCount !== undefined) parts.push(`${input.reviewCount} Google reviews provide public demand/confidence context.`);
  if (input.rating !== undefined) parts.push(`Google rating: ${input.rating}.`);
  return parts.join(" ");
}

function stableBusinessId(placeId: string, name: string): string {
  return `${slugify(name)}-${placeId.slice(-8).toLowerCase()}`;
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/g, "");

  return slug || "prospect";
}
