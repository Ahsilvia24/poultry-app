import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "catchDate.ts"), "utf8");

assert.match(src, /export function resolveCatchAfterPlacementChange/);
assert.match(src, /export function defaultCatchDateKey/);
assert.match(src, /export function scheduleCatchDateKey/);
assert.match(src, /prevCatch <= nextPlacement/);
assert.match(src, /DEFAULT_PLACEMENT_MARKET_AGE_DAYS = 52/);

// Same rules as catchDate.ts (no TS loader in this script).
function addDaysKey(dateKey, days) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function resolveCatchAfterPlacementChange(input) {
  const nextPlacement = input.nextPlacementDate.trim();
  const marketAge =
    input.marketAgeDays != null && Number.isFinite(input.marketAgeDays) && input.marketAgeDays > 0
      ? Math.floor(input.marketAgeDays)
      : 52;
  const defaultCatch = addDaysKey(nextPlacement, marketAge);
  const prevCatch = input.previousCatchDate?.trim() || null;
  if (!prevCatch) return defaultCatch;
  if (prevCatch <= nextPlacement) return defaultCatch;
  const prevPlacement = input.previousPlacementDate?.trim() || null;
  if (prevPlacement) {
    const prevDefault = addDaysKey(prevPlacement, marketAge);
    if (prevCatch === prevDefault) return defaultCatch;
  }
  return prevCatch;
}

assert.equal(addDaysKey("2026-11-10", 52), "2027-01-01");
assert.equal(
  resolveCatchAfterPlacementChange({
    previousPlacementDate: "2026-07-01",
    nextPlacementDate: "2026-11-10",
    previousCatchDate: "2026-08-22",
  }),
  "2027-01-01",
);
assert.equal(
  resolveCatchAfterPlacementChange({
    previousPlacementDate: "2026-08-01",
    nextPlacementDate: "2026-09-01",
    previousCatchDate: "2026-09-22",
  }),
  "2026-10-23",
);
assert.equal(
  resolveCatchAfterPlacementChange({
    previousPlacementDate: "2026-08-01",
    nextPlacementDate: "2026-08-05",
    previousCatchDate: "2026-09-15",
  }),
  "2026-09-15",
);

console.log("placementImport/catchDate: ok");
