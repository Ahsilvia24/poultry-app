import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitColumnGroups } from "./splitColumnGroups.ts";

describe("splitColumnGroups", () => {
  it("continues rows that do not fit on the first page", () => {
    const groups = [
      {
        title: "Gen 1",
        rows: Array.from({ length: 5 }, (_, i) => [`day-${i}`]),
      },
      {
        title: "Gen 2",
        rows: Array.from({ length: 2 }, (_, i) => [`day-${i}`]),
      },
    ];
    const measure = (group: { rows: ReadonlyArray<unknown> }) => 20 + group.rows.length * 10;
    const first = splitColumnGroups(groups, 50, measure);
    assert.deepEqual(
      first.head.map((group) => group.rows.length),
      [3, 2],
    );
    assert.equal(first.tail.length, 1);
    assert.equal(first.tail[0]?.title, "Gen 1");
    assert.equal(first.tail[0]?.rows.length, 2);
    const rest = splitColumnGroups(first.tail, 50, measure);
    assert.equal(rest.tail.length, 0);
    assert.equal(rest.head[0]?.rows.length, 2);
  });

  it("splits a long generator column without measuring every dropped row", () => {
    let calls = 0;
    const groups = [
      {
        title: "Gen 1",
        rows: Array.from({ length: 400 }, (_, i) => [`day-${i}`]),
      },
    ];
    const measure = (group: { rows: ReadonlyArray<unknown> }) => {
      calls += 1;
      return 20 + group.rows.length * 10;
    };
    const first = splitColumnGroups(groups, 20 + 40 * 10, measure);
    assert.equal(first.head[0]?.rows.length, 40);
    assert.equal(first.tail[0]?.rows.length, 360);
    assert.equal(first.head[0]?.rows[0]?.[0], "day-0");
    assert.equal(first.tail[0]?.rows[0]?.[0], "day-40");
    assert.ok(calls < 30, `measured ${calls} times`);
  });
});
