import { prisma } from "@/lib/prisma";

const ADD_VISIT_TYPE_VALUES = [
  `ALTER TYPE "VisitType" ADD VALUE IF NOT EXISTS 'WEIGHT_PROJECTION'`,
  `ALTER TYPE "VisitType" ADD VALUE IF NOT EXISTS 'WEEKLY_MEETING'`,
];

let ensurePromise: Promise<void> | null = null;

/** Make newer visit types real Postgres values even if migrate deploy skipped them. */
export async function ensureWeightProjectionVisitType() {
  if (!ensurePromise) {
    try {
      ensurePromise = (async () => {
        for (const sql of ADD_VISIT_TYPE_VALUES) {
          await prisma.$executeRawUnsafe(sql);
        }
      })().catch(() => {
        ensurePromise = null;
      });
    } catch {
      ensurePromise = Promise.resolve();
    }
  }
  await ensurePromise;
}

export function visitSaveError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err ?? "");
  if (/WEIGHT_PROJECTION|invalid input value for enum/i.test(message)) {
    return "Could not save this visit type yet. Stay on Wi-Fi and try again.";
  }
  return "Could not save this visit. Stay on Wi-Fi and try again.";
}

export function publicSyncLeftoverError(error?: string): string | undefined {
  const text = error?.trim() ?? "";
  if (!text) return undefined;
  if (/No database|server components render|digest property|omitted in production/i.test(text)) {
    return undefined;
  }
  return text;
}
