import { emptyPhoneSnapshot } from "@/lib/offline/emptySnapshot";
import { normalizeOwnerEmail } from "@/lib/offline/ownerEmail";
import { OFFLINE_SNAPSHOT_VERSION, type OfflineSnapshot } from "@/lib/offline/types";

export const PHONE_BACKUP_FORMAT = "poultrytech-phone-backup" as const;
export const PHONE_BACKUP_VERSION = 1 as const;

export type PhoneBackup = {
  format: typeof PHONE_BACKUP_FORMAT;
  version: typeof PHONE_BACKUP_VERSION;
  exportedAt: string;
  email: string;
  snapshot: OfflineSnapshot;
};

export function farmCountInSnapshot(snapshot: OfflineSnapshot | null | undefined) {
  return snapshot?.farms?.filter((farm) => !farm.deletedAt).length ?? 0;
}

export function buildPhoneBackup(snapshot: OfflineSnapshot): PhoneBackup {
  return {
    format: PHONE_BACKUP_FORMAT,
    version: PHONE_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    email: normalizeOwnerEmail(snapshot.userEmail),
    snapshot,
  };
}

export function phoneBackupFileName(email: string, exportedAt = new Date()) {
  const stamp = exportedAt.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const who = normalizeOwnerEmail(email).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `poultrytech-${who || "farms"}-${stamp}.json`;
}

export function phoneBackupJson(backup: PhoneBackup) {
  return JSON.stringify(backup);
}

export function parsePhoneBackup(raw: unknown): PhoneBackup {
  if (!raw || typeof raw !== "object") throw new Error("That file is not a PoultryTech backup.");
  const data = raw as Partial<PhoneBackup> & { snapshot?: Partial<OfflineSnapshot> };
  if (data.format !== PHONE_BACKUP_FORMAT) {
    throw new Error("That file is not a PoultryTech backup.");
  }
  if (!data.snapshot || typeof data.snapshot !== "object") {
    throw new Error("That backup has no farms.");
  }
  const email = normalizeOwnerEmail(String(data.email || data.snapshot.userEmail || ""));
  if (!email.includes("@")) throw new Error("That backup has no email.");
  const snapshot = {
    ...emptyPhoneSnapshot({
      userId: String(data.snapshot.userId || `local:${email}`),
      userEmail: email,
      userName: String(data.snapshot.userName || email.split("@")[0] || "Tech"),
    }),
    ...data.snapshot,
    version: OFFLINE_SNAPSHOT_VERSION,
    userEmail: email,
  } as OfflineSnapshot;
  return {
    format: PHONE_BACKUP_FORMAT,
    version: PHONE_BACKUP_VERSION,
    exportedAt: String(data.exportedAt || new Date().toISOString()),
    email,
    snapshot,
  };
}

export function parsePhoneBackupText(text: string) {
  try {
    return parsePhoneBackup(JSON.parse(text) as unknown);
  } catch (error) {
    if (error instanceof Error && error.message.includes("PoultryTech")) throw error;
    throw new Error("Could not read that backup file.");
  }
}

export async function writeOpfsBackup(email: string, json: string) {
  try {
    const storage = navigator.storage;
    if (!storage?.getDirectory) return;
    const root = await storage.getDirectory();
    const dir = await root.getDirectoryHandle("poultrytech-backups", { create: true });
    const file = await dir.getFileHandle(
      `${normalizeOwnerEmail(email).replace(/[^a-z0-9]+/g, "-")}.json`,
      { create: true },
    );
    const writable = await file.createWritable();
    await writable.write(json);
    await writable.close();
  } catch {
    /* OPFS is extra. IndexedDB backups still keep the last copies. */
  }
}

export function downloadPhoneBackup(backup: PhoneBackup) {
  const json = phoneBackupJson(backup);
  const fileName = phoneBackupFileName(backup.email, new Date(backup.exportedAt));
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return { fileName, farmCount: farmCountInSnapshot(backup.snapshot) };
}

export async function sharePhoneBackup(backup: PhoneBackup) {
  const json = phoneBackupJson(backup);
  const fileName = phoneBackupFileName(backup.email, new Date(backup.exportedAt));
  const farmCount = farmCountInSnapshot(backup.snapshot);
  const file = new File([json], fileName, { type: "application/json" });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  if (typeof nav.canShare === "function" && nav.canShare({ files: [file] }) && nav.share) {
    await nav.share({ files: [file], title: "PoultryTech backup" });
    return { fileName, farmCount };
  }
  return downloadPhoneBackup(backup);
}
