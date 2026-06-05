import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { calculateVoiceAiScore } from "../src/lib/scoring";
import type { BusinessCategory } from "../src/lib/types";

loadEnvFile(".env.local");
loadEnvFile(".env");

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("DATABASE_URL is not set; nothing to re-score.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } }),
});

/**
 * Recompute voiceAiScore + scoreBreakdown for every stored business from its
 * existing public signals, using the current scoring rubric. Run after changing
 * `src/lib/scoring.ts` so already-persisted businesses reflect the new model.
 * Does NOT touch `status` (the human review workflow).
 */
async function main() {
  const businesses = await prisma.business.findMany();
  console.log(`Re-scoring ${businesses.length} businesses...`);

  const distribution = new Array(10).fill(0);
  let changed = 0;

  for (const business of businesses) {
    const { score, breakdown } = calculateVoiceAiScore({
      category: business.category as BusinessCategory,
      hasWebsite: business.hasWebsite,
      hasOnlineBooking: business.hasOnlineBooking,
      hasVisiblePhone: business.hasVisiblePhone,
      appointmentBased: business.appointmentBased,
      highValueService: business.highValueService,
      reviewPainSignals: business.reviewPainSignals,
      reviewCount: business.reviewCount ?? undefined,
    });

    distribution[score] += 1;
    if (score !== business.voiceAiScore) {
      await prisma.business.update({ where: { id: business.id }, data: { voiceAiScore: score, scoreBreakdown: breakdown } });
      changed += 1;
    }
  }

  console.log(`Updated ${changed} of ${businesses.length}. New score distribution:`);
  distribution.forEach((count, score) => {
    if (count) console.log(`  ${score}/9 : ${count}`);
  });
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
    await prisma.$disconnect();
  });
