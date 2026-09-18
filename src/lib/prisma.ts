import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "@prisma/client";
import { applyHostedEnv } from "@/lib/hosted-env";

applyHostedEnv();

function postgresUrl() {
  const candidates = [
    process.env.DATABASE_URL,
    process.env.POSTGRES_URL,
    process.env.POSTGRES_URL_NON_POOLING,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_PRISMA_URL,
    process.env.PRISMA_DATABASE_URL,
  ];
  return candidates.find((value) => /^(postgres(ql)?:\/\/)/i.test(value?.trim() ?? ""))?.trim() ?? "";
}

function createPrisma() {
  const log: Prisma.LogLevel[] = process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];
  const url = postgresUrl();
  if (url) {
    return new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
      log,
    });
  }
  return new PrismaClient({ log });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || createPrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
