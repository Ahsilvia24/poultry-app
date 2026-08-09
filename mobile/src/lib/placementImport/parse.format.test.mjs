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
  buildPlacementReviewIssues,
  renamePlacementFarm,
  patchPlacementRowAt,
  farmGroupKey,
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
  if (farms.some((f) => /FSP1|Ref\.|Wk\s*No/i.test(f.farmName))) {
    fail(`header junk farm name leaked: ${farms.map((f) => f.farmName).join(", ")}`);
  } else if (!farms.some((f) => f.farmName === "BLACKJACK MTN" && f.farmCode === "3821FS")) {
    fail("header junk case lost BLACKJACK MTN");
  } else {
    ok("header junk Ref/FSP1/Wk No rejected");
  }
}

// Offline review helpers: flag partial reads and allow local edits.
{
  const sample = [
    {
      farmCode: "3821FS",
      farmName: "BLACKJACK MTN",
      flockId: "3821FS",
      datePlaced: "2026-08-03",
      houseNo: 1,
      numberSent: 22200,
    },
    {
      farmCode: "3821FS",
      farmName: "BLACKJACK MTN",
      flockId: "3821FS",
      datePlaced: "2026-08-03",
      houseNo: 2,
      numberSent: 22200,
    },
  ];
  const issues = buildPlacementReviewIssues(sample, {
    chars: 1000,
    projected: 96,
    anchors: 17,
    complexAnchors: 0,
    expectedRows: 96,
  });
  if (!issues.some((i) => i.id === "partial_sheet")) {
    fail("offline review: expected partial_sheet issue");
  } else {
    const key = farmGroupKey("3821FS", "BLACKJACK MTN");
    const renamed = renamePlacementFarm(sample, key, "BLACK JACK", "3821FS");
    const patched = patchPlacementRowAt(renamed, 0, { numberSent: 24000 });
    if (
      patched[0].farmName !== "BLACK JACK" ||
      patched[0].numberSent !== 24000 ||
      patched[0].flockId !== "3821FS"
    ) {
      fail("offline review: edit helpers failed");
    } else {
      ok("offline review: partial flag + local edit helpers");
    }
  }
}

// Typed offline fix commands (no network).
{
  const { applyLocalPlacementInstructions } = await import(parseUrl);
  const rows = [
    {
      farmCode: "3821FS",
      farmName: "BLACKJACK MTN",
      flockId: "3821FS",
      datePlaced: "2026-08-03",
      houseNo: 1,
      numberSent: 22200,
    },
    {
      farmCode: "3807FS",
      farmName: "MERCY FARM",
      flockId: "3807FS",
      datePlaced: "2026-08-03",
      houseNo: 1,
      numberSent: 44000,
    },
  ];
  const removed = applyLocalPlacementInstructions(rows, "remove farm MERCY FARM");
  if (!removed || removed.rows.length !== 1 || removed.rows[0].farmName !== "BLACKJACK MTN") {
    fail("local AI instruction: remove farm failed");
  } else {
    const birds = applyLocalPlacementInstructions(
      removed.rows,
      "BLACKJACK MTN house 1 birds 24000",
    );
    if (!birds || birds.rows[0].numberSent !== 24000) {
      fail("local AI instruction: birds update failed");
    } else {
      ok("local typed fix commands (offline)");
    }
  }
}

if (!process.exitCode) console.log("All placement format checks passed.");
