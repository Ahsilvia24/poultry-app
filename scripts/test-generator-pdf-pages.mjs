import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { buildTextReportPdfBytes } = await import(join(root, "src/lib/exports/pdf.ts"));
const { buildGeneratorPdfBytes } = await import(
  join(root, "mobile/src/lib/reports/buildGeneratorPdf.ts")
);
const { extractTextItems } = await import("unpdf");

function columnFarm(name, rows, marker) {
  return {
    type: "columnGroups",
    heading: name,
    columnsPerRow: 4,
    groups: [
      {
        title: "Gen 1",
        headers: ["Date", "Hours", "Exercised"],
        rows: Array.from({ length: rows }, (_, index) => [`${marker}-${index}`, "1.0", "0.1"]),
      },
    ],
  };
}

function dateKey(index) {
  const day = new Date(Date.UTC(2024, 0, 1 + index));
  return day.toISOString().slice(0, 10);
}

function verticalFarm(name, rows, startIndex) {
  return {
    farmId: name,
    farmName: name,
    generators: [
      {
        key: "gen1Hours",
        label: "Gen 1",
        rows: Array.from({ length: rows }, (_, index) => ({
          logDate: dateKey(startIndex + index),
          hours: index + 1,
          exercised: 0.1,
        })),
      },
    ],
  };
}

async function readPages(bytes) {
  const { items } = await extractTextItems(bytes);
  return items.map((pageItems) => {
    const sorted = [...pageItems].filter((item) => item.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
    return {
      top: sorted[0]?.str ?? "",
      text: sorted.map((item) => item.str).join("\n"),
    };
  });
}

const website = await readPages(
  await buildTextReportPdfBytes({
    title: "Generator Hours",
    subtitle: "All logs",
    blocks: [columnFarm("Oak Poultry", 34, "Oak"), columnFarm("Cedar Grove", 4, "Cedar")],
  }),
);
assert.equal(website.length, 2, `website pages: ${website.length}`);
assert.equal(website[0].top, "Generator Hours");
assert.match(website[0].text, /Oak Poultry/);
assert.match(website[0].text, /Oak-0/);
assert.equal(website[1].top, "Cedar Grove");
assert.match(website[1].text, /Cedar-0/);
assert.doesNotMatch(website[1].text, /Oak-/);

const websiteContinued = await readPages(
  await buildTextReportPdfBytes({
    title: "Generator Hours",
    subtitle: "All logs",
    blocks: [columnFarm("Oak Poultry", 80, "Oak")],
  }),
);
assert.ok(websiteContinued.length >= 2);
assert.match(websiteContinued[0].text, /Oak-0/);
for (const page of websiteContinued) {
  assert.equal(page.top, page === websiteContinued[0] ? "Generator Hours" : "Oak Poultry");
}
assert.doesNotMatch(websiteContinued[1].text, /Oak-0/);
assert.match(websiteContinued.at(-1).text, /Oak-79/);

const separateHeading = await readPages(
  await buildTextReportPdfBytes({
    title: "Generator Hours",
    subtitle: "All logs",
    blocks: [
      { type: "heading", text: "Oak Poultry" },
      columnFarm("ignored", 34, "Oak"),
      { type: "heading", text: "Cedar Grove" },
      { ...columnFarm("ignored", 4, "Cedar"), heading: undefined },
    ],
  }),
);
assert.equal(separateHeading.length, 2);
assert.equal(separateHeading[1].top, "Cedar Grove");
assert.doesNotMatch(separateHeading[1].text, /Oak-/);

const mobile = await readPages(
  await buildGeneratorPdfBytes({
    title: "Generator Hours",
    subtitle: "All logs",
    farms: [verticalFarm("Oak Poultry", 40, 0), verticalFarm("Cedar Grove", 10, 200)],
  }),
);
assert.equal(mobile.length, 2, `mobile pages: ${mobile.length}\n${mobile.map((page) => page.top).join(" | ")}`);
assert.equal(mobile[0].top, "Generator Hours");
assert.match(mobile[0].text, /Oak Poultry/);
assert.match(mobile[0].text, /January 1, 2024/);
assert.equal(mobile[1].top, "Cedar Grove");
assert.match(mobile[1].text, /July 19, 2024/);
assert.doesNotMatch(mobile[1].text, /Oak Poultry/);
assert.doesNotMatch(mobile[1].text, /January 1, 2024/);

const mobileContinued = await readPages(
  await buildGeneratorPdfBytes({
    title: "Generator Hours",
    subtitle: "All logs",
    farms: [verticalFarm("Oak Poultry", 70, 0)],
  }),
);
assert.ok(mobileContinued.length >= 2, `mobile continued pages: ${mobileContinued.length}`);
assert.match(mobileContinued[0].text, /January 1, 2024/);
for (let index = 1; index < mobileContinued.length; index++) {
  assert.equal(mobileContinued[index].top, "Oak Poultry");
  assert.doesNotMatch(mobileContinued[index].text, /January 1, 2024/);
}

console.log("generator-pdf-pages: ok");
