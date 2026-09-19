import { persistPhoneStorage, saveAutomaticBackup, saveLocalSnapshot } from "@/lib/offline/idb";
import { normalizeOwnerEmail } from "@/lib/offline/ownerEmail";
import {
  buildPhoneBackup,
  phoneBackupJson,
  writeOpfsBackup,
} from "@/lib/offline/phoneBackup";
import type { OfflineSnapshot } from "@/lib/offline/types";

export async function persistOwnerFarms(snapshot: OfflineSnapshot, email?: string) {
  const owner = normalizeOwnerEmail(email || snapshot.userEmail || "");
  const next = owner ? { ...snapshot, userEmail: owner } : snapshot;
  await saveLocalSnapshot(next, owner || undefined);
  if (!owner) return;
  const backup = buildPhoneBackup(next);
  await saveAutomaticBackup(owner, backup);
  await writeOpfsBackup(owner, phoneBackupJson(backup));
  await persistPhoneStorage();
}
