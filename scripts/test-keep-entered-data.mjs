import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { applySettings } from "../src/lib/offline/applyLocal.ts";
import { pickPersonName, looksLikeEmail } from "../src/lib/person-name.ts";
import { withSavedServiceTech } from "../src/lib/serviceForms/defaults.ts";
import { mortalityDatesToClear } from "../src/lib/mortality/calculations.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.equal(looksLikeEmail("jeff@gmail.com"), true);
assert.equal(looksLikeEmail("Jeff Walden"), false);
assert.equal(pickPersonName("jeff@gmail.com", "Jeff Walden"), "Jeff Walden");
assert.equal(pickPersonName("jeff@gmail.com"), "");

const snapshot = {
  userName: "Jeff Walden",
  userEmail: "jeff@gmail.com",
  settings: null,
};
const afterAutofill = applySettings(snapshot, {
  name: "jeff@gmail.com",
  farmOrder: "age_desc",
  dailyMortalityWarningPct: 0.15,
  dailyMortalityCriticalPct: 0.3,
  sevenDayMortalityWarningPct: 1,
  sevenDayMortalityCriticalPct: 2,
  alertRisingThreeDays: true,
  appTimeZone: "America/Chicago",
  defaultMarketAgeDays: 52,
  notifyEmail: false,
  notifyInApp: true,
});
assert.equal(afterAutofill.userName, "Jeff Walden");

assert.deepEqual(
  withSavedServiceTech({ serviceTech: "Jeff Walden" }, "jeff@gmail.com"),
  { serviceTech: "Jeff Walden" },
);
assert.deepEqual(
  withSavedServiceTech({ serviceTech: "jeff@gmail.com" }, "Jeff Walden"),
  { serviceTech: "Jeff Walden" },
);
assert.deepEqual(
  withSavedServiceTech({ serviceTech: "" }, "jeff@gmail.com"),
  { serviceTech: "" },
);

assert.deepEqual(
  mortalityDatesToClear(
    [{ date: "2026-09-18", age: 30 }],
    [{ date: "2026-09-18", age: 36 }],
  ),
  [],
);

const farmDetail = read("src/lib/offline/selectFarmDetail.ts");
assert.doesNotMatch(farmDetail, /generatorLogs:[\s\S]*slice\(0, 20\)/);
assert.match(farmDetail, /b\.logDate\.slice\(0, 10\)\.localeCompare/);

const genUi = read("src/components/FarmGeneratorLogSection.tsx");
assert.doesNotMatch(genUi, /MAX_GENERATOR_LOGS_DISPLAY/);
assert.doesNotMatch(genUi, /slice\(0, MAX_GENERATOR/);

const ops = read("src/app/actions/ops.ts");
assert.doesNotMatch(ops, /pruneGeneratorLogs/);
assert.doesNotMatch(ops, /excessGeneratorHourCells/);

const settings = read("src/components/SettingsScreen.tsx");
assert.match(settings, /autoComplete="off"/);
assert.doesNotMatch(settings, /autoComplete="name"/);
assert.match(settings, /looksLikeEmail/);
assert.match(settings, /key=\{snapshot\?\.userId/);

const apply = read("src/lib/offline/applyLocal.ts");
assert.match(apply, /pickPersonName\(write\.name, snapshot\.userName\)/);

const service = read("src/lib/offline/selectServiceFarm.ts");
assert.match(service, /pickPersonName\(snapshot\.userName\)/);

const mort = read("src/components/MortalityEntryForm.tsx");
assert.match(mort, /age: r\.age/);
assert.match(mort, /age: entry\.birdAgeInDays/);

console.log("keep-entered-data: ok");
