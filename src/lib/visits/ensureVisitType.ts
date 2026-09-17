import { prisma } from "@/lib/prisma";

const ADD_WEIGHT_PROJECTION = `ALTER TYPE "VisitType" ADD VALUE IF NOT EXISTS 'WEIGHT_PROJECTION'`;

let ensurePromise: Promise<void> | null = null;

/** Make Weight Projection a real Postgres visit type even if migrate deploy skipped it. */
export async function ensureWeightProjectionVisitType() {
  if (!ensurePromise) {
    ensurePromise = prisma
      .$executeRawUnsafe(ADD_WEIGHT_PROJECTION)
      .then(() => undefined)
      .catch(() => {
        ensurePromise = null;
      });
  }
  await ensurePromise;
}

export function visitSaveError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (/WEIGHT_PROJECTION|invalid input value for enum/i.test(message)) {
    return "Could not save this visit type yet. Stay on Wi-Fi and tap Sync data again.";
  }
  return "Could not save this visit. Stay on Wi-Fi and tap Sync data again.";
}

export function publicSyncLeftoverError(error?: string): string | undefined {
  const text = error?.trim() ?? "";
  if (!text) return undefined;
  if (/server components render|digest property|omitted in production/i.test(text)) {
    return undefined;
  }
  return text;
}
