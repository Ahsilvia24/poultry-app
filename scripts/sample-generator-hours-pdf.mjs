import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildTextReportPdfBytes } from "../src/lib/exports/pdf.ts";
import {
  formatGeneratorReportDateShort,
  GENERATOR_COLUMNS_PER_ROW,
} from "../src/lib/reports/generator-log.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = "/opt/cursor/artifacts";
mkdirSync(outDir, { recursive: true });

function gen(label, hours, exercised) {
  return {
    title: label,
    headers: ["Date", "Hours", "Exercised"],
    rows: [
      [formatGeneratorReportDateShort("2026-09-24"), hours, exercised],
      [
        formatGeneratorReportDateShort("2026-09-17"),
        String((Number(hours) - Number(exercised)).toFixed(1)),
        exercised,
      ],
      [
        formatGeneratorReportDateShort("2026-09-10"),
        String((Number(hours) - Number(exercised) * 2).toFixed(1)),
        exercised,
      ],
    ],
  };
}

const bytes = await buildTextReportPdfBytes({
  title: "Generator Hours",
  subtitle: "Last 28 days",
  filename: "Generator Hours Oak Poultry.pdf",
  blocks: [
    { type: "heading", text: "Oak Poultry" },
    {
      type: "columnGroups",
      columnsPerRow: GENERATOR_COLUMNS_PER_ROW,
      groups: [
        gen("Gen 1", "96.6", "0.8"),
        gen("Gen 2", "114.7", "0.9"),
        gen("Gen 3", "88.2", "0.4"),
        gen("Gen 4", "101.3", "0.6"),
        gen("Gen 5", "76.1", "0.3"),
        gen("Gen 6", "82.4", "0.5"),
      ],
    },
  ],
});

const dest = join(outDir, "generator-hours-sample.pdf");
writeFileSync(dest, bytes);
console.log(`wrote ${dest} (${bytes.length} bytes)`);
console.log(`also see ${join(root, "scripts/sample-generator-hours-pdf.mjs")}`);
