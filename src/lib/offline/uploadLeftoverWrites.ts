import { flushOutbox } from "@/lib/offline/flushOutbox";
import { loadOutbox } from "@/lib/offline/idb";

/**
 * Push leftover outbox items to the website. Never downloads a snapshot.
 * Safe on app open and when the phone comes back online.
 */
export async function uploadLeftoverWrites(ownerEmail?: string): Promise<void> {
  try {
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    const leftover = await loadOutbox(ownerEmail);
    const legacy = ownerEmail ? await loadOutbox() : leftover;
    if (leftover.length === 0 && legacy.length === 0) return;
    await flushOutbox();
  } catch {
    /* Phone keeps its replica even if leftover upload fails. */
  }
}
