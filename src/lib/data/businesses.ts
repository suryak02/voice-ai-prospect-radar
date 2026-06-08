import { mockBusinesses } from "@/lib/mock-businesses";
import { isInUk } from "@/lib/uk-bounds";
import type { Business, ScoreBreakdown, Ticket } from "@/lib/types";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

export async function getBusinesses(): Promise<Business[]> {
  if (!hasDatabaseUrl) return mockBusinesses;

  try {
    const { prisma } = await import("@/lib/prisma");
    const rows = await prisma.business.findMany({
      orderBy: [{ voiceAiScore: "desc" }, { name: "asc" }],
    });

    return rows.map((row) => ({
      id: row.id,
      googlePlaceId: row.googlePlaceId ?? undefined,
      name: row.name,
      category: row.category,
      address: row.address,
      borough: row.borough,
      latitude: row.latitude,
      longitude: row.longitude,
      phone: row.phone ?? undefined,
      website: row.website ?? undefined,
      rating: row.rating ?? undefined,
      reviewCount: row.reviewCount ?? undefined,
      hasWebsite: row.hasWebsite,
      hasOnlineBooking: row.hasOnlineBooking,
      hasVisiblePhone: row.hasVisiblePhone,
      appointmentBased: row.appointmentBased,
      highValueService: row.highValueService,
      reviewPainSignals: row.reviewPainSignals,
      voiceAiScore: row.voiceAiScore,
      scoreBreakdown: row.scoreBreakdown as unknown as ScoreBreakdown,
      recommendedUseCase: row.recommendedUseCase,
      reasoning: row.reasoning,
      aiSummary: row.aiSummary ?? undefined,
      aiAngle: row.aiAngle ?? undefined,
      aiCategory: row.aiCategory ?? undefined,
      aiModel: row.aiModel ?? undefined,
      aiDepth: row.aiDepth ?? undefined,
      aiEnrichedAt: row.aiEnrichedAt ? row.aiEnrichedAt.toISOString() : undefined,
      status: row.status,
    })).filter((business) => isInUk(business.latitude, business.longitude));
  } catch (error) {
    console.error("Failed to load businesses from database. Falling back to mock seed data.", error);
    return mockBusinesses;
  }
}

function toBusinessRow(business: Business) {
  return {
    id: business.id,
    googlePlaceId: business.googlePlaceId ?? null,
    name: business.name,
    category: business.category,
    address: business.address,
    borough: business.borough,
    latitude: business.latitude,
    longitude: business.longitude,
    phone: business.phone ?? null,
    website: business.website ?? null,
    rating: business.rating ?? null,
    reviewCount: business.reviewCount ?? null,
    hasWebsite: business.hasWebsite,
    hasOnlineBooking: business.hasOnlineBooking,
    hasVisiblePhone: business.hasVisiblePhone,
    appointmentBased: business.appointmentBased,
    highValueService: business.highValueService,
    reviewPainSignals: business.reviewPainSignals,
    voiceAiScore: business.voiceAiScore,
    scoreBreakdown: business.scoreBreakdown,
    recommendedUseCase: business.recommendedUseCase,
    reasoning: business.reasoning,
    status: business.status,
  };
}

/**
 * Upsert live-search prospects into the database. The live-search route awaits
 * this before responding so immediate ticket actions do not race the required
 * Ticket → Business foreign key. No-op when there is no database configured.
 */
export async function persistBusinesses(businesses: Business[]): Promise<void> {
  if (!hasDatabaseUrl || businesses.length === 0) return;

  try {
    const { prisma } = await import("@/lib/prisma");
    await Promise.all(
      businesses.map((business) => {
        const row = toBusinessRow(business);
        const where = row.googlePlaceId ? { googlePlaceId: row.googlePlaceId } : { id: row.id };
        return prisma.business.upsert({ where, create: row, update: row });
      }),
    );
  } catch (error) {
    console.error("Failed to persist live prospects to the database.", error);
  }
}

export async function getTickets(): Promise<Ticket[]> {
  if (!hasDatabaseUrl) return [];

  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.ticket.findMany({
    orderBy: { updatedAt: "desc" },
  });
  const latestByBusinessId = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (!latestByBusinessId.has(row.businessId)) latestByBusinessId.set(row.businessId, row);
  }

  return Array.from(latestByBusinessId.values()).map((row) => ({
    id: row.id,
    businessId: row.businessId,
    businessName: row.businessName,
    score: row.score,
    status: row.status,
    createdAt: formatTicketDate(row.updatedAt),
  }));
}

export async function createTicket(input: Pick<Ticket, "businessId" | "businessName" | "score" | "status">): Promise<Ticket> {
  if (!hasDatabaseUrl) {
    return {
      id: `ticket-${input.businessId}`,
      ...input,
      createdAt: formatTicketDate(new Date()),
    };
  }

  const { prisma } = await import("@/lib/prisma");
  const ticketId = `ticket-${input.businessId}`;
  const row = await prisma.ticket.upsert({
    where: { id: ticketId },
    create: {
      id: ticketId,
      businessId: input.businessId,
      businessName: input.businessName,
      score: input.score,
      status: input.status,
    },
    update: {
      businessName: input.businessName,
      score: input.score,
      status: input.status,
    },
  });

  return {
    id: row.id,
    businessId: row.businessId,
    businessName: row.businessName,
    score: row.score,
    status: row.status,
    createdAt: formatTicketDate(row.updatedAt),
  };
}

function formatTicketDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
