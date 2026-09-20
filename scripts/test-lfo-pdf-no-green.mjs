import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const download = readFileSync(join(root, "src/lib/exports/lfo-pdf.ts"), "utf8");
const builder = readFileSync(join(root, "src/lib/exports/buildLfoPdf.ts"), "utf8");
const expo = readFileSync(join(root, "mobile/src/lib/reports/buildLfoPdf.ts"), "utf8");
const row = readFileSync(join(root, "src/components/SavedLfoRow.tsx"), "utf8");

assert.match(download, /buildLfoPdfBytes/);
assert.match(download, /downloadPdfBytes/);
assert.doesNotMatch(download, /downloadReportPdf/);
assert.doesNotMatch(download, /Field/);
assert.doesNotMatch(download, /autoTable/);

assert.match(builder, /LABEL_W = 136/);
assert.doesNotMatch(builder, /FIRST_PAGE_HOUSES/);
assert.match(builder, /HelveticaBold/);
assert.doesNotMatch(builder, /fillColor/);
assert.doesNotMatch(builder, /autoTable/);
assert.doesNotMatch(builder, /\[4, 120, 87\]/);

assert.match(expo, /LABEL_W = 136/);
assert.doesNotMatch(expo, /FIRST_PAGE_HOUSES/);
assert.doesNotMatch(expo, /fillColor/);

assert.match(row, /void downloadLfoPdf\(shareInventory\)/);

console.log("lfo-pdf-no-green: ok");
