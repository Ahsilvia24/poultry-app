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
const { pdfBytesFromJpegPages } = await import(join(root, "src/lib/exports/scan-pdf.ts"));
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

const tinyJpeg = Uint8Array.from(
  Buffer.from(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAAgACADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDzWiiitT8nCiiigAooooAKKKKAP//Z",
    "base64",
  ),
);
const scanPdf = await pdfBytesFromJpegPages([{ bytes: tinyJpeg, width: 612, height: 792 }]);
assert.equal(isPdf(scanPdf), true);
assert.match(Buffer.from(scanPdf).toString("latin1"), /DCTDecode|JFIF/);

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
      type: "columnGroups",
      columnsPerRow: 4,
      groups: [
        {
          title: "Gen 1",
          headers: ["Date", "Hours", "Exercised"],
          rows: [["September 24, 2026", "12.4", "0.5"]],
        },
        {
          title: "Gen 2",
          headers: ["Date", "Hours", "Exercised"],
          rows: [["September 24, 2026", "18.1", "0.4"]],
        },
        {
          title: "Gen 3",
          headers: ["Date", "Hours", "Exercised"],
          rows: [["September 24, 2026", "9.0", "0.2"]],
        },
        {
          title: "Gen 4",
          headers: ["Date", "Hours", "Exercised"],
          rows: [["September 24, 2026", "11.2", "0.3"]],
        },
        {
          title: "Gen 5",
          headers: ["Date", "Hours", "Exercised"],
          rows: [["September 24, 2026", "7.5", "0.1"]],
        },
      ],
    },
  ],
});
assert.equal(isPdf(generatorBytes), true);

const png =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const pagedMortality = await buildReportPdfBytes({
  title: "Mortality",
  filename: "Mortality.pdf",
  orientation: "landscape",
  blocks: [
    { type: "pageStart", title: "Mortality by Percentage", subtitle: "This flock" },
    {
      type: "table",
      headers: ["Farm", "Placed", "Total", "%"],
      rows: [["Oak Poultry", 18000, 42, "0.23"]],
    },
    { type: "pageStart", title: "Mortality by Date", subtitle: "This flock" },
    {
      type: "table",
      headers: ["House", "Sep 24", "Total"],
      rows: [["House 1", 3, 3]],
    },
    { type: "pageStart", title: "Mortality by House", subtitle: "This flock" },
    { type: "image", dataUrl: png, width: 200, height: 80 },
    { type: "pageStart", title: "Cumulative Mortality by Bird Age", subtitle: "This flock" },
    { type: "image", dataUrl: png, width: 200, height: 80 },
  ],
});
assert.equal(isPdf(pagedMortality), true);

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

const chartBytes = await buildReportPdfBytes({
  title: "Mortality by House",
  filename: "mortality-by-house.pdf",
  blocks: [{ type: "image", dataUrl: png, width: 200, height: 80 }],
});
assert.equal(isPdf(chartBytes), true);

// Phone path: rasterize pages and wrap JPEGs so Messages can MMS like a checklist.
const jpegBlob = new Blob([tinyJpeg], { type: "image/jpeg" });
function mockCanvas() {
  const ctx = {
    scale() {},
    fillRect() {},
    fillText() {},
    drawImage() {},
    measureText: (text) => ({ width: String(text).length * 6 }),
    font: "",
    fillStyle: "",
    textBaseline: "top",
  };
  return {
    width: 0,
    height: 0,
    getContext: () => ctx,
    toBlob: (cb) => {
      queueMicrotask(() => cb(jpegBlob));
    },
  };
}
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: {
    createElement: (tag) => {
      if (tag === "canvas") return mockCanvas();
      throw new Error(`unexpected element ${tag}`);
    },
  },
});

const scannedBytes = await buildReportPdfBytes({
  title: "Field Log",
  filename: "Field Log.pdf",
  blocks: [{ type: "heading", text: "Oak Poultry" }],
});
assert.equal(isPdf(scannedBytes), true);
assert.match(Buffer.from(scannedBytes).toString("latin1"), /DCTDecode|JFIF/);

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
  const sharedBytes = new Uint8Array(await share.files[0].arrayBuffer());
  assert.equal(isPdf(sharedBytes), true);
  assert.match(Buffer.from(sharedBytes).toString("latin1"), /DCTDecode|JFIF/);
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
assert.match(generator, /columnGroups/);
assert.match(generator, /GENERATOR_COLUMNS_PER_ROW/);
assert.match(generator, /reportShareFilename\("Generator Hours", farmName \|\| REPORT_ALL_FARMS\)/);
assert.match(generator, /Share generator report PDF/);
assert.doesNotMatch(generator, /Date\.now\(\)/);
assert.match(read("src/components/ReportsView.tsx"), /farmName=\{farmId \? model\.farms\.find/);

const mortality = read("src/components/MortalityCharts.tsx");
assert.match(mortality, /downloadReportPdf/);
assert.match(mortality, /pageStart/);
assert.match(mortality, /compactHouseAxisLabel/);
assert.match(mortality, /drawAgeLineChart/);
assert.match(mortality, /reportShareFilename\("Mortality by Percentage", farmTitle\)/);
assert.match(mortality, /reportShareFilename\("Mortality by Date", farmTitle\)/);
assert.match(mortality, /reportShareFilename\("Mortality by House", farmTitle\)/);
assert.match(mortality, /reportShareFilename\("Cumulative Mortality by Bird Age", farmTitle\)/);
assert.match(mortality, /reportShareFilename\("Mortality", farmTitle\)/);
assert.match(mortality, /Share mortality by percentage PDF/);
assert.match(mortality, /Share mortality by date PDF/);
assert.match(mortality, /Share mortality by house PDF/);
assert.match(mortality, /Share cumulative mortality PDF/);
assert.match(mortality, /Export PDF/);
assert.doesNotMatch(mortality, /Export CSV/);
assert.doesNotMatch(mortality, /downloadCsv/);
assert.doesNotMatch(mortality, /Date\.now\(\)\.pdf/);

const pdf = read("src/lib/exports/pdf.ts");
assert.match(pdf, /PDFDocument/);
assert.match(pdf, /sharePdfBytes/);
assert.match(pdf, /pdfBytesFromJpegPages/);
assert.match(pdf, /renderReportJpegPages/);
assert.match(read("src/lib/exports/report-canvas.ts"), /const DPR = 3/);
assert.match(read("src/lib/exports/scan-pdf.ts"), /quality = 0\.9/);
assert.match(pdf, /updateFieldAppearances: false/);
assert.doesNotMatch(pdf, /from "jspdf"/);
assert.doesNotMatch(pdf, /jspdf-autotable/);
assert.doesNotMatch(pdf, /autoTable/);

assert.match(read("src/lib/serviceForms/sharePdf.ts"), /shareFiles\(\[file\]\)/);
assert.match(read("src/lib/exports/share-file.ts"), /nav\.share\(\{ files \}\)/);

console.log("reports-pdf-share: ok");
