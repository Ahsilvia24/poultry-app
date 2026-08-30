import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeLiveHouseRows } from "./liveHouseMetrics.ts";
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

  it("does not wipe a typed temp when the house has no logged temp", () => {
    const next = mergeLiveHouseRows(
      [row({ houseNumber: 1, currentTemp: "81" })],
      [row({ houseNumber: 1, currentTemp: "" })],
    );
    assert.equal(next[0]?.currentTemp, "81");
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
});
