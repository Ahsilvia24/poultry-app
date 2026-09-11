"use server";

import { randomUUID } from "crypto";
import path from "path";
import { writeFile } from "fs/promises";
import { requireUser } from "@/lib/auth-helpers";
import { scheduleImportTypeLabel } from "@/lib/schedule-import-types";
import {
  formatBytes,
  isScheduleImportType,
  sanitizeFileName,
  saveScheduleImport,
  SCHEDULE_IMPORTS_DIR,
  type ScheduleImportMeta,
  type ScheduleImportType,
} from "@/lib/schedule-imports";
import { extractPlacementRows } from "@/lib/placement-import/extract";
import { extractCatchRows } from "@/lib/catch-import/extract";
import {
  buildCatchFarmPreview,
  buildPlacementFarmPreview,
} from "@/lib/schedule-import-preview";
import type { PlacementFarmPreview, PlacementRow } from "@/lib/placement-import/types";
import type { CatchFarmPreview, CatchRow } from "@/lib/catch-import/types";

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

export type PlacementUploadPreview = {
  farms: PlacementFarmPreview[];
  totalRows: number;
  rows: PlacementRow[];
};

export type CatchUploadPreview = {
  farms: CatchFarmPreview[];
  totalRows: number;
  rows: CatchRow[];
};

export type UploadScheduleImportResult =
  | {
      ok: true;
      example: ScheduleImportMeta;
      sizeLabel: string;
      placement?: PlacementUploadPreview;
      catchSchedule?: CatchUploadPreview;
    }
  | { ok: false; error: string };

async function cacheParsedRows(importId: string, kind: "placement" | "catch", rows: unknown) {
  try {
    await writeFile(
      path.join(SCHEDULE_IMPORTS_DIR, `${importId}.${kind}.json`),
      JSON.stringify(rows),
      "utf8",
    );
  } catch {
    // Preview/apply can still use rows returned to the client.
  }
}

export async function uploadScheduleImportAction(
  formData: FormData,
): Promise<UploadScheduleImportResult> {
  const user = await requireUser();
  if (!user.id) return { ok: false, error: "Unauthorized" };

  const typeRaw = String(formData.get("importType") ?? "");
  if (!isScheduleImportType(typeRaw)) {
    return { ok: false, error: "Choose Placement or Catch Schedule." };
  }
  const importType: ScheduleImportType = typeRaw;

  if (importType === "settlement") {
    return {
      ok: false,
      error: `${scheduleImportTypeLabel(importType)} import is not available.`,
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return {
      ok: false,
      error: `Choose a ${scheduleImportTypeLabel(importType)} file to upload.`,
    };
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

  let example: ScheduleImportMeta;
  try {
    example = await saveScheduleImport({
      id,
      importType,
      originalName,
      storedName,
      mimeType: file.type || "application/octet-stream",
      bytes,
      uploadedByUserId: user.id,
    });
  } catch {
    return { ok: false, error: "Could not save that file. Try again." };
  }

  // Read in this same request — Vercel /tmp is not shared across server actions.
  if (importType === "placement") {
    const rows = await extractPlacementRows({
      bytes,
      fileName: originalName,
      mimeType: file.type || undefined,
    });
    if (rows.length === 0) {
      return {
        ok: false,
        error:
          "Could not read any placement rows. Use a Weekly Chick Placement PDF or a spreadsheet with Date Placed, Farm Code, Farm Name, Flock Code, House No, and Number Sent.",
      };
    }
    await cacheParsedRows(id, "placement", rows);
    const farms = await buildPlacementFarmPreview(user.id, rows);
    return {
      ok: true,
      example,
      sizeLabel: formatBytes(example.sizeBytes),
      placement: { farms, totalRows: rows.length, rows },
    };
  }

  if (importType === "catch") {
    const rows = await extractCatchRows({
      bytes,
      fileName: originalName,
      mimeType: file.type || undefined,
    });
    if (rows.length === 0) {
      return {
        ok: false,
        error:
          "Could not read catch rows yet. Use a Kill/Catch Schedule PDF or spreadsheet with Catch Date / Ending Kill Date, Farm Name, and House.",
      };
    }
    await cacheParsedRows(id, "catch", rows);
    const farms = await buildCatchFarmPreview(user.id, rows);
    return {
      ok: true,
      example,
      sizeLabel: formatBytes(example.sizeBytes),
      catchSchedule: { farms, totalRows: rows.length, rows },
    };
  }

  return { ok: true, example, sizeLabel: formatBytes(example.sizeBytes) };
}
