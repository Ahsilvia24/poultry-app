import { persistPhoneStorage, saveAutomaticBackup, saveLocalSnapshot } from "@/lib/offline/idb";
import { normalizeOwnerEmail } from "@/lib/offline/ownerEmail";
import {
  buildPhoneBackup,
  phoneBackupJson,
  writeOpfsBackup,
} from "@/lib/offline/phoneBackup";
import type { OfflineSnapshot } from "@/lib/offline/types";

/** Extra copies (history, OPFS) are not the live farm data. Don't rebuild them on every hour log. */
const HEAVY_BACKUP_MS = 10 * 60 * 1000;
let lastHeavyBackupAt = 0;
let heavyTimer: ReturnType<typeof setTimeout> | null = null;
let heavyPending: { snapshot: OfflineSnapshot; owner: string } | null = null;

async function writeHeavyBackup(snapshot: OfflineSnapshot, owner: string) {
  const backup = buildPhoneBackup(snapshot);
  await saveAutomaticBackup(owner, backup);
  await writeOpfsBackup(owner, phoneBackupJson(backup));
  await persistPhoneStorage();
}

function scheduleHeavyBackup(snapshot: OfflineSnapshot, owner: string) {
  heavyPending = { snapshot, owner };
  if (heavyTimer != null) return;
  const since = Date.now() - lastHeavyBackupAt;
  const delay = lastHeavyBackupAt === 0 ? 1500 : Math.max(0, HEAVY_BACKUP_MS - since);
  heavyTimer = setTimeout(() => {
    heavyTimer = null;
    const pending = heavyPending;
    heavyPending = null;
    if (!pending) return;
    lastHeavyBackupAt = Date.now();
    void writeHeavyBackup(pending.snapshot, pending.owner);
  }, delay);
  if (typeof heavyTimer === "object" && heavyTimer && "unref" in heavyTimer) {
    heavyTimer.unref();
  }
}

export async function persistOwnerFarms(snapshot: OfflineSnapshot, email?: string) {
  const owner = normalizeOwnerEmail(email || snapshot.userEmail || "");
  const next = owner ? { ...snapshot, userEmail: owner } : snapshot;
  await saveLocalSnapshot(next, owner || undefined);
  if (!owner) return;
  scheduleHeavyBackup(next, owner);
}
