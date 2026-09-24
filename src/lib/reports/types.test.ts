import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REPORT_TYPES, resolveReportType } from "./types.ts";

describe("resolveReportType", () => {
  it("keeps the report tabs", () => {
    assert.equal(resolveReportType("field-log"), "field-log");
    assert.equal(resolveReportType("generator"), "generator");
    assert.equal(resolveReportType("mortality"), "mortality");
    assert.equal(resolveReportType("share"), "share");
    assert.equal(resolveReportType(undefined), "field-log");
    assert.deepEqual(
      REPORT_TYPES.map((t) => t.key),
      ["field-log", "generator", "mortality", "share"],
    );
  });

  it("does not keep Farm History as a report tab", () => {
    assert.equal(resolveReportType("history"), "field-log");
    assert.equal(
      REPORT_TYPES.some((t) => t.key === "history"),
      false,
    );
  });
});
