import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { layoutGeneratorFarmColumns, withGeneratorFarmHeadings } from "./generatorFarmPages.ts";

function group(title: string, count: number) {
  return {
    title,
    rows: Array.from({ length: count }, (_, index) => [`${title}-${index}`]),
  };
}

const measure = (group: { rows: ReadonlyArray<unknown> }) => 20 + group.rows.length * 10;

describe("layoutGeneratorFarmColumns", () => {
  it("keeps a farm that fits in the leftover space on the current page", () => {
    const slices = layoutGeneratorFarmColumns({
      groups: [group("Gen 1", 2)],
      columnsPerRow: 4,
      measure,
      headingHeight: 18,
      bandGap: 12,
      remaining: 200,
      pageHeight: 700,
    });
    assert.equal(slices.length, 1);
    assert.equal(slices[0]?.newPageBefore, false);
    assert.equal(slices[0]?.showHeading, true);
    assert.deepEqual(slices[0]?.groups[0]?.rows, [["Gen 1-0"], ["Gen 1-1"]]);
  });

  it("moves a whole farm onto the next page so that page starts with the farm name", () => {
    const slices = layoutGeneratorFarmColumns({
      groups: [group("Gen 1", 4), group("Gen 2", 4)],
      columnsPerRow: 4,
      measure,
      headingHeight: 18,
      bandGap: 12,
      remaining: 40,
      pageHeight: 700,
    });
    assert.equal(slices.length, 1);
    assert.equal(slices[0]?.newPageBefore, true);
    assert.equal(slices[0]?.showHeading, true);
    assert.equal(slices[0]?.groups[0]?.rows[0]?.[0], "Gen 1-0");
    assert.equal(slices[0]?.groups[0]?.rows.length, 4);
    assert.equal(slices[0]?.groups[1]?.rows.length, 4);
  });

  it("starts a continued page with the farm name when one farm is taller than a page", () => {
    const slices = layoutGeneratorFarmColumns({
      groups: [group("Gen 1", 10)],
      columnsPerRow: 4,
      measure,
      headingHeight: 18,
      bandGap: 12,
      remaining: 100,
      pageHeight: 100,
    });
    assert.ok(slices.length >= 2);
    assert.equal(slices[0]?.showHeading, true);
    assert.equal(slices[0]?.groups[0]?.rows[0]?.[0], "Gen 1-0");
    const continued = slices[1]!;
    assert.equal(continued.newPageBefore, true);
    assert.equal(continued.showHeading, true);
    assert.notEqual(continued.groups[0]?.rows[0]?.[0], "Gen 1-0");
    const drawn = slices.flatMap((slice) => slice.groups[0]?.rows.map((row) => row[0]) ?? []);
    assert.deepEqual(
      drawn,
      Array.from({ length: 10 }, (_, index) => `Gen 1-${index}`),
    );
  });
});

describe("withGeneratorFarmHeadings", () => {
  it("keeps a farm name with the generator columns that follow it", () => {
    const blocks = withGeneratorFarmHeadings([
      { type: "heading", text: "Oak Poultry" },
      { type: "columnGroups", groups: [] },
      { type: "lines", lines: ["after"] },
    ]);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0]?.type, "columnGroups");
    assert.equal((blocks[0] as { heading?: string }).heading, "Oak Poultry");
    assert.equal(blocks[1]?.type, "lines");
  });
});
