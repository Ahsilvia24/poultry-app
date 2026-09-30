import assert from "node:assert/strict";
import { inflateSync } from "node:zlib";
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

function inflatePdf(bytes) {
  const raw = Buffer.from(bytes);
  const chunks = [];
  let from = 0;
  while (true) {
    const start = raw.indexOf(Buffer.from("stream\n"), from);
    if (start < 0) break;
    const end = raw.indexOf(Buffer.from("\nendstream"), start);
    if (end < 0) break;
    const payload = raw.subarray(start + "stream\n".length, end);
    try {
      chunks.push(inflateSync(payload).toString("latin1"));
    } catch {
      /* xref / object streams can use a different filter */
    }
    from = end + 1;
  }
  return chunks.join("\n");
}

function pdfText(content) {
  return [...content.matchAll(/<([0-9A-Fa-f]+)> Tj/g)]
    .map((match) => Buffer.from(match[1], "hex").toString("utf8"))
    .join("\n");
}

const greenFill = /0\.01\d+\s+0\.47\d+\s+0\.34\d+/;
const plainStream = inflatePdf(plain);
const filledStream = inflatePdf(filled);
assert.doesNotMatch(plainStream, greenFill);
assert.match(filledStream, greenFill);
assert.match(plainStream, /0\.11 0\.1 0\.09 rg/);
assert.doesNotMatch(plainStream, /1 1 1 rg/);
const plainText = pdfText(plainStream);
assert.match(plainText, /Monday Sep 21/);
assert.match(plainText, /Oak Poultry/);
assert.match(plainText, /Routine Service/);

console.log("field-log-pdf-no-green: ok");
