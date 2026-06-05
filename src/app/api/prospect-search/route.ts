import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CATEGORY_ENUM_VALUES } from "@/lib/categories";
import { getBusinesses, persistBusinesses } from "@/lib/data/businesses";
import { searchGooglePlacesProspects } from "@/lib/google-places";
import { checkRateLimit, cleanupRateLimitBuckets } from "@/lib/rate-limit";
import type { BusinessCategory } from "@/lib/types";

const categorySchema = z.enum(CATEGORY_ENUM_VALUES);

const searchSchema = z.object({
  area: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[\p{L}\p{N}\s,'.-]+$/u, "Use a normal place name, postcode, city, or borough."),
  categories: z.array(categorySchema).min(1).max(6),
});

export async function POST(request: NextRequest) {
  cleanupRateLimitBuckets();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const rateLimit = await checkRateLimit({ key: `prospect-search:${ip}`, limit: 8, windowMs: 60 * 60 * 1000 });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Search limit reached. Try again later.",
        resetAt: new Date(rateLimit.resetAt).toISOString(),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          "X-RateLimit-Remaining": "0",
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = searchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search request.", issues: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { area, categories } = parsed.data;

  try {
    const live = await searchGooglePlacesProspects({ area, categories: categories as BusinessCategory[] });
    if (live.businesses.length) {
      // Persist fresh live results after the response is sent (non-blocking).
      if (!live.cached) {
        after(() => persistBusinesses(live.businesses));
      }
      return NextResponse.json(
        {
          businesses: live.businesses,
          source: live.cached ? "google_places_cache" : "google_places_live",
          searched: { area, categories },
          limitRemaining: rateLimit.remaining,
        },
        { headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) } },
      );
    }
  } catch (error) {
    console.error("Live prospect search failed; falling back to stored businesses.", error);
  }

  const storedBusinesses = await getBusinesses();
  const normalizedArea = area.toLowerCase();
  const fallback = storedBusinesses.filter((business) => {
    const categoryMatches = categories.includes(business.category);
    const areaMatches =
      business.borough.toLowerCase().includes(normalizedArea) ||
      business.address.toLowerCase().includes(normalizedArea) ||
      normalizedArea.includes("london");
    return categoryMatches && areaMatches;
  });

  return NextResponse.json(
    {
      businesses: fallback.length ? fallback : storedBusinesses.filter((business) => categories.includes(business.category)).slice(0, 12),
      source: "stored_fallback",
      searched: { area, categories },
      limitRemaining: rateLimit.remaining,
    },
    { headers: { "X-RateLimit-Remaining": String(rateLimit.remaining) } },
  );
}
