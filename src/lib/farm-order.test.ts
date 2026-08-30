import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_FARM_ORDER, parseFarmOrder, sortFarmsByOrder } from "./farm-order.ts";

describe("parseFarmOrder", () => {
  it("defaults to age high to low", () => {
    assert.equal(DEFAULT_FARM_ORDER, "age_desc");
    assert.equal(parseFarmOrder(null), "age_desc");
    assert.equal(parseFarmOrder(undefined), "age_desc");
    assert.equal(parseFarmOrder(""), "age_desc");
  });
});

describe("sortFarmsByOrder", () => {
  it("sorts A–Z within active, then A–Z within inactive", () => {
    const farms = [
      { farmName: "Zebra", isActive: false },
      { farmName: "Alpha", isActive: true },
      { farmName: "Maple", isActive: false },
      { farmName: "Cedar", isActive: true },
    ];
    assert.deepEqual(
      sortFarmsByOrder(farms, "name_asc").map((f) => f.farmName),
      ["Alpha", "Cedar", "Maple", "Zebra"],
    );
  });

  it("sorts Z–A within each group and still keeps inactive last", () => {
    const farms = [
      { farmName: "Alpha", isActive: true },
      { farmName: "Zebra", isActive: false },
      { farmName: "Maple", isActive: false },
      { farmName: "Cedar", isActive: true },
    ];
    assert.deepEqual(
      sortFarmsByOrder(farms, "name_desc").map((f) => f.farmName),
      ["Cedar", "Alpha", "Zebra", "Maple"],
    );
  });

  it("treats missing isActive as active", () => {
    const farms = [{ farmName: "Beta", isActive: false }, { farmName: "Alpha" }];
    assert.deepEqual(
      sortFarmsByOrder(farms, "name_asc").map((f) => f.farmName),
      ["Alpha", "Beta"],
    );
  });
});
