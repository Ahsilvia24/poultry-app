"use server";

import { randomUUID } from "crypto";
import path from "path";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { scheduleImportTypeLabel } from "@/lib/schedule-import-types";
import {
  formatBytes,
  isScheduleImportType,
  sanitizeFileName,
  saveScheduleImport,
  type ScheduleImportMeta,
  type ScheduleImportType,
} from "@/lib/schedule-imports";

const MAX_BYTES = 20 * 1024 * 1024;

const ALLOWED_EXT = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".heic",
  ".gif",
  ".csv",
  ".xls",
  ".xlsx",
  ".txt",
]);

export type UploadScheduleImportResult =
  | { ok: true; example: ScheduleImportMeta; sizeLabel: string }
  | { ok: false; error: string };

export async function uploadScheduleImportAction(
  formData: FormData,
): Promise<UploadScheduleImportResult> {
  const user = await requireUser();
  if (!user.id) return { ok: false, error: "Unauthorized" };

  const typeRaw = String(formData.get("importType") ?? "");
  if (!isScheduleImportType(typeRaw)) {
    return { ok: false, error: "Choose Placement, Catch Schedule, or Settlements." };
  }
  const importType: ScheduleImportType = typeRaw;

  // Placement first — other types are wired in the UI but not parsed yet.
  if (importType !== "placement") {
    return {
      ok: false,
      error: `${scheduleImportTypeLabel(importType)} import comes next. Start with Placement.`,
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a Placement file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `File is too large (max ${formatBytes(MAX_BYTES)}).` };
  }

  const originalName = sanitizeFileName(file.name || "placement-import");
  const ext = path.extname(originalName).toLowerCase();
  if (ext && !ALLOWED_EXT.has(ext)) {
    return {
      ok: false,
      error: "Unsupported file type. Use PDF, image, spreadsheet, or text.",
    };
  }

  const id = randomUUID();
  const storedName = `${importType}-${id}${ext || ""}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const example = await saveScheduleImport({
    id,
    importType,
    originalName,
    storedName,
    mimeType: file.type || "application/octet-stream",
    bytes,
    uploadedByUserId: user.id,
  });

  revalidatePath("/");
  return { ok: true, example, sizeLabel: formatBytes(example.sizeBytes) };
}
