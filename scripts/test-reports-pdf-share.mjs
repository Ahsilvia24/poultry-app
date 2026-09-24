import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const shares = [];
const navStub = {
  standalone: true,
  canShare: (data) => Array.isArray(data?.files) && data.files.length > 0,
  share: async (data) => {
    if (data?.url) throw new Error("must not share a URL");
    shares.push(data);
  },
};
Object.defineProperty(globalThis, "navigator", { configurable: true, value: navStub });
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    matchMedia: () => ({ matches: true }),
    navigator: navStub,
  },
});

const { buildReportPdfBytes, downloadMortalityPdf, downloadReportPdf } = await import(
  join(root, "src/lib/exports/pdf.ts")
);
const { reportShareFilename } = await import(join(root, "src/lib/reports/share-filename.ts"));

assert.equal(reportShareFilename("Generator Hours", "Weylin Groom"), "Generator Hours Weylin Groom.pdf");
assert.equal(reportShareFilename("Generator Hours", "All Farms"), "Generator Hours All Farms.pdf");
assert.equal(reportShareFilename("Generator Hours"), "Generator Hours.pdf");
assert.equal(reportShareFilename("Field Log"), "Field Log.pdf");
assert.equal(
  reportShareFilename("Mortality by Percentage", "Oak Poultry"),
  "Mortality by Percentage Oak Poultry.pdf",
);
assert.equal(reportShareFilename("Mortality", "Weylin Groom"), "Mortality Weylin Groom.pdf");
assert.doesNotMatch(reportShareFilename("Generator Hours", "Weylin Groom"), /-/);
assert.doesNotMatch(reportShareFilename("Field Log"), /\d{5,}/);

function isPdf(bytes) {
  return Buffer.from(bytes.subarray(0, 5)).toString("latin1") === "%PDF-";
}

const fieldLogBytes = await buildReportPdfBytes({
  title: "Field Log - Alex",
  subtitle: "Sep 21 – Sep 27",
  filename: "field-log.pdf",
  orientation: "landscape",
  blocks: [
    {
      type: "table",
      headers: ["Monday Sep 21", "Tuesday Sep 22", "Wednesday Sep 23", "Thursday Sep 24", "Friday Sep 25", "Saturday Sep 26", "Sunday Sep 27"],
      rows: [
        ["Oak Poultry\nRoutine Service", "—", "Cedar Grove\nLFO", "", "", "", ""],
      ],
    },
  ],
});
assert.equal(isPdf(fieldLogBytes), true);

const generatorBytes = await buildReportPdfBytes({
  title: "Generator Hours",
  subtitle: "Last 28 days",
  filename: "generator-hours.pdf",
  blocks: [
    { type: "heading", text: "Oak Poultry" },
    {
      type: "table",
      title: "Gen 1",
      headers: ["Date", "Hours", "Exercised"],
      rows: [["September 24, 2026", "12.4", "0.5"]],
    },
  ],
});
assert.equal(isPdf(generatorBytes), true);

const mortalityBytes = await buildReportPdfBytes({
  title: "Mortality by Percentage",
  subtitle: "This flock",
  filename: "mortality-by-percentage.pdf",
  blocks: [
    {
      type: "table",
      headers: ["Farm", "Placed", "Total", "%"],
      rows: [["Oak Poultry", 18000, 42, "0.23"]],
    },
  ],
});
assert.equal(isPdf(mortalityBytes), true);

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const chartBytes = await buildReportPdfBytes({
  title: "Mortality by House",
  filename: "mortality-by-house.pdf",
  blocks: [{ type: "image", dataUrl: png, width: 200, height: 80 }],
});
assert.equal(isPdf(chartBytes), true);

assert.equal(await downloadReportPdf({
  title: "Field Log",
  filename: reportShareFilename("Field Log"),
  orientation: "landscape",
  blocks: [{ type: "table", headers: ["Monday"], rows: [["Oak Poultry\nRoutine Service"]] }],
}), "share");
assert.equal(await downloadReportPdf({
  title: "Generator Hours",
  filename: reportShareFilename("Generator Hours", "Weylin Groom"),
  blocks: [{ type: "heading", text: "Oak Poultry" }],
}), "share");
assert.equal(await downloadMortalityPdf({
  title: "Mortality",
  filename: reportShareFilename("Mortality", "Weylin Groom"),
  sections: [{ title: "Mortality by Percentage", headers: ["Farm", "%"], rows: [["Oak Poultry", "0.23"]] }],
}), "share");

assert.equal(shares.length, 3);
for (const share of shares) {
  assert.ok(!("url" in share));
  assert.ok(!("title" in share));
  assert.ok(!("text" in share));
  assert.equal(share.files[0].type, "application/pdf");
}
assert.equal(shares[0].files[0].name, "Field Log.pdf");
assert.equal(shares[1].files[0].name, "Generator Hours Weylin Groom.pdf");
assert.equal(shares[2].files[0].name, "Mortality Weylin Groom.pdf");

const field = read("src/components/FieldLogReport.tsx");
assert.match(field, /downloadReportPdf/);
assert.match(field, /reportShareFilename\("Field Log"\)/);
assert.match(field, /Share field log PDF/);
assert.doesNotMatch(field, /Date\.now\(\)/);
assert.doesNotMatch(field, /jspdf/i);

const generator = read("src/components/GeneratorLogReport.tsx");
assert.match(generator, /downloadReportPdf/);
assert.match(generator, /reportShareFilename\("Generator Hours", farmName \|\| REPORT_ALL_FARMS\)/);
assert.match(generator, /Share generator report PDF/);
assert.doesNotMatch(generator, /Date\.now\(\)/);
assert.match(read("src/components/ReportsView.tsx"), /farmName=\{farmId \? model\.farms\.find/);

const mortality = read("src/components/MortalityCharts.tsx");
assert.match(mortality, /downloadReportPdf/);
assert.match(mortality, /downloadMortalityPdf/);
assert.match(mortality, /reportShareFilename\("Mortality by Percentage", farmTitle\)/);
assert.match(mortality, /reportShareFilename\("Mortality by Date", farmTitle\)/);
assert.match(mortality, /reportShareFilename\("Mortality by House", farmTitle\)/);
assert.match(mortality, /reportShareFilename\("Cumulative Mortality by Bird Age", farmTitle\)/);
assert.match(mortality, /reportShareFilename\("Mortality", farmTitle\)/);
assert.match(mortality, /Share mortality by percentage PDF/);
assert.match(mortality, /Share mortality by date PDF/);
assert.match(mortality, /Share mortality by house PDF/);
assert.match(mortality, /Share cumulative mortality PDF/);
assert.doesNotMatch(mortality, /Date\.now\(\)\.pdf/);

const pdf = read("src/lib/exports/pdf.ts");
assert.match(pdf, /PDFDocument/);
assert.match(pdf, /sharePdfBytes/);
assert.match(pdf, /updateFieldAppearances: false/);
assert.doesNotMatch(pdf, /from "jspdf"/);
assert.doesNotMatch(pdf, /jspdf-autotable/);
assert.doesNotMatch(pdf, /autoTable/);

assert.match(read("src/lib/serviceForms/sharePdf.ts"), /shareFiles\(\[file\]\)/);
assert.match(read("src/lib/exports/share-file.ts"), /nav\.share\(\{ files \}\)/);

console.log("reports-pdf-share: ok");
