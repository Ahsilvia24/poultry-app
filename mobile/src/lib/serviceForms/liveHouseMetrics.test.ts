import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeLiveHouseRows, normalizedLoggedTemp } from "./liveHouseMetrics.ts";
import type { ServiceHouseRow } from "./types.ts";

function row(partial: Partial<ServiceHouseRow> & { houseNumber: number }): ServiceHouseRow {
  return {
    houseNumber: partial.houseNumber,
    age: partial.age ?? "",
    placed: partial.placed ?? "",
    weeks: partial.weeks ?? ["", "", "", "", "", "", "", ""],
    currentTemp: partial.currentTemp ?? "",
    mortalityToDate: partial.mortalityToDate ?? "",
    binA: "",
    binB: "",
    litterTemp: "",
    ammoniaPpm: "",
  };
}

describe("normalizedLoggedTemp", () => {
  it("accepts a typed temperature", () => {
    assert.equal(normalizedLoggedTemp("78"), "78");
    assert.equal(normalizedLoggedTemp(" 80.5 "), "80.5");
  });

  it("skips empty or invalid values", () => {
    assert.equal(normalizedLoggedTemp(""), null);
    assert.equal(normalizedLoggedTemp("  "), null);
    assert.equal(normalizedLoggedTemp("n/a"), null);
  });
});

describe("mergeLiveHouseRows", () => {
  it("pulls logged temp and mortality into a draft house row", () => {
    const next = mergeLiveHouseRows(
      [row({ houseNumber: 1 })],
      [row({ houseNumber: 1, currentTemp: "78", mortalityToDate: "40", weeks: ["18", "", "", "", "", "", "", ""] })],
    );
    assert.equal(next[0]?.currentTemp, "78");
    assert.equal(next[0]?.mortalityToDate, "40");
    assert.equal(next[0]?.weeks[0], "18");
  });

  it("leaves current temp blank when the house has no logged temp", () => {
    const next = mergeLiveHouseRows(
      [row({ houseNumber: 1, currentTemp: "81" })],
      [row({ houseNumber: 1, currentTemp: "" })],
    );
    assert.equal(next[0]?.currentTemp, "");
  });

  it("adds a house that was created after the draft started", () => {
    const next = mergeLiveHouseRows(
      [row({ houseNumber: 1 })],
      [row({ houseNumber: 1 }), row({ houseNumber: 2, currentTemp: "76" })],
    );
    assert.equal(next.length, 2);
    assert.equal(next[1]?.houseNumber, 2);
    assert.equal(next[1]?.currentTemp, "76");
  });

  it("updates the same week box from live so incomplete week 1 is not stuck at 0", () => {
    const next = mergeLiveHouseRows(
      [row({ houseNumber: 1, weeks: ["0", "", "", "", "", "", "", ""], mortalityToDate: "0" })],
      [row({ houseNumber: 1, weeks: ["25", "", "", "", "", "", "", ""], mortalityToDate: "25" })],
    );
    assert.equal(next[0]?.weeks[0], "25");
    assert.equal(next[0]?.mortalityToDate, "25");
  });

  it("does not clear a filled week when live has not entered that week", () => {
    const next = mergeLiveHouseRows(
      [row({ houseNumber: 1, weeks: ["10", "20", "", "", "", "", "", ""] })],
      [row({ houseNumber: 1, weeks: ["", "20", "", "", "", "", "", ""] })],
    );
    assert.deepEqual(next[0]?.weeks, ["10", "20", "", "", "", "", "", ""]);
  });
});
