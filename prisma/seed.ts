import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { mockBusinesses } from "../src/lib/mock-businesses";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  }),
});

async function main() {
  for (const business of mockBusinesses) {
    await prisma.business.upsert({
      where: { id: business.id },
      create: {
        id: business.id,
        googlePlaceId: business.googlePlaceId,
        name: business.name,
        category: business.category,
        address: business.address,
        borough: business.borough,
        latitude: business.latitude,
        longitude: business.longitude,
        phone: business.phone,
        website: business.website,
        rating: business.rating,
        reviewCount: business.reviewCount,
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
      },
      update: {
        googlePlaceId: business.googlePlaceId,
        name: business.name,
        category: business.category,
        address: business.address,
        borough: business.borough,
        latitude: business.latitude,
        longitude: business.longitude,
        phone: business.phone,
        website: business.website,
        rating: business.rating,
        reviewCount: business.reviewCount,
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
      },
    });
  }

  console.log(`Seeded ${mockBusinesses.length} businesses.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
