/**
 * One-time-safe remap before removing VisitType.SEVEN_DAY from the schema.
 * Ensures new enum values exist, then rewrites 7-day visits to Weight Projection.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  for (const value of ["WEIGHT_PROJECTION", "LFO", "HIGH_MORTALITY"] as const) {
    await prisma.$executeRawUnsafe(
      `ALTER TYPE "VisitType" ADD VALUE IF NOT EXISTS '${value}'`,
    );
  }

  // Cast via text so this still runs if SEVEN_DAY was already removed from the enum.
  const updated = await prisma.$executeRawUnsafe(`
    UPDATE "FarmVisit"
    SET "visitType" = 'WEIGHT_PROJECTION'
    WHERE "visitType"::text = 'SEVEN_DAY'
  `);

  console.log(`Remapped ${updated} SEVEN_DAY visit(s) to WEIGHT_PROJECTION`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
