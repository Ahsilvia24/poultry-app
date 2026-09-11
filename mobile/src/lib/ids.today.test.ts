import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { todayKey } from "./ids.ts";

describe("todayKey farm calendar", () => {
  it("formats an explicit date in local civil time", () => {
    const noon = new Date(2026, 7, 1, 12, 0, 0, 0);
    assert.equal(todayKey(noon), "2026-08-01");
  });
});
