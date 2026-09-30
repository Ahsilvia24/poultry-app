import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const field = read("src/components/FieldLogReport.tsx");
assert.match(field, /headerStyle: "plain"/);
assert.match(field, /downloadReportPdf/);
assert.doesNotMatch(field, /#047857/);
assert.doesNotMatch(field, /GREEN/);

const canvas = read("src/lib/exports/report-canvas.ts");
assert.match(canvas, /headerStyle === "plain"/);
assert.match(canvas, /#1c1917/);

const expo = read("mobile/src/lib/reports/buildFieldLogPdf.ts");
assert.doesNotMatch(expo, /#047857/);
assert.doesNotMatch(expo, /4 \/ 255/);
assert.match(expo, /color: ink/);

const { buildTextReportPdfBytes } = await import(join(root, "src/lib/exports/pdf.ts"));

const headers = [
  "Monday Sep 21",
  "Tuesday Sep 22",
  "Wednesday Sep 23",
  "Thursday Sep 24",
  "Friday Sep 25",
  "Saturday Sep 26",
  "Sunday Sep 27",
];
const rows = [["Oak Poultry\nRoutine Service", "—", "Cedar Grove\nLFO", "", "", "", ""]];

const plain = await buildTextReportPdfBytes({
  title: "Field Log",
  subtitle: "Sep 21 – Sep 27",
  orientation: "landscape",
  blocks: [{ type: "table", headerStyle: "plain", headers, rows }],
});
const filled = await buildTextReportPdfBytes({
  title: "Field Log",
  subtitle: "Sep 21 – Sep 27",
  orientation: "landscape",
  blocks: [{ type: "table", headers, rows }],
});

const greenFill = /0\.01\d+\s+0\.47\d+\s+0\.34\d+/;
assert.doesNotMatch(Buffer.from(plain).toString("latin1"), greenFill);
assert.match(Buffer.from(filled).toString("latin1"), greenFill);
assert.match(Buffer.from(plain).toString("latin1"), /Monday Sep 21/);
assert.match(Buffer.from(plain).toString("latin1"), /Oak Poultry/);
assert.match(Buffer.from(plain).toString("latin1"), /Routine Service/);

console.log("field-log-pdf-no-green: ok");
