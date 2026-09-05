import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  formatBytes,
  isScheduleImportType,
  type ScheduleImportMeta,
  type ScheduleImportType,
} from "./schedule-import-types";

export type { ScheduleImportMeta, ScheduleImportType };
export { formatBytes, isScheduleImportType };

export const SCHEDULE_IMPORTS_DIR = path.join(
  process.cwd(),
  "uploads",
  "schedule-imports",
);

function metaPath(id: string) {
  return path.join(SCHEDULE_IMPORTS_DIR, `${id}.json`);
}

function filePath(storedName: string) {
  return path.join(SCHEDULE_IMPORTS_DIR, storedName);
}

export async function ensureScheduleImportsDir() {
  await mkdir(SCHEDULE_IMPORTS_DIR, { recursive: true });
}

export async function listScheduleImports(options?: {
  type?: ScheduleImportType;
  userId?: string;
}): Promise<ScheduleImportMeta[]> {
  await ensureScheduleImportsDir();
  const names = await readdir(SCHEDULE_IMPORTS_DIR);
  const metas: ScheduleImportMeta[] = [];

  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = await readFile(path.join(SCHEDULE_IMPORTS_DIR, name), "utf8");
      const parsed = JSON.parse(raw) as ScheduleImportMeta;
      if (!parsed?.id || !parsed?.storedName || !isScheduleImportType(parsed.importType)) {
        continue;
      }
      if (options?.type && parsed.importType !== options.type) continue;
      if (options?.userId && parsed.uploadedByUserId !== options.userId) continue;
      metas.push(parsed);
    } catch {
      // skip corrupt metadata
    }
  }

  return metas.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function saveScheduleImport(input: {
  id: string;
  importType: ScheduleImportType;
  originalName: string;
  storedName: string;
  mimeType: string;
  bytes: Buffer;
  uploadedByUserId: string;
}): Promise<ScheduleImportMeta> {
  await ensureScheduleImportsDir();

  const meta: ScheduleImportMeta = {
    id: input.id,
    importType: input.importType,
    originalName: input.originalName,
    storedName: input.storedName,
    mimeType: input.mimeType,
    sizeBytes: input.bytes.byteLength,
    uploadedAt: new Date().toISOString(),
    uploadedByUserId: input.uploadedByUserId,
  };

  await writeFile(filePath(input.storedName), input.bytes);
  await writeFile(metaPath(input.id), JSON.stringify(meta, null, 2), "utf8");
  return meta;
}

export async function getScheduleImport(
  id: string,
): Promise<{ meta: ScheduleImportMeta; absolutePath: string } | null> {
  try {
    const raw = await readFile(metaPath(id), "utf8");
    const meta = JSON.parse(raw) as ScheduleImportMeta;
    if (!meta?.storedName) return null;
    return { meta, absolutePath: filePath(meta.storedName) };
  } catch {
    return null;
  }
}

export function sanitizeFileName(name: string) {
  const base = path.basename(name).replace(/[^\w.\-()+ ]+/g, "_").trim();
  return base.slice(0, 120) || "schedule-import";
}
