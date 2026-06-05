import { CATEGORY_META, categorySearchTerm, inferCategoryFromText } from "@/lib/categories";
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
].join(",");

// Google Places "Text Search (New)" returns up to 20 results per request.
const MAX_RESULTS = 20;
// Safety cap on how many verticals a single search fans out to (bounds API cost).
const MAX_CATEGORIES = 6;
const CACHE_TTL_MS = 1000 * 60 * 30;

// Bounding box covering the UK (incl. Northern Ireland). Used as a hard
// locationRestriction so an ambiguous query can't return non-UK businesses and
// skew the map. regionCode alone only biases ranking; it does not restrict.
const UK_RECTANGLE = {
  low: { latitude: UK_BOUNDS.minLat, longitude: UK_BOUNDS.minLng },
  high: { latitude: UK_BOUNDS.maxLat, longitude: UK_BOUNDS.maxLng },
};

const searchCache = new Map<string, { expiresAt: number; businesses: Business[] }>();

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
  error?: { message?: string; status?: string };
};

export type LiveProspectSearchInput = {
  area: string;
  categories: BusinessCategory[];
};

export async function searchGooglePlacesProspects(
  input: LiveProspectSearchInput,
): Promise<{ businesses: Business[]; cached: boolean; errors: string[] }> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return { businesses: [], cached: false, errors: ["GOOGLE_MAPS_API_KEY / GOOGLE_PLACES_API_KEY not set at runtime"] };

  const categories = input.categories.slice(0, MAX_CATEGORIES);
  const cacheKey = `${input.area.toLowerCase()}::${[...categories].sort().join(",")}`;
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { businesses: cached.businesses, cached: true, errors: [] };
  }

  const errors: string[] = [];

  // Fetch every vertical concurrently. A single failing category degrades to an
  // empty list for that vertical instead of aborting the whole search.
  const resultsByCategory = await Promise.all(
    categories.map((category) =>
      searchPlaces(apiKey, `${categorySearchTerm(category)} in ${input.area}`)
        .then((places) => ({ category, places }))
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`Live prospect search failed for category "${category}".`, error);
          errors.push(`${category}: ${message}`);
          return { category, places: [] as GooglePlace[] };
        }),
    ),
  );

  const seenPlaceIds = new Set<string>();
  const businesses: Business[] = [];

  for (const { category, places } of resultsByCategory) {
    for (const place of places) {
      if (!place.id || seenPlaceIds.has(place.id)) continue;
      if (place.businessStatus && place.businessStatus !== "OPERATIONAL") continue;
      if (place.location?.latitude != null && place.location?.longitude != null && !isInUk(place.location.latitude, place.location.longitude)) {
        continue;
      }
      seenPlaceIds.add(place.id);
      businesses.push(toBusiness(place, category, input.area));
    }
  }

  const sorted = businesses
    .sort((a, b) => b.voiceAiScore - a.voiceAiScore)
    .slice(0, MAX_RESULTS * categories.length);
  // Only cache successful, non-empty results — otherwise a transient failure
  // (e.g. a temporary API error) poisons the cache with an empty list for 30 min.
  if (sorted.length > 0 && errors.length === 0) {
    searchCache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, businesses: sorted });
  }
  return { businesses: sorted, cached: false, errors };
}

async function searchPlaces(apiKey: string, textQuery: string): Promise<GooglePlace[]> {
  const response = await fetch(GOOGLE_PLACES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount: MAX_RESULTS,
      regionCode: "GB",
      locationRestriction: { rectangle: UK_RECTANGLE },
    }),
  });

  const data = (await response.json()) as SearchResponse;
  if (!response.ok) {
    throw new Error(`Google Places failed: ${data.error?.message ?? response.statusText}`);
  }

  return data.places ?? [];
}

function toBusiness(place: GooglePlace, requestedCategory: BusinessCategory, area: string): Business {
  const name = place.displayName?.text?.trim() || "Unnamed place";
  const category = inferCategoryFromText(`${(place.types ?? []).join(" ")} ${name}`, requestedCategory);
  const config = CATEGORY_META[category];
  const hasWebsite = Boolean(place.websiteUri);
  const hasVisiblePhone = Boolean(place.nationalPhoneNumber || place.internationalPhoneNumber);
  const hasOnlineBooking = inferOnlineBooking(place.websiteUri);
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
    address: place.formattedAddress ?? area,
    borough: inferAreaLabel(place.formattedAddress ?? area, area),
    latitude: place.location?.latitude ?? 51.52,
    longitude: place.location?.longitude ?? -0.06,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber,
    website: place.websiteUri ?? place.googleMapsUri,
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
  return ["book", "booking", "appoint", "cliniko", "doctify", "dentally", "zocdoc", "resdiary", "opentable"].some((token) =>
    normalized.includes(token),
  );
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
  const parts = [
    `${input.category} is an appointment-led vertical worth evaluating for Voice AI.`,
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
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}
