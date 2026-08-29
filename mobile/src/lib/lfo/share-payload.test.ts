import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildLfoSharePayload } from "./share-payload.ts";
import { buildLfoPdfBytes } from "../reports/buildLfoPdf.ts";

const inventory = {
  farmName: "Sunrise 1",
  orderDate: "2026-08-29",
  orderTime: "17:00",
  consumptionRate: 0.42,
  calculatedAt: "2026-08-29T17:12:00",
  notes: "Call mill before 6",
  houses: [
    {
      houseId: "h1",
      houseNumber: 1,
      headCount: 28000,
      binAPounds: 12000,
      binBPounds: 4000,
      catchDate: "2026-09-05",
      catchTime: "06:00",
    },
    {
      houseId: "h2",
      houseNumber: 2,
      headCount: 27500,
      binAPounds: 22000,
      binBPounds: 18000,
      catchDate: "2026-09-06",
      catchTime: "22:00",
    },
  ],
};

describe("buildLfoSharePayload", () => {
  it("includes every saved LFO field, not just house summary lines", () => {
    const payload = buildLfoSharePayload(inventory);
    const labels = payload.sections.flatMap((section) =>
      section.rows.map((row) => row.label),
    );
    const values = payload.sections.flatMap((section) =>
      section.rows.map((row) => row.value),
    );

    assert.equal(payload.title, "Last Feed Order — Sunrise 1");
    assert.match(payload.subtitle, /8-29-2026/);
    assert.match(payload.subtitle, /5:00 PM/);
    assert.ok(labels.includes("Farm"));
    assert.ok(labels.includes("Order date"));
    assert.ok(labels.includes("Order time"));
    assert.ok(labels.includes("Consumption rate"));
    assert.ok(labels.includes("Hours measured from"));
    assert.ok(labels.includes("Head counts as of"));
    assert.ok(labels.includes("Notes"));
    assert.ok(labels.includes("Bin A (lbs)"));
    assert.ok(labels.includes("Bin B (lbs)"));
    assert.ok(labels.includes("Catch date"));
    assert.ok(labels.includes("Catch time"));
    assert.ok(labels.includes("Feed up (−5)"));
    assert.ok(labels.includes("Feed off (−10)"));
    assert.ok(labels.includes("Hours until feed off"));
    assert.ok(labels.includes("Hourly consumption"));
    assert.ok(labels.includes("Feed used until off"));
    assert.ok(labels.includes("Head count"));
    assert.ok(values.some((value) => value.includes("0.42")));
    assert.ok(values.some((value) => /12,?000/.test(value)));
    assert.ok(values.some((value) => /28,?000/.test(value)));
    assert.ok(values.some((value) => value.includes("Call mill before 6")));
    assert.ok(payload.sections.some((section) => section.title === "House 1"));
    assert.ok(payload.sections.some((section) => section.title === "House 2"));
    assert.ok(payload.sections.some((section) => section.title === "Totals"));
    assert.ok(payload.houseSummaryLines.length > 0);
  });
});

describe("buildLfoPdfBytes", () => {
  it("writes a PDF file from the full payload", async () => {
    const payload = buildLfoSharePayload(inventory);
    const bytes = await buildLfoPdfBytes(payload);
    const header = new TextDecoder().decode(bytes.slice(0, 5));
    assert.equal(header, "%PDF-");
    assert.ok(bytes.byteLength > 800);
  });
});
