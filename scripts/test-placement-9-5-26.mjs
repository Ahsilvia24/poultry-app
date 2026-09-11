import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = readFileSync(
  join(root, "src/lib/placement-import/fixtures/weekly-chick-placement-9-5-26.txt"),
  "utf8",
);

const {
  parsePlacementPdfText,
  groupPlacementFarms,
  summarizePlacementRows,
  assertWeeklyChickPlacementShape,
  placementPdfExtractStats,
} = await import(join(root, "src/lib/placement-import/parse.ts"));

const stats = placementPdfExtractStats(fixture);
assert.equal(stats.expectedRows, 94, `expected 94 PROJECTED rows, got ${stats.expectedRows}`);

const rows = parsePlacementPdfText(fixture);
const shape = assertWeeklyChickPlacementShape(rows);
assert.deepEqual(shape, [], shape.join("; "));
assert.equal(rows.length, 94);

const summary = summarizePlacementRows(rows);
assert.equal(summary.farmCount, 21);
assert.equal(summary.houseCount, 94);
assert.ok(summary.birdsSent > 2_000_000);

const farms = groupPlacementFarms(rows);
assert.ok(!farms.some((f) => f.farmCode.toUpperCase() === "2601HV"), "Complex used as farm code");
assert.ok(rows.every((r) => r.flockId === r.farmCode), "flockId should equal farmCode");

const farm8 = farms.find((f) => f.farmCode === "3950FS");
assert.ok(farm8, "missing FARM 8 / 3950FS");
assert.equal(farm8.farmName, "FARM 8");
assert.deepEqual(farm8.houseNumbers, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

const jonathan = farms.find((f) => f.farmCode === "3862FS");
assert.ok(jonathan, "missing JONATHAN FARM");
assert.match(jonathan.farmName, /JONATHAN/i);
assert.equal(jonathan.houseNumbers.length, 8);

const upload = readFileSync(join(root, "src/app/actions/schedule-import.ts"), "utf8");
assert.match(upload, /extractPlacementRows/);
assert.match(upload, /Read in this same request/);
assert.match(upload, /placement: \{ farms, totalRows: rows.length, rows \}/);

const nextConfig = readFileSync(join(root, "next.config.ts"), "utf8");
assert.match(nextConfig, /serverExternalPackages/);
assert.match(nextConfig, /pdf-parse/);
assert.match(nextConfig, /outputFileTracingIncludes/);
assert.match(nextConfig, /pdfjs-dist\/legacy\/build/);

const extractSrc = readFileSync(join(root, "src/lib/pdf-text-extract.ts"), "utf8");
assert.match(extractSrc, /extractWithPdfJs/);
assert.match(extractSrc, /resolvePdfWorkerSrc/);
assert.match(extractSrc, /copyPdfBytes/);

const ui = readFileSync(join(root, "src/components/DashboardScheduleImport.tsx"), "utf8");
assert.match(ui, /res\.placement/);
assert.match(ui, /rows: placementRows/);

const extract = readFileSync(join(root, "src/lib/placement-import/extract.ts"), "utf8");
assert.match(extract, /extractPdfTextCandidates/);
assert.match(extract, /catch \{\s*return \[\];\s*\}/);

const pdfPath = join(root, "src/lib/placement-import/fixtures/weekly-chick-placement-9-5-26.pdf");
assert.equal(existsSync(pdfPath), true, "9-5-26 placement PDF fixture missing");
const { extractPlacementRows } = await import(join(root, "src/lib/placement-import/extract.ts"));
const { extractWithPdfJs } = await import(join(root, "src/lib/pdf-text-extract.ts"));
const pdfBytes = readFileSync(pdfPath);
const jsText = await extractWithPdfJs(pdfBytes);
assert.match(jsText, /PROJECTED/);
assert.match(jsText, /3950FS/);
const fromPdf = await extractPlacementRows({
  bytes: pdfBytes,
  fileName: "9-5-26 Placement Schedule (2).pdf",
  mimeType: "application/pdf",
});
assert.equal(fromPdf.length, 94, `PDF extract rows ${fromPdf.length}`);
const pdfFarms = groupPlacementFarms(fromPdf);
assert.equal(pdfFarms.length, 21);
console.log(`placement-9-5-26 PDF extract: ${fromPdf.length} rows · ${pdfFarms.length} farms`);

console.log(
  `placement-9-5-26: ${summary.farmCount} farms · ${summary.houseCount} houses · ${summary.birdsSent} birds`,
);
