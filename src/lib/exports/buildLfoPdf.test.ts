import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractText, getDocumentProxy } from "unpdf";
import { buildLfoSharePayload } from "../lfo/share-payload.ts";
import { buildLfoPdfBytes } from "./buildLfoPdf.ts";

const inventory = {
  farmName: "HAPPY CHICK",
  orderDate: "2026-09-09",
  orderTime: "15:30",
  consumptionRate: 0.45,
  calculatedAt: "2026-09-09T15:34:00",
  houses: [
    {
      houseId: "h1",
      houseNumber: 1,
      headCount: 28200,
      binAPounds: 3000,
      binBPounds: 4000,
      catchDate: "2026-09-11",
      catchTime: "08:00",
    },
  ],
};

function houseInventory(count: number, farmName: string) {
  return {
    farmName,
    orderDate: "2026-09-09",
    orderTime: "15:30",
    consumptionRate: 0.45,
    calculatedAt: "2026-09-09T15:34:00",
    houses: Array.from({ length: count }, (_, i) => ({
      houseId: `h${i + 1}`,
      houseNumber: i + 1,
      headCount: 28000 - i * 100,
      binAPounds: 16000 + i * 100,
      binBPounds: 17000,
      catchDate: "2026-09-11",
      catchTime: "08:00",
    })),
  };
}

function eightHouseInventory() {
  return houseInventory(8, "EIGHT HOUSE");
}

describe("buildLfoPdfBytes", () => {
  it("writes a black-and-white label PDF, not a Field/Value table", async () => {
    const payload = buildLfoSharePayload(inventory);
    const bytes = await buildLfoPdfBytes(payload);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    const pdf = await getDocumentProxy(Uint8Array.from(bytes));
    const extracted = await extractText(pdf, { mergePages: true });
    const text = extracted.text;
    assert.equal(header, "%PDF-");
    assert.ok(bytes.byteLength > 800);
    assert.match(text, /Last Feed Order/);
    assert.match(text, /HAPPY CHICK/);
    assert.match(text, /House 1/);
    assert.match(text, /Consumption rate/);
    assert.match(text, /Total Feed/);
    assert.match(text, /Bin A\/B \(lbs\)/);
    assert.match(text, /3,?000 \/ 4,?000/);
    assert.match(text, / @ /);
    assert.match(text, /lbs\/hr/);
    assert.match(text, /Sep 9, 2026 at 3:30pm/);
    assert.match(text, /Sep 11, 2026 at 8:00am/);
    assert.doesNotMatch(text, /\bField\b/);
    assert.doesNotMatch(text, /\bValue\b/);
    assert.doesNotMatch(text, / at save/);
    assert.doesNotMatch(text, /\bTotals\b/);
    assert.doesNotMatch(text, /Catch time/);
    assert.doesNotMatch(text, /Hourly consumption/);
    assert.doesNotMatch(text, /Bin A \(lbs\)/);
    const farmRows = payload.sections.flatMap((section) => section.rows).filter((row) => row.label === "Farm");
    assert.equal(farmRows.length, 0);
  });

  it("fits houses 1-8 on one page with house summary", async () => {
    const payload = buildLfoSharePayload(eightHouseInventory());
    const bytes = await buildLfoPdfBytes(payload);
    const pdf = await getDocumentProxy(Uint8Array.from(bytes));
    assert.equal(pdf.numPages, 1);
    const extracted = await extractText(pdf, { mergePages: true });
    const text = extracted.text;
    assert.match(text, /House summary/);
    assert.match(text, /H1-/);
    assert.match(text, /H8-/);
    assert.match(text, /Total Feed/);
    assert.match(text, /House 1/);
    assert.match(text, /House 8/);
    assert.doesNotMatch(text, /\bTotals\b/);
    assert.doesNotMatch(text, /Hourly consumption/);
  });

  it("puts leftover house summaries at the bottom of later pages", async () => {
    const payload = buildLfoSharePayload(houseInventory(12, "TWELVE HOUSE"));
    const bytes = await buildLfoPdfBytes(payload);
    const pdf = await getDocumentProxy(Uint8Array.from(bytes));
    assert.equal(pdf.numPages, 2);
    const extracted = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
    assert.match(pages[0] ?? "", /House summary/);
    assert.match(pages[0] ?? "", /H1-/);
    assert.match(pages[0] ?? "", /H8-/);
    assert.doesNotMatch(pages[0] ?? "", /H9-/);
    assert.match(pages[1] ?? "", /House 9/);
    assert.match(pages[1] ?? "", /House 12/);
    assert.match(pages[1] ?? "", /House summary/);
    assert.match(pages[1] ?? "", /H9-/);
    assert.match(pages[1] ?? "", /H12-/);
  });
});
