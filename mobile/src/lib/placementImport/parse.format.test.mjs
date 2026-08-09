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
  placementPdfExtractStats,
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
  // Sheet flock column (FS26045) is ignored — flock id is the farm code.
  if (rows.some((r) => r.flockId !== r.farmCode)) {
    fail(`${label}: flockId should equal farmCode (ignore sheet flock column)`);
    return;
  }
  if (rows.some((r) => /^[A-Z]{2}\d{4,8}$/i.test(r.flockId))) {
    fail(`${label}: sheet flock code leaked into flockId`);
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
checkFixture(
  "pdfkit-sim",
  readFileSync(join(fixturesDir, "weekly-chick-placement-pdfkit-sim.txt"), "utf8"),
);
checkFixture(
  "device-sample",
  readFileSync(join(fixturesDir, "weekly-chick-placement-device-sample.txt"), "utf8"),
);
checkFixture(
  "pdfkit-address",
  readFileSync(join(fixturesDir, "weekly-chick-placement-pdfkit-address.txt"), "utf8"),
);

// Build 111 regression: Address between Name and Date/Zip must still yield ~full sheet.
{
  const addressText = readFileSync(
    join(fixturesDir, "weekly-chick-placement-pdfkit-address.txt"),
    "utf8",
  );
  const rows = parsePlacementPdfText(addressText);
  const summary = summarizePlacementRows(rows);
  const farms = groupPlacementFarms(rows);
  if (summary.rowCount < 90) {
    fail(
      `build-111 address regression: expected ~96 rows, got ${summary.rowCount} (${summary.farmCount} farms)`,
    );
  } else if (farms.some((f) => /\b(?:ROAD|HWY|DRIVE|Highway)\b/i.test(f.farmName))) {
    fail("build-111 address regression: farm name still contains address crumbs");
  } else {
    ok(
      `build-111 address regression: ${summary.farmCount} farms / ${summary.rowCount} rows (address stripped)`,
    );
  }
}

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

// Header crumbs must never become a farm name (device PDFKit glue).
{
  const junk = parsePlacementPdfText(
    "PROJECTED 2601HV Ref. FSP1 Wk No. 08/03/2026 72944 3821FS 22,200 FS26045 3 22,200 0 12 PROJECTED 2601HV BLACKJACK MTN 08/03/2026 72944 3821FS 24,300 FS26045 4 24,300",
  );
  const farms = groupPlacementFarms(junk);
  if (farms.some((f) => /FSP1|Ref\.|Wk\s*No|HVPP|Saturday/i.test(f.farmName))) {
    fail(`header junk farm name leaked: ${farms.map((f) => f.farmName).join(", ")}`);
  } else if (!farms.some((f) => f.farmName === "BLACKJACK MTN" && f.farmCode === "3821FS")) {
    fail("header junk case lost BLACKJACK MTN");
  } else {
    ok("header junk Ref/FSP1/Wk No rejected");
  }
}

// Full FSP1 / HVPP week banners are junk — ignore them entirely.
{
  const banner =
    "FSP1 Wk No. 31 WE Saturday, August 8, 2026 2601HV BLACKJACK MTN 08/03/2026 72944 3821FS 22,200 FS26045 3 22,200 0 12 PROJECTED " +
    "HVPP Wk 31 WE No. Saturday, August 8, 2026 2601HV MERCY FARM 08/03/2026 72830 3807FS 28,700 FS26045 4 28,700 0 13 PROJECTED";
  const farms = groupPlacementFarms(parsePlacementPdfText(banner));
  if (farms.some((f) => /FSP1|HVPP|Saturday|Wk|WE\b|No\./i.test(f.farmName))) {
    fail(`week banner leaked into farm name: ${farms.map((f) => f.farmName).join(", ")}`);
  } else if (
    !farms.some((f) => f.farmName === "BLACKJACK MTN") ||
    !farms.some((f) => f.farmName === "MERCY FARM")
  ) {
    fail(`week banner strip lost farms: ${farms.map((f) => f.farmName).join(", ")}`);
  } else {
    ok("FSP1/HVPP week banners ignored");
  }
}

// Spatial PDFKit column order (City/State before street; zip after birds).
{
  const spatial = readFileSync(
    join(__dirname, "fixtures/weekly-chick-placement-pdfkit-spatial.txt"),
    "utf8",
  );
  checkFixture("pdfkit-spatial", spatial);
  const summary = summarizePlacementRows(parsePlacementPdfText(spatial));
  const stats = placementPdfExtractStats(spatial);
  if (stats.projected < 90) {
    fail(`pdfkit-spatial: expected ~96 PROJECTED, got ${stats.projected}`);
  } else if (summary.farmCount < 18 || summary.rowCount < 80) {
    fail(
      `pdfkit-spatial: expected near-full sheet, got ${summary.farmCount} farms / ${summary.rowCount} rows`,
    );
  } else {
    ok(
      `pdfkit-spatial full-sheet: ${summary.farmCount} farms / ${summary.rowCount} rows (PROJECTED=${stats.projected})`,
    );
  }
}

if (!process.exitCode) console.log("All placement format checks passed.");
