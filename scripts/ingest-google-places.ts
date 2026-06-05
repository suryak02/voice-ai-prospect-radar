import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { CATEGORY_META, categorySearchTerm, inferCategoryFromText } from "../src/lib/categories";
import { calculateVoiceAiScore } from "../src/lib/scoring";
import { isInUk } from "../src/lib/uk-bounds";
import type { BusinessCategory, BusinessStatus } from "../src/lib/types";

loadEnvFile(".env.local");
loadEnvFile(".env");

const databaseUrl = process.env.DATABASE_URL;
const prisma = databaseUrl
  ? new PrismaClient({
      adapter: new PrismaPg({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false },
      }),
    })
  : null;

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

// A coherent East/Central London territory crossed with a spread of verticals,
// so the seeded map loads dense and varied. Override with CLI args or PLACES_QUERIES.
const defaultSeedAreas = [
  "Hackney London",
  "Shoreditch London",
  "Islington London",
  "Stratford London",
];
const defaultSeedCategories: BusinessCategory[] = [
  "dental",
  "aesthetics",
  "veterinary",
  "physiotherapy",
  "chiropractor",
  "optometry",
  "medspa",
  "hair_salon",
  "barber",
  "plumber",
  "electrician",
  "accountant",
];

function buildDefaultQueries(): string[] {
  const queries: string[] = [];
  for (const area of defaultSeedAreas) {
    for (const category of defaultSeedCategories) {
      queries.push(`${categorySearchTerm(category)} in ${area}`);
    }
  }
  return queries;
}

const KNOWN_AREAS = [
  "Hackney",
  "Tower Hamlets",
  "Islington",
  "Newham",
  "City of London",
  "Camden",
  "Southwark",
  "Waltham Forest",
  "Shoreditch",
  "Stratford",
  "Manchester",
  "Birmingham",
  "Leeds",
  "Bristol",
  "Liverpool",
  "Glasgow",
  "Edinburgh",
  "Sheffield",
  "Nottingham",
  "London",
];

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

async function main() {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  const dryRun = process.argv.includes("--dry-run") || !databaseUrl;
  const limit = Number(process.env.PLACES_RESULT_LIMIT ?? "12");
  const queries = getQueries();

  if (!apiKey) {
    throw new Error("Missing GOOGLE_MAPS_API_KEY. Add it to .env.local or your shell before running npm run ingest:places.");
  }

  if (!databaseUrl) {
    console.warn("DATABASE_URL is not set. Running Google Places fetch + scoring in dry-run mode; no database writes will happen.");
  }

  const seenPlaceIds = new Set<string>();
  let fetched = 0;
  let upserted = 0;

  for (const query of queries) {
    const places = await searchPlaces(apiKey, query, limit);
    console.log(`Fetched ${places.length} places for: ${query}`);

    for (const place of places) {
      if (!place.id || seenPlaceIds.has(place.id)) continue;
      if (place.businessStatus && place.businessStatus !== "OPERATIONAL") continue;
      if (place.location?.latitude != null && place.location?.longitude != null && !isInUk(place.location.latitude, place.location.longitude)) {
        continue;
      }
      seenPlaceIds.add(place.id);

      const business = toBusinessRecord(place, query);
      fetched += 1;

      if (dryRun) {
        console.log(`[dry-run] ${business.voiceAiScore}/9 ${business.name} — ${business.category} — ${business.address}`);
        continue;
      }

      if (!prisma) {
        throw new Error("Prisma client was not initialised. Set DATABASE_URL or run with --dry-run.");
      }

      await prisma.business.upsert({
        where: { id: business.id },
        create: business,
        update: business,
      });
      upserted += 1;
      console.log(`[upserted] ${business.voiceAiScore}/9 ${business.name}`);
    }
  }

  console.log(`Done. Scored ${fetched} unique Google Places results${dryRun ? "" : ` and upserted ${upserted}`}.`);
}

async function searchPlaces(apiKey: string, textQuery: string, maxResultCount: number): Promise<GooglePlace[]> {
  const response = await fetch(GOOGLE_PLACES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount,
      regionCode: "GB",
    }),
  });

  const data = (await response.json()) as SearchResponse;
  if (!response.ok) {
    throw new Error(`Google Places failed for "${textQuery}": ${data.error?.message ?? response.statusText}`);
  }

  return data.places ?? [];
}

function toBusinessRecord(place: GooglePlace, query: string) {
  const name = place.displayName?.text?.trim() || "Unnamed place";
  const category = inferCategoryFromText(`${(place.types ?? []).join(" ")} ${query} ${name}`, "other");
  const config = CATEGORY_META[category];
  const hasWebsite = Boolean(place.websiteUri);
  const hasVisiblePhone = Boolean(place.nationalPhoneNumber || place.internationalPhoneNumber);
  const hasOnlineBooking = inferOnlineBooking(place.websiteUri);
  const reviewPainSignals = inferReviewPainSignals(place.userRatingCount, place.rating);
  const scoreInput = {
    category,
    hasWebsite,
    hasOnlineBooking,
    hasVisiblePhone,
    appointmentBased: config.appointmentBased,
    highValueService: config.highValueService,
    reviewPainSignals,
    reviewCount: place.userRatingCount,
  };
  const { score, breakdown } = calculateVoiceAiScore(scoreInput);
  const borough = inferBorough(place.formattedAddress ?? query);

  return {
    id: stableBusinessId(place.id, name),
    googlePlaceId: place.id,
    name,
    category,
    address: place.formattedAddress ?? "London",
    borough,
    latitude: place.location?.latitude ?? 51.52,
    longitude: place.location?.longitude ?? -0.06,
    phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
    website: place.websiteUri ?? place.googleMapsUri ?? null,
    rating: place.rating ?? null,
    reviewCount: place.userRatingCount ?? null,
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

function getQueries(): string[] {
  const cliQueries = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
  if (cliQueries.length) return cliQueries;

  const envQueries = process.env.PLACES_QUERIES?.split(";").map((query) => query.trim()).filter(Boolean);
  return envQueries?.length ? envQueries : buildDefaultQueries();
}

function inferBorough(address: string): string {
  const normalized = address.toLowerCase();
  const known = KNOWN_AREAS.find((area) => normalized.includes(area.toLowerCase()));
  if (known) return known;

  // Fallback: pull a town-like segment from a UK formatted address.
  const segments = address
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reverse();
  const town = segments.find((segment) => segment !== "UK" && segment !== "United Kingdom" && !/\d/.test(segment));
  return town ?? "Local area";
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
    `${input.category} is a strong appointment-led vertical for Voice AI evaluation.`,
    input.hasVisiblePhone ? "A public phone number indicates a live call path." : "No public phone was found, lowering confidence.",
    input.hasOnlineBooking ? "Visible booking signals reduce urgency but keep reminder/call-cover use cases." : "No obvious booking signal was found, so scheduling friction is plausible.",
  ];

  if (input.hasWebsite) parts.push("A website exists, so outreach can be manually verified before contact.");
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

function loadEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (process.env[key]) continue;
    process.env[key] = valueParts.join("=").replace(/^['"]|['"]$/g, "");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma?.$disconnect();
  });
