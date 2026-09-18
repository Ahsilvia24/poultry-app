import { flushOutbox, waitForFlush } from "@/lib/offline/flushOutbox";
import { loadIdAliases, loadOutbox } from "@/lib/offline/idb";
import type { IdAliases } from "@/lib/offline/remapIds";
import { SYNC_OVERALL_MS, withTimeout } from "@/lib/offline/syncTimeout";
import type { OfflineSnapshot } from "@/lib/offline/types";
import { publicSyncLeftoverError } from "@/lib/visits/ensureVisitType";

export const SYNC_ATTEMPTS = 3;

export type SyncFailReason = "offline" | "no-session" | "unreachable" | "leftover";

export type SyncPhoneResult =
  | { ok: true; pending: 0; aliases: IdAliases; snapshot: OfflineSnapshot | null }
  | { ok: false; pending: number; aliases: IdAliases; reason: SyncFailReason; error?: string };

export const SYNC_WORKING = "Uploading farm work to the website…";
export const SYNC_SAVED = "All farm work on this phone is saved to the website.";
export const SYNC_NEEDS_SERVICE = "Sync needs Wi-Fi or service. Connect and tap Sync data again.";
export const SYNC_NO_SESSION = "This sign-in expired. Sign in, then tap Sync data.";
export const SYNC_UNREACHABLE = "Could not reach the website. Stay on Wi-Fi and tap Sync data again.";
export const SYNC_LEFTOVER = "Farm work did not upload. Stay on Wi-Fi and tap Sync data again.";
export { LOCAL_FARM_STILL_ON_PHONE as SYNC_LOCAL_FARM } from "@/lib/offline/localFarmId";

export function syncPhoneResultMessage(result: SyncPhoneResult): {
  kind: "saved" | "unsaved";
  text: string;
} {
  if (result.ok) return { kind: "saved", text: SYNC_SAVED };
  if (result.reason === "offline") return { kind: "unsaved", text: SYNC_NEEDS_SERVICE };
  if (result.reason === "no-session") return { kind: "unsaved", text: SYNC_NO_SESSION };
  if (result.reason === "leftover") {
    return { kind: "unsaved", text: publicSyncLeftoverError(result.error) || SYNC_LEFTOVER };
  }
  return { kind: "unsaved", text: SYNC_UNREACHABLE };
}

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function probeWebsite(): Promise<
  { ok: true } | { ok: false; reason: Exclude<SyncFailReason, "leftover"> }
> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: false, reason: "offline" };
  }
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("/api/offline/ping", {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      signal: controller.signal,
    });
    if (res.status === 401) return { ok: false, reason: "no-session" };
    if (!res.ok) return { ok: false, reason: "unreachable" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "unreachable" };
  } finally {
    window.clearTimeout(timer);
  }
}

async function fail(
  reason: SyncFailReason,
  aliases: IdAliases,
  error?: string,
): Promise<Extract<SyncPhoneResult, { ok: false }>> {
  const leftover = await loadOutbox();
  return { ok: false, pending: leftover.length, aliases, reason, error };
}

/** Upload every local write. Success when the outbox is empty. Snapshot pull is best-effort. */
export async function syncPhoneToWebsite(): Promise<SyncPhoneResult> {
  try {
    return await withTimeout(syncPhoneToWebsiteOnce(), SYNC_OVERALL_MS);
  } catch {
    // The overall timer does not cancel flush. Wait for it so leftover is not a mid-upload snapshot.
    try {
      const flushed = await waitForFlush();
      if (flushed.pending === 0) {
        return { ok: true, pending: 0, aliases: flushed.aliases, snapshot: null };
      }
      return fail("leftover", flushed.aliases, flushed.error);
    } catch {
      const aliases = await loadIdAliases();
      const leftover = await loadOutbox();
      if (leftover.length === 0) {
        return { ok: true, pending: 0, aliases, snapshot: null };
      }
      return fail("leftover", aliases);
    }
  }
}

async function syncPhoneToWebsiteOnce(): Promise<SyncPhoneResult> {
  let aliases: IdAliases = {};
  let lastError: string | undefined;
  for (let attempt = 0; attempt < SYNC_ATTEMPTS; attempt += 1) {
    const probe = await probeWebsite();
    if (!probe.ok) return fail(probe.reason, aliases);

    const flushed = await flushOutbox({ evenIfOffline: true });
    aliases = flushed.aliases;
    lastError = flushed.error;
    const leftover = await loadOutbox();
    if (leftover.length === 0) {
      const confirm = await probeWebsite();
      if (!confirm.ok) return fail(confirm.reason, aliases);
      const still = await loadOutbox();
      if (still.length > 0) {
        if (attempt < SYNC_ATTEMPTS - 1) await wait(400 * (attempt + 1));
        continue;
      }
      // Snapshot download is what left Settings on “Uploading…”. Work is already up.
      return { ok: true, pending: 0, aliases, snapshot: null };
    }
    if (attempt < SYNC_ATTEMPTS - 1) await wait(400 * (attempt + 1));
  }
  return fail("leftover", aliases, lastError);
}
