import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planAttachMissingHousesToActiveFlock } from "./attachHouseToActiveFlock.ts";

const flock = {
  id: "flock-a",
  placementDate: "2026-08-01",
  projectedCatchDate: "2026-09-22",
  actualCatchDate: null as string | null,
};

function houses(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `h${i + 1}`,
    houseNumber: i + 1,
  }));
}

function hf(
  houseId: string,
  extras?: Partial<{
    flockId: string;
    placementDate: string | null;
    catchDate: string | null;
    catchTime: string | null;
  }>,
) {
  return {
    houseId,
    flockId: extras?.flockId ?? "flock-a",
    placementDate: extras?.placementDate ?? "2026-08-01",
    catchDate: extras?.catchDate ?? "2026-09-22",
    catchTime: extras?.catchTime ?? "06:00",
  };
}

describe("planAttachMissingHousesToActiveFlock", () => {
  it("attaches a 4th house to the same flock as houses 1–3", () => {
    const plans = planAttachMissingHousesToActiveFlock({
      houses: houses(4),
      houseFlocks: [hf("h1"), hf("h2"), hf("h3")],
      activeFlocks: [flock],
    });
    assert.deepEqual(plans, [
      {
        houseId: "h4",
        flockId: "flock-a",
        placedBirdCount: 0,
        placementDate: "2026-08-01",
        catchDate: "2026-09-22",
        catchTime: "06:00",
      },
    ]);
  });

  it("returns nothing when every house is already on the flock", () => {
    const plans = planAttachMissingHousesToActiveFlock({
      houses: houses(3),
      houseFlocks: [hf("h1"), hf("h2"), hf("h3")],
      activeFlocks: [flock],
    });
    assert.deepEqual(plans, []);
  });

  it("returns nothing when there is no active flock", () => {
    const plans = planAttachMissingHousesToActiveFlock({
      houses: houses(4),
      houseFlocks: [],
      activeFlocks: [],
    });
    assert.deepEqual(plans, []);
  });

  it("joins the nearest lower house's flock when IDs are split", () => {
    const plans = planAttachMissingHousesToActiveFlock({
      houses: houses(4),
      houseFlocks: [
        hf("h1", { flockId: "flock-a" }),
        hf("h2", { flockId: "flock-a" }),
        hf("h3", { flockId: "flock-b", placementDate: "2026-08-04", catchTime: "07:30" }),
      ],
      activeFlocks: [
        flock,
        { id: "flock-b", placementDate: "2026-08-04", projectedCatchDate: "2026-09-25" },
      ],
    });
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.houseId, "h4");
    assert.equal(plans[0]?.flockId, "flock-b");
    assert.equal(plans[0]?.placementDate, "2026-08-04");
    assert.equal(plans[0]?.catchTime, "07:30");
  });

  it("attaches several missing houses in house-number order", () => {
    const plans = planAttachMissingHousesToActiveFlock({
      houses: houses(5),
      houseFlocks: [hf("h1"), hf("h2"), hf("h3")],
      activeFlocks: [flock],
    });
    assert.deepEqual(
      plans.map((p) => p.houseId),
      ["h4", "h5"],
    );
    assert.ok(plans.every((p) => p.flockId === "flock-a" && p.placedBirdCount === 0));
  });

  it("uses a later sibling when lower houses are the ones missing", () => {
    const plans = planAttachMissingHousesToActiveFlock({
      houses: houses(3),
      houseFlocks: [hf("h3")],
      activeFlocks: [flock],
    });
    assert.deepEqual(
      plans.map((p) => p.houseId),
      ["h1", "h2"],
    );
    assert.ok(plans.every((p) => p.flockId === "flock-a"));
  });

  it("falls back to flock dates when no sibling house-flock exists", () => {
    const plans = planAttachMissingHousesToActiveFlock({
      houses: houses(2),
      houseFlocks: [],
      activeFlocks: [flock],
    });
    assert.equal(plans.length, 2);
    assert.ok(
      plans.every(
        (p) =>
          p.flockId === "flock-a" &&
          p.placementDate === "2026-08-01" &&
          p.catchDate === "2026-09-22" &&
          p.catchTime === null,
      ),
    );
  });
});
