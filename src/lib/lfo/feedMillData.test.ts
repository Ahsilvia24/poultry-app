import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatFeedMillData } from "./feedMillData.ts";

describe("formatFeedMillData", () => {
  it("formats inventory bins and LFO / reclaim lines", () => {
    const text = formatFeedMillData([
      {
        houseNumber: 1,
        binAPounds: 15000,
        binBPounds: 7000,
        orderLbs: 25000,
        reclaimLbs: null,
      },
      {
        houseNumber: 2,
        binAPounds: 8000,
        binBPounds: 0,
        orderLbs: 0,
        reclaimLbs: 3000,
      },
    ]);
    assert.equal(
      text,
      [
        "Current Inventory",
        "H1a- 15,000 lbs",
        "H1b- 7,000 lbs",
        "H2a- 8,000 lbs",
        "H2b- empty",
        "LFO",
        "H1- 25,000 lbs",
        "H2- 3,000 reclaim",
      ].join("\n"),
    );
  });
});
