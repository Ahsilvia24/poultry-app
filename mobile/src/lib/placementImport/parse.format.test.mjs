/**
 * Format-focused Placement PDF checks.
 * Farm/house counts may vary by week — assert shape, not a fixed list size.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const parseUrl = pathToFileURL(join(__dirname, "parse.ts")).href;
const {
  parsePlacementPdfText,
  groupPlacementFarms,
  summarizePlacementRows,
  assertWeeklyChickPlacementShape,
} = await import(parseUrl);

function fail(msg) {
  console.error("FAIL:", msg);
  process.exitCode = 1;
}

function ok(msg) {
  console.log("OK:", msg);
}

function checkFixture(label, text) {
  const rows = parsePlacementPdfText(text);
  const shapeErrors = assertWeeklyChickPlacementShape(rows);
  if (shapeErrors.length) {
    fail(`${label}: shape — ${shapeErrors.join("; ")}`);
    return;
  }
  const summary = summarizePlacementRows(rows);
  const farms = groupPlacementFarms(rows);
  // Complex must never win as the per-farm code when multiple farms exist.
  if (farms.some((f) => f.farmCode.toUpperCase() === "2601HV")) {
    fail(`${label}: Complex 2601HV used as farm code`);
    return;
  }
  if (summary.farmCount < 1 || summary.rowCount < 1) {
    fail(`${label}: empty parse`);
    return;
  }
  ok(
    `${label}: ${summary.farmCount} farms · ${summary.houseCount} houses · ${summary.birdsSent} birds`,
  );
}

const fixturesDir = join(__dirname, "fixtures");
checkFixture(
  "pdfkit",
  readFileSync(join(fixturesDir, "weekly-chick-placement-pdfkit.txt"), "utf8"),
);
checkFixture(
  "layout",
  readFileSync(join(fixturesDir, "weekly-chick-placement-layout.txt"), "utf8"),
);
checkFixture(
  "pdfkit-spaced-complex",
  readFileSync(
    join(fixturesDir, "weekly-chick-placement-pdfkit-spaced-complex.txt"),
    "utf8",
  ),
);

// Fewer farms: first ~6 PROJECTED blocks from the device extract still parse cleanly.
const pdfkit = readFileSync(
  join(fixturesDir, "weekly-chick-placement-pdfkit.txt"),
  "utf8",
);
const markers = [...pdfkit.matchAll(/12PROJECTED/g)];
if (markers.length >= 8) {
  const cut = markers[8].index;
  const partial = pdfkit.slice(0, cut);
  const rows = parsePlacementPdfText(partial);
  const summary = summarizePlacementRows(rows);
  const shapeErrors = assertWeeklyChickPlacementShape(rows);
  if (shapeErrors.length) fail(`partial-week: ${shapeErrors.join("; ")}`);
  else if (summary.farmCount < 2) fail(`partial-week: expected multiple farms, got ${summary.farmCount}`);
  else ok(`partial-week: ${summary.farmCount} farms · ${summary.rowCount} rows (variable count OK)`);
} else {
  fail("partial-week: fixture too short to slice");
}

// Build 109 regression: many PROJECTED rows + few simple anchors must NOT
// keep the tiny partial parse. expectedRows follows PROJECTED/complex anchors.
{
  const pdfkit = readFileSync(
    join(fixturesDir, "weekly-chick-placement-pdfkit.txt"),
    "utf8",
  );
  const { placementPdfExtractStats } = await import(parseUrl);
  // Pretend device saw only ~17 simple anchors by checking expectedRows logic
  // on a hybrid: full pdfkit text should still expect ~96 and parse ~96.
  const stats = placementPdfExtractStats(pdfkit);
  if (stats.expectedRows < 90) {
    fail(`expectedRows too low: ${stats.expectedRows}`);
  } else {
    const rows = parsePlacementPdfText(pdfkit);
    const summary = summarizePlacementRows(rows);
    if (summary.rowCount < 90) {
      fail(
        `build-109 regression: expected ~full sheet, got ${summary.rowCount} rows (expectedRows=${stats.expectedRows}, anchors=${stats.anchors})`,
      );
    } else {
      ok(
        `build-109 regression: expectedRows=${stats.expectedRows} → ${summary.farmCount} farms / ${summary.rowCount} rows`,
      );
    }
  }
}

if (!process.exitCode) console.log("All placement format checks passed.");
