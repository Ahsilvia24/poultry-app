import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServiceReportDraft } from "../src/lib/serviceForms/defaults.ts";
import { recommendedWeekLabel, WEEK_OPTIONS } from "../src/lib/serviceForms/format.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.equal(WEEK_OPTIONS[0]?.value, "");
assert.equal(WEEK_OPTIONS[0]?.label, "Blank");
assert.equal(recommendedWeekLabel(""), "Blank");

for (const rel of [
  "src/components/serviceForms/ServiceReportFormView.tsx",
  "src/components/serviceForms/PlacementFormView.tsx",
  "mobile/app/(tabs)/farms/[id]/service/report.tsx",
  "mobile/app/(tabs)/farms/[id]/service/placement.tsx",
]) {
  const src = read(rel);
  assert.match(src, /minVentRecommendedWeek === ""/);
  assert.match(src, /label="ON"/);
  assert.match(src, /label="OFF"/);
  assert.match(src, /minVentRecommendedOn/);
  assert.match(src, /minVentRecommendedOff/);
  assert.ok(
    src.indexOf('label="ON"') < src.indexOf('label="OFF"'),
    `${rel} keeps ON left of OFF`,
  );
}

const webReport = read("src/components/serviceForms/ServiceReportFormView.tsx");
assert.match(
  webReport,
  /minVentRecommendedWeek === ""[\s\S]*label="ON"[\s\S]*minVentRecommendedOn[\s\S]*label="OFF"/,
);
assert.match(webReport, /applyRecommendedWeek\(v === "" \? "" : Number\(v\)\)/);

const { buildServiceFormPdf } = await import(join(root, "src/lib/serviceForms/pdfFill.ts"));
const form = createServiceReportDraft({ farmName: "Oak" });
form.minVentRecommendedWeek = "";
form.minVentRecommendedOn = "40";
form.minVentRecommendedOff = "260";
const built = await buildServiceFormPdf(form);
assert.ok(built.bytes.byteLength > 1000);
assert.match(read("src/lib/serviceForms/pdfFill.ts"), /stampMinVentSides\(ctx, "Text88", data\.minVentRecommendedOn/);

console.log("min-vent-blank-onoff: ok");
