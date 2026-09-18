import { PrismaClient } from "@prisma/client";
import { applyHostedEnv } from "@/lib/hosted-env";

applyHostedEnv();

const globalForNodePrisma = globalThis as unknown as { nodePrisma?: PrismaClient };

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

/** Node login/register only. Do not import this from `proxy.ts` / Edge. */
export async function getNodePrisma() {
  if (globalForNodePrisma.nodePrisma) return globalForNodePrisma.nodePrisma;

  const url = postgresUrl();
  if (url) {
    const { PrismaPg } = await import("@prisma/adapter-pg");
    globalForNodePrisma.nodePrisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url }),
    });
  } else {
    const { prisma } = await import("@/lib/prisma");
    globalForNodePrisma.nodePrisma = prisma;
  }
  return globalForNodePrisma.nodePrisma;
}
