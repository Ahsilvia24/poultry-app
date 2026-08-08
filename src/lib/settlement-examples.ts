import { mkdir, readdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  formatBytes,
  type SettlementExampleMeta,
} from "@/lib/settlement-example-types";

export type { SettlementExampleMeta };
export { formatBytes };

export const SETTLEMENT_EXAMPLES_DIR = path.join(
  process.cwd(),
  "uploads",
  "settlement-examples",
);

function metaPath(id: string) {
  return path.join(SETTLEMENT_EXAMPLES_DIR, `${id}.json`);
}

function filePath(storedName: string) {
  return path.join(SETTLEMENT_EXAMPLES_DIR, storedName);
}

export async function ensureSettlementExamplesDir() {
  await mkdir(SETTLEMENT_EXAMPLES_DIR, { recursive: true });
}

export async function listSettlementExamples(): Promise<SettlementExampleMeta[]> {
  await ensureSettlementExamplesDir();
  const names = await readdir(SETTLEMENT_EXAMPLES_DIR);
  const metas: SettlementExampleMeta[] = [];

  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = await readFile(path.join(SETTLEMENT_EXAMPLES_DIR, name), "utf8");
      const parsed = JSON.parse(raw) as SettlementExampleMeta;
      if (parsed?.id && parsed?.storedName) metas.push(parsed);
    } catch {
      // skip corrupt metadata
    }
  }

  return metas.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
}

export async function saveSettlementExample(input: {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  bytes: Buffer;
  uploadedByUserId: string;
}): Promise<SettlementExampleMeta> {
  await ensureSettlementExamplesDir();

  const meta: SettlementExampleMeta = {
    id: input.id,
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

export async function getSettlementExample(
  id: string,
): Promise<{ meta: SettlementExampleMeta; absolutePath: string } | null> {
  try {
    const raw = await readFile(metaPath(id), "utf8");
    const meta = JSON.parse(raw) as SettlementExampleMeta;
    if (!meta?.storedName) return null;
    return { meta, absolutePath: filePath(meta.storedName) };
  } catch {
    return null;
  }
}

export function sanitizeFileName(name: string) {
  const base = path.basename(name).replace(/[^\w.\-()+ ]+/g, "_").trim();
  return base.slice(0, 120) || "settlement-example";
}
