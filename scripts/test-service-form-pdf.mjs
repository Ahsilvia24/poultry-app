import assert from "node:assert/strict";
import { createServiceReportDraft } from "../src/lib/serviceForms/defaults.ts";
import { formatServiceShortDate } from "../src/lib/serviceForms/format.ts";
import { lastLoggedGeneratorHours, withPrebroodLoggedHours } from "../src/lib/generator/format.ts";
import { buildServiceFormPdf } from "../src/lib/serviceForms/pdfFill.ts";

assert.equal(formatServiceShortDate("2026-09-10"), "10 Sep 26");

const hours = lastLoggedGeneratorHours([
  { gen1Hours: 12.5, gen2Hours: null, gen3Hours: null, gen4Hours: null },
  { gen1Hours: 10, gen2Hours: 8, gen3Hours: null, gen4Hours: null },
]);
assert.equal(hours.gen1Hours, 12.5);
assert.equal(hours.gen2Hours, 8);

const stamped = withPrebroodLoggedHours(
  { generatorHoursCheckedOk: "yes", generatorHoursLogged: "" },
  hours,
);
assert.match(stamped.generatorHoursLogged, /12\.5/);
assert.match(stamped.generatorHoursLogged, /8/);

const form = createServiceReportDraft({
  farmName: "North Ridge",
  farmNumber: "12",
  flockNumber: "F1",
  serviceTech: "Alex",
  houses: [
    {
      houseNumber: 1,
      age: "21",
      placed: "20000",
      weeks: ["10", "", "", "", "", "", "", ""],
      currentTemp: "78",
      mortalityToDate: "40",
      binA: "",
      binB: "",
      litterTemp: "",
      ammoniaPpm: "",
    },
  ],
});
form.comments = "Vent doors look good.";
form.feederHeightOk = "yes";

const pdf = await buildServiceFormPdf(form);
assert.ok(pdf.bytes.byteLength > 1000);
assert.match(pdf.filename, /Service-Report-North-Ridge/);
assert.equal(pdf.bytes[0], 0x25); // %PDF

console.log("service-form-pdf: ok", pdf.filename, pdf.bytes.byteLength);
