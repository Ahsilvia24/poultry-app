import { PrismaClient } from "@prisma/client";
import { applyHostedEnv } from "./hosted-env.mjs";

applyHostedEnv();

const prisma = new PrismaClient();
try {
  await prisma.$executeRawUnsafe(
    `ALTER TYPE "VisitType" ADD VALUE IF NOT EXISTS 'WEIGHT_PROJECTION'`,
  );
  console.log("ensure-visit-type: WEIGHT_PROJECTION ready");
} catch (error) {
  console.warn(
    "ensure-visit-type: could not add WEIGHT_PROJECTION",
    error instanceof Error ? error.message : error,
  );
} finally {
  await prisma.$disconnect();
}
