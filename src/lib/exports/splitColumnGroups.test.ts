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
});
