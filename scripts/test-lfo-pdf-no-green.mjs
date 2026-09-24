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
assert.match(download, /sharePdfBytes/);
assert.doesNotMatch(download, /downloadPdfBytes/);
assert.doesNotMatch(download, /downloadReportPdf/);
assert.doesNotMatch(download, /Field/);
assert.doesNotMatch(download, /autoTable/);

assert.match(builder, /LABEL_VALUE_GAP = 10/);
assert.match(builder, /rowLayout/);
assert.match(builder, /drawLeaders/);
assert.match(builder, /colValueX/);
assert.doesNotMatch(builder, /LABEL_W/);
assert.match(builder, /SUMMARY_STACK_LEN = 4/);
assert.match(builder, /HEADER_SUMMARY_MAX_HOUSE = 8/);
assert.match(builder, /splitSummaryStacks/);
assert.doesNotMatch(builder, /SUMMARY_COLS/);
assert.doesNotMatch(builder, /FIRST_PAGE_HOUSES/);
assert.match(builder, /HelveticaBold/);
assert.doesNotMatch(builder, /fillColor/);
assert.doesNotMatch(builder, /autoTable/);
assert.doesNotMatch(builder, /\[4, 120, 87\]/);

assert.match(expo, /LABEL_VALUE_GAP = 10/);
assert.match(expo, /rowLayout/);
assert.match(expo, /drawLeaders/);
assert.match(expo, /colValueX/);
assert.doesNotMatch(expo, /LABEL_W/);
assert.match(expo, /SUMMARY_STACK_LEN = 4/);
assert.match(expo, /HEADER_SUMMARY_MAX_HOUSE = 8/);
assert.match(expo, /splitSummaryStacks/);
assert.doesNotMatch(expo, /SUMMARY_COLS/);
assert.doesNotMatch(expo, /FIRST_PAGE_HOUSES/);
assert.doesNotMatch(expo, /fillColor/);

assert.match(row, /shareLfoPdf\(shareInventory\)/);
assert.match(row, /holdRowLink/);
assert.doesNotMatch(row, /downloadLfoPdf/);

console.log("lfo-pdf-no-green: ok");
