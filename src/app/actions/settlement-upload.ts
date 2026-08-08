"use server";

import { randomUUID } from "crypto";
import path from "path";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import {
  formatBytes,
  sanitizeFileName,
  saveSettlementExample,
  type SettlementExampleMeta,
} from "@/lib/settlement-examples";

const MAX_BYTES = 20 * 1024 * 1024;

const ALLOWED_EXT = new Set([
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".heic",
  ".gif",
  ".tif",
  ".tiff",
  ".csv",
  ".xls",
  ".xlsx",
  ".doc",
  ".docx",
  ".txt",
]);

export type UploadSettlementExampleResult =
  | { ok: true; example: SettlementExampleMeta; sizeLabel: string }
  | { ok: false; error: string };

export async function uploadSettlementExampleAction(
  formData: FormData,
): Promise<UploadSettlementExampleResult> {
  const user = await requireUser();
  if (!user.id) {
    return { ok: false, error: "Unauthorized" };
  }
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a settlement example file to upload." };
  }

  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `File is too large (max ${formatBytes(MAX_BYTES)}).`,
    };
  }

  const originalName = sanitizeFileName(file.name || "settlement-example");
  const ext = path.extname(originalName).toLowerCase();
  if (ext && !ALLOWED_EXT.has(ext)) {
    return {
      ok: false,
      error: "Unsupported file type. Use PDF, image, spreadsheet, or text.",
    };
  }

  const id = randomUUID();
  const storedName = `${id}${ext || ""}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const example = await saveSettlementExample({
    id,
    originalName,
    storedName,
    mimeType: file.type || "application/octet-stream",
    bytes,
    uploadedByUserId: user.id,
  });

  revalidatePath("/settlement");
  return { ok: true, example, sizeLabel: formatBytes(example.sizeBytes) };
}
