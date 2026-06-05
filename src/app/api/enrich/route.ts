import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { enrichBusiness, resolveOpenAiModel } from "@/lib/openai-enrich";
import { checkRateLimit, cleanupRateLimitBuckets } from "@/lib/rate-limit";

// A business is only re-analyzed once a week (per depth). Within the cooldown,
// every request (including "refresh" spam) is served from the database.
const COOLDOWN_MS = 1000 * 60 * 60 * 24 * 7;

const schema = z.object({
  businessId: z.string().trim().min(1).max(200),
  mode: z.enum(["standard", "deep"]).default("standard"),
});

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "AI analysis needs a database connection." }, { status: 503 });
  }
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "AI analysis isn't configured yet (missing OPENAI_API_KEY)." }, { status: 503 });
  }

  cleanupRateLimitBuckets();
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const rateLimit = await checkRateLimit({ key: `enrich:${ip}`, limit: 20, windowMs: 60 * 60 * 1000 });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "AI analysis limit reached. Try again later." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)) } },
    );
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { businessId, mode } = parsed.data;

  // Deep web research is admin-only (the proxy sets x-user-tier authoritatively).
  const isAdmin = request.headers.get("x-user-tier") === "admin";
  if (mode === "deep" && !isAdmin) {
    return NextResponse.json({ error: "Deep research is restricted to admin access." }, { status: 403 });
  }

  const { prisma } = await import("@/lib/prisma");
  const business = await prisma.business.findUnique({ where: { id: businessId } });
  if (!business) {
    return NextResponse.json({ error: "Business not found." }, { status: 404 });
  }

  // Weekly cooldown. A cached deep result also satisfies a standard request, but
  // a standard cache does not satisfy a deep request (admin can upgrade it).
  const fresh = Boolean(business.aiSummary && business.aiEnrichedAt && Date.now() - business.aiEnrichedAt.getTime() < COOLDOWN_MS);
  const cacheSatisfies = mode === "deep" ? business.aiDepth === "deep" : true;
  if (fresh && cacheSatisfies) {
    return NextResponse.json({
      summary: business.aiSummary,
      angle: business.aiAngle,
      category: business.aiCategory,
      model: business.aiModel,
      depth: business.aiDepth ?? "standard",
      enrichedAt: business.aiEnrichedAt?.toISOString(),
      cached: true,
    });
  }

  let enrichment;
  try {
    enrichment = await enrichBusiness(business, { deep: mode === "deep" });
  } catch (error) {
    console.error("OpenAI enrichment failed.", error);
    return NextResponse.json({ error: "AI analysis failed. Please try again." }, { status: 502 });
  }
  if (!enrichment) {
    return NextResponse.json({ error: "AI analysis unavailable." }, { status: 502 });
  }

  const model = resolveOpenAiModel();
  const enrichedAt = new Date();
  await prisma.business.update({
    where: { id: business.id },
    data: {
      aiSummary: enrichment.summary,
      aiAngle: enrichment.angle,
      aiCategory: enrichment.category ?? null,
      aiModel: model,
      aiDepth: mode,
      aiEnrichedAt: enrichedAt,
    },
  });

  return NextResponse.json({
    summary: enrichment.summary,
    angle: enrichment.angle,
    category: enrichment.category,
    model,
    depth: mode,
    usedWebsite: enrichment.usedWebsite ?? false,
    enrichedAt: enrichedAt.toISOString(),
    cached: false,
  });
}
