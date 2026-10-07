import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServiceReportDraft } from "../src/lib/serviceForms/defaults.ts";
import {
  applyLiveHouseMortality,
  applyLiveHouseTemps,
  formForComplete,
} from "../src/lib/serviceForms/prefill.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const webPdf = read("src/lib/serviceForms/pdfFill.ts");
assert.match(webPdf, /coverWidget\(ctx, "Water column"\)/);
assert.match(webPdf, /setText\(ctx, "Water column", data\.waterColumnInches/);
assert.match(webPdf, /stay inside the cell, off the grid lines/);
assert.match(webPdf, /insetLeft = 1\.4/);
assert.match(webPdf, /insetRight = 2\.2/);
assert.match(webPdf, /insetTop = 1\.55/);

const expoPdf = read("mobile/src/lib/serviceForms/pdfFill.ts");
assert.match(expoPdf, /coverWidget\(ctx, "Water column"\)/);
assert.match(expoPdf, /setText\(ctx, "Water column", data\.waterColumnInches/);
assert.match(expoPdf, /stay inside the cell, off the grid lines/);
assert.match(expoPdf, /insetLeft = 1\.4/);
assert.match(expoPdf, /insetRight = 2\.2/);
assert.match(expoPdf, /insetTop = 1\.55/);

const webMap = JSON.parse(read("src/lib/serviceForms/maps/service-report-fields.json"));
assert.ok(webMap.fields["Water column"]?.widgets?.[0]);
const expoMap = JSON.parse(read("mobile/assets/service-forms/service-report-fields.json"));
assert.ok(expoMap.fields["Water column"]?.widgets?.[0]);

const webReport = read("src/components/serviceForms/ServiceReportFormView.tsx");
assert.doesNotMatch(webReport, /placeholder="4-6"/);
assert.match(webReport, /Pull temps/);
assert.match(webReport, /Pull mortality/);
assert.match(webReport, /formForComplete\(form, detail, editing\)/);

const expoReport = read("mobile/app/(tabs)/farms/[id]/service/report.tsx");
assert.doesNotMatch(expoReport, /placeholder="4-6"/);
assert.match(expoReport, /Pull temps/);
assert.match(expoReport, /Pull mortality/);

const webPlacement = read("src/components/serviceForms/PlacementFormView.tsx");
assert.doesNotMatch(webPlacement, /placeholder="4-6"/);
assert.match(webPlacement, /formForComplete\(form, detail, editing\)/);

const picker = read("src/components/serviceForms/ServiceFarmPicker.tsx");
assert.match(picker, /deleteServiceDraft/);
assert.doesNotMatch(picker, /fresh: "1"/);
assert.doesNotMatch(picker, /nav\.navigate\(href\)/);

const expoPicker = read("mobile/app/(tabs)/farms/[id]/service/index.tsx");
assert.match(expoPicker, /deleteServiceFormDraft\(farmId, form\.key\)/);
assert.doesNotMatch(expoPicker, /startKind\(form, true\)/);

const completeHook = read("mobile/src/lib/serviceForms/useServiceFarm.ts");
assert.match(completeHook, /formForComplete\(form, detail, Boolean\(serviceFormId\)\)/);

const server = read("src/app/actions/serviceForms.ts");
assert.match(server, /formForComplete\(form, context\.detail, Boolean\(input\.serviceFormId\)\)/);

const blank = createServiceReportDraft({
  houses: [
    {
      houseNumber: 1,
      age: "21",
      placed: "20000",
      weeks: ["", "", "", "", "", "", "", ""],
      currentTemp: "",
      mortalityToDate: "",
      binA: "",
      binB: "",
      litterTemp: "",
      ammoniaPpm: "",
    },
  ],
});
const live = {
  farm: { farmName: "Oak" },
  activeFlock: { flockNumber: "1" },
  houses: [
    {
      houseNumber: 1,
      ageDays: 21,
      placedBirdCount: 20000,
      cumulativeMortality: 40,
      hasMortalityEntries: true,
      weeklyMortality: [{ week: 1, total: 18, entered: true }],
      totalFanCFM: null,
      numberOfFans: null,
      loggedTemp: "78",
    },
  ],
};

const completed = formForComplete(blank, live, false);
assert.equal(completed.houses[0]?.currentTemp, "78");
assert.equal(completed.houses[0]?.mortalityToDate, "40");
assert.equal(completed.houses[0]?.weeks[0], "18");

const editingKeeps = formForComplete(
  { ...blank, houses: [{ ...blank.houses[0], currentTemp: "70", mortalityToDate: "10" }] },
  live,
  true,
);
assert.equal(editingKeeps.houses[0]?.currentTemp, "70");
assert.equal(editingKeeps.houses[0]?.mortalityToDate, "10");

const tempsOnly = applyLiveHouseTemps(
  { ...blank, houses: [{ ...blank.houses[0], currentTemp: "70", mortalityToDate: "10", weeks: ["4", "", "", "", "", "", "", ""] }] },
  live,
);
assert.equal(tempsOnly.houses[0]?.currentTemp, "78");
assert.equal(tempsOnly.houses[0]?.mortalityToDate, "10");
assert.equal(tempsOnly.houses[0]?.weeks[0], "4");

const mortOnly = applyLiveHouseMortality(
  { ...blank, houses: [{ ...blank.houses[0], currentTemp: "70", mortalityToDate: "10", weeks: ["4", "", "", "", "", "", "", ""] }] },
  live,
);
assert.equal(mortOnly.houses[0]?.currentTemp, "70");
assert.equal(mortOnly.houses[0]?.mortalityToDate, "40");
assert.equal(mortOnly.houses[0]?.weeks[0], "18");

const { writeFileSync, mkdirSync } = await import("node:fs");
const { spawnSync } = await import("node:child_process");
const { tmpdir } = await import("node:os");
const { buildServiceFormPdf } = await import(join(root, "src/lib/serviceForms/pdfFill.ts"));
const filled = createServiceReportDraft({ farmName: "Maple" });
filled.waterColumnInches = "4-5";
const built = await buildServiceFormPdf(filled);
const outDir = join(tmpdir(), "water-column-box");
mkdirSync(outDir, { recursive: true });
const pdfPath = join(outDir, "water-4-5.pdf");
writeFileSync(pdfPath, built.bytes);
const render = spawnSync("pdftoppm", ["-png", "-r", "200", "-f", "1", "-l", "1", pdfPath, join(outDir, "page")], {
  encoding: "utf8",
});
assert.equal(render.status, 0, render.stderr);
const pngPath = join(outDir, "page-1.png");

const scale = 200 / 72;
const png = spawnSync(
  "python3",
  [
    "-c",
    `
from PIL import Image
im = Image.open(${JSON.stringify(pngPath)}).convert("RGB")
s = ${scale}
page_h = 792
dark_top = 0
total_top = 0
for pdf_x in range(218, 255):
    img_x = pdf_x * s
    img_y = (page_h - 329.04) * s
    r, g, b = im.getpixel((int(round(img_x)), int(round(img_y))))
    total_top += 1
    if r < 90:
        dark_top += 1
ink = 0
for pdf_x in range(220, 236):
    img_x = pdf_x * s
    img_y = (page_h - 323) * s
    r, g, b = im.getpixel((int(round(img_x)), int(round(img_y))))
    if r < 90:
        ink += 1
print(dark_top, total_top, ink)
`,
  ],
  { encoding: "utf8" },
);
assert.equal(png.status, 0, png.stderr);
const [darkTop, totalTop, ink] = png.stdout.trim().split(" ").map(Number);
assert.ok(darkTop / totalTop > 0.85, `top box line wiped: ${darkTop}/${totalTop}`);
assert.ok(ink >= 2, "4-5 was not stamped in the water column box");

console.log("service-report-water-sync: ok");
