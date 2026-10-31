import { PrismaClient } from "@prisma/client";
import { applyHostedEnv } from "./hosted-env.mjs";

applyHostedEnv();

const prisma = new PrismaClient();
try {
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "VisitType" ADD VALUE IF NOT EXISTS 'WEIGHT_PROJECTION'`,
  );
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "VisitType" ADD VALUE IF NOT EXISTS 'WEEKLY_MEETING'`,
  );
  console.log("ensure-visit-type: WEIGHT_PROJECTION and WEEKLY_MEETING ready");
} catch (error) {
  console.warn(
    "ensure-visit-type: could not add WEIGHT_PROJECTION",
    error instanceof Error ? error.message : error,
  );
} finally {
  await prisma.$disconnect();
}
