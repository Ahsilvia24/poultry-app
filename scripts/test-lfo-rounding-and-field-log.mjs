import assert from "node:assert/strict";

const { roundOrderLbs, roundReclaimLbs, snapAwayFrom500, resolveLfoFeedTiming } = await import(
  "../src/lib/lfo/calculate.ts"
);
const { defaultFieldLogRange } = await import("../src/lib/reports/field-log.ts");

assert.equal(snapAwayFrom500(16500), 16000);
assert.equal(snapAwayFrom500(16000), 16000);
assert.equal(roundOrderLbs(14500), 16000);
assert.equal(roundOrderLbs(14000), 16000);
assert.equal(roundOrderLbs(14501), 17000);
assert.equal(roundReclaimLbs(14500), 14000);
assert.equal(roundReclaimLbs(14501), 15000);

const timing = resolveLfoFeedTiming(4, 8);
assert.equal(timing.feedUpHoursBeforeCatch, 4);
assert.equal(timing.feedOffHoursBeforeCatch, 8);
const clamped = resolveLfoFeedTiming(10, 8);
assert.equal(clamped.feedOffHoursBeforeCatch, 15);

const saturday = defaultFieldLogRange(new Date(2026, 8, 12));
assert.equal(saturday.from, "2026-09-07");
assert.equal(saturday.to, "2026-09-12");
const monday = defaultFieldLogRange(new Date(2026, 8, 7));
assert.equal(monday.from, "2026-09-07");
assert.equal(monday.to, "2026-09-07");

console.log("lfo-rounding-and-field-log: ok");
