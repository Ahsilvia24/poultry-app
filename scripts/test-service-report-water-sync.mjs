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

const expoPdf = read("mobile/src/lib/serviceForms/pdfFill.ts");
assert.match(expoPdf, /coverWidget\(ctx, "Water column"\)/);
assert.match(expoPdf, /setText\(ctx, "Water column", data\.waterColumnInches/);

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

console.log("service-report-water-sync: ok");
