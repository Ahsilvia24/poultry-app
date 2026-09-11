import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const ocr = read("src/lib/pdf-ocr.ts");
assert.match(ocr, /if \(process\.env\.VERCEL\) return ""/);
assert.match(ocr, /catch \{\s*return "";\s*\}/);

const upload = read("src/app/actions/schedule-import.ts");
assert.doesNotMatch(upload, /revalidatePath/);
assert.match(upload, /Could not save that file/);
assert.match(upload, /extractPlacementRows/);

const placement = read("src/app/actions/placement-import.ts");
assert.match(placement, /Could not read that placement file/);

const catchAction = read("src/app/actions/catch-import.ts");
assert.match(catchAction, /Could not read that catch file/);

const placeExtract = read("src/lib/placement-import/extract.ts");
assert.match(placeExtract, /catch \{\s*return \[\];\s*\}/);

const pdfExtract = read("src/lib/pdf-text-extract.ts");
assert.match(pdfExtract, /extractWithUnpdf/);
assert.match(pdfExtract, /extractWithPdfJs/);
assert.match(pdfExtract, /copyPdfBytes/);

const catchExtract = read("src/lib/catch-import/extract.ts");
assert.match(catchExtract, /catch \{\s*return \[\];\s*\}/);

console.log("placement-upload-error: ok");
