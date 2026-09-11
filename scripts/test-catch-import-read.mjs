import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = join(root, "src/lib/catch-import/fixtures");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const {
  parseCatchPdfText,
  parseCatchSheetRows,
  groupCatchFarms,
  summarizeCatchRows,
  catchCellText,
} = await import(join(root, "src/lib/catch-import/parse.ts"));
const { extractCatchRows } = await import(join(root, "src/lib/catch-import/extract.ts"));
const { coerceCatchRows } = await import(join(root, "src/lib/catch-import/rows.ts"));

function check(label, rows, { farms, houses, dmd, red }) {
  const shape = summarizeCatchRows(rows);
  const grouped = groupCatchFarms(rows);
  assert.ok(rows.length >= houses, `${label}: rows ${rows.length} < ${houses}`);
  assert.equal(shape.farmCount, farms, `${label}: farms ${shape.farmCount}`);
  assert.ok(!grouped.some((f) => f.farmName === grouped.find((o) => o !== f)?.farmName && f.farmCode === "SHARED"));
  const dmdFarm = grouped.find((f) => /DMD/i.test(f.farmName));
  const redFarm = grouped.find((f) => /\bRED\b/i.test(f.farmName));
  assert.ok(dmdFarm, `${label}: missing DMD`);
  assert.ok(redFarm, `${label}: missing RED`);
  assert.notEqual(dmdFarm.key, redFarm.key, `${label}: DMD and RED collapsed`);
  assert.equal(dmdFarm.farmCode, dmd);
  assert.equal(redFarm.farmCode, red);
  assert.ok(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.catchDate)), `${label}: bad dates`);
  assert.ok(rows.some((r) => r.catchDate === "2026-08-03"), `${label}: 8/3/26`);
  console.log(`OK: ${label}: ${shape.farmCount} farms · ${shape.houseCount} houses · ${shape.rowCount} rows`);
}

const csv = readFileSync(join(fixtures, "kill-schedule-dual-column.csv"), "utf8")
  .trim()
  .split(/\r?\n/)
  .map((line) => line.split(","));
check("dual-column csv", parseCatchSheetRows(csv), {
  farms: 4,
  houses: 6,
  dmd: "3901FS",
  red: "3902HV",
});

check(
  "name-first pdf",
  parseCatchPdfText(readFileSync(join(fixtures, "kill-schedule-name-first.txt"), "utf8")),
  { farms: 4, houses: 6, dmd: "3901FS", red: "3902HV" },
);

check(
  "code-first pdf",
  parseCatchPdfText(readFileSync(join(fixtures, "kill-schedule-code-first.txt"), "utf8")),
  { farms: 4, houses: 6, dmd: "3901FS", red: "3902HV" },
);

check(
  "glued pdf",
  parseCatchPdfText(readFileSync(join(fixtures, "kill-schedule-glued.txt"), "utf8")),
  { farms: 4, houses: 6, dmd: "3901FS", red: "3902HV" },
);

assert.equal(catchCellText(new Date(2026, 7, 3)), "8/3/2026");
assert.equal(catchCellText("Mon Aug 03 2026 00:00:00 GMT+0000 (UTC)").startsWith("8/"), true);

const wb = XLSX.utils.book_new();
const aoa = [
  [
    "Ending Kill Date",
    "Farm Name",
    "Farm-Entity",
    "House",
    "Projected Head Sold",
    "Ending Kill Date",
    "Farm Name",
    "Farm-Entity",
    "House",
    "Projected Head Sold",
  ],
  [new Date(2026, 7, 3), "DMD FARMS", "3901FS", 1, 22000, new Date(2026, 7, 3), "RED FARMS", "3902HV", 1, 18000],
  [new Date(2026, 7, 3), "DMD FARMS", "3901FS", 2, 22000, new Date(2026, 7, 4), "RED FARMS", "3902HV", 2, 18000],
];
XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa, { cellDates: true }), "Week");
XLSX.utils.book_append_sheet(
  wb,
  XLSX.utils.aoa_to_sheet([
    ["Catch Date", "Farm Name", "Farm Code", "House"],
    ["8/5/26", "VAN FARM", "3906FS", 1],
  ]),
  "Week2",
);
const xlsxBytes = Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
const fromXlsx = await extractCatchRows({
  bytes: xlsxBytes,
  fileName: "Revised Kill Schedule.xlsx",
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
});
assert.ok(fromXlsx.length >= 4, `xlsx rows ${fromXlsx.length}`);
const xFarms = groupCatchFarms(fromXlsx);
assert.ok(xFarms.some((f) => f.farmCode === "3901FS"));
assert.ok(xFarms.some((f) => f.farmCode === "3902HV"));
assert.ok(
  xFarms.some((f) => f.farmCode === "3906FS"),
  "second workbook sheet should be read",
);
console.log(`OK: xlsx extract: ${fromXlsx.length} rows · ${xFarms.length} farms`);

const csvBytes = readFileSync(join(fixtures, "kill-schedule-dual-column.csv"));
const fromCsv = await extractCatchRows({
  bytes: csvBytes,
  fileName: "kill-schedule.csv",
  mimeType: "text/csv",
});
assert.equal(fromCsv.length, 6);

const coerced = coerceCatchRows(fromCsv);
assert.equal(coerced.length, fromCsv.length);

const upload = read("src/app/actions/schedule-import.ts");
assert.match(upload, /extractCatchRows/);
assert.match(upload, /catchSchedule: \{ farms, totalRows: rows.length, rows \}/);

const ui = read("src/components/DashboardScheduleImport.tsx");
assert.match(ui, /res\.catchSchedule/);
assert.match(ui, /rows: catchRows/);

const extract = read("src/lib/catch-import/extract.ts");
assert.match(extract, /extractPdfTextCandidates/);
assert.match(extract, /SheetNames/);
assert.match(extract, /catch \{\s*return \[\];\s*\}/);

console.log("catch-import-read: ok");
