import { shareFiles } from "@/lib/exports/share-file";
import {
  farmShareFilename,
  farmSharePdfBlocks,
  type FarmShareFieldKey,
  type FarmShareModel,
} from "@/lib/reports/farm-share";

/** SMS/MMS will send a photo to any phone. iMessage will not send a PDF to green-bubble texts. */
export function farmShareImageFilename(farmName: string): string {
  return farmShareFilename(farmName).replace(/\.pdf$/i, ".jpg");
}

export type FarmShareSheetRow = {
  text: string;
  kind: "title" | "heading" | "line";
};

export function farmShareSheetRows(
  model: FarmShareModel,
  fields: Iterable<FarmShareFieldKey>,
): FarmShareSheetRow[] {
  const rows: FarmShareSheetRow[] = [{ text: model.farmName, kind: "title" }];
  for (const block of farmSharePdfBlocks(model, fields)) {
    if (block.type !== "lines") continue;
    if (block.title) rows.push({ text: block.title, kind: "heading" });
    for (const line of block.lines) rows.push({ text: line, kind: "line" });
  }
  return rows;
}

function rowSizes(kind: FarmShareSheetRow["kind"]) {
  if (kind === "title") return { size: 44, weight: "800", gapBefore: 0, gapAfter: 28 };
  if (kind === "heading") return { size: 32, weight: "800", gapBefore: 28, gapAfter: 12 };
  return { size: 28, weight: "600", gapBefore: 8, gapAfter: 0 };
}

export async function farmShareImageFile(
  model: FarmShareModel,
  fields: Iterable<FarmShareFieldKey>,
): Promise<File> {
  if (typeof document === "undefined") {
    throw new Error("Data share needs the phone screen.");
  }
  const rows = farmShareSheetRows(model, fields);
  const width = 1080;
  const pad = 56;
  let y = pad;
  for (const row of rows) {
    const box = rowSizes(row.kind);
    y += box.gapBefore + box.size + box.gapAfter;
  }
  y += pad;

  const canvas = document.createElement("canvas");
  const dpr = 2;
  canvas.width = width * dpr;
  canvas.height = Math.ceil(y * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not draw the farm sheet.");
  ctx.scale(dpr, dpr);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, y);
  ctx.fillStyle = "#1c1917";
  ctx.textBaseline = "top";

  let cursor = pad;
  for (const row of rows) {
    const box = rowSizes(row.kind);
    cursor += box.gapBefore;
    ctx.font = `${box.weight} ${box.size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillText(row.text, pad, cursor, width - pad * 2);
    cursor += box.size + box.gapAfter;
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (next) => (next ? resolve(next) : reject(new Error("Could not make the photo."))),
      "image/jpeg",
      0.86,
    );
  });
  return new File([blob], farmShareImageFilename(model.farmName), { type: "image/jpeg" });
}

export async function shareFarmShareSheet(
  model: FarmShareModel,
  fields: Iterable<FarmShareFieldKey>,
) {
  const file = await farmShareImageFile(model, fields);
  return shareFiles([file]);
}
