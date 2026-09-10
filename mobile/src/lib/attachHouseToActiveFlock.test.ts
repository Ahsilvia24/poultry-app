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

describe("planAttachMissingHousesToActiveFlock (expo)", () => {
  it("attaches a 4th house to the same flock as houses 1–3", () => {
    const plans = planAttachMissingHousesToActiveFlock({
      houses: houses(4),
      houseFlocks: [hf("h1"), hf("h2"), hf("h3")],
      activeFlocks: [flock],
    });
    assert.equal(plans.length, 1);
    assert.equal(plans[0]?.houseId, "h4");
    assert.equal(plans[0]?.flockId, "flock-a");
    assert.equal(plans[0]?.placedBirdCount, 0);
  });
});
