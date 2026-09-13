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
    assert.match(text, /Bin A \(lbs\)/);
    assert.doesNotMatch(text, /\bField\b/);
    assert.doesNotMatch(text, /\bValue\b/);
  });
});
