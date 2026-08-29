import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calculateLastFeedOrder, feedUpAtFromCatch } from "./calculate.ts";

describe("calculateLastFeedOrder clock", () => {
  it("measures hours until feed off from the order date and time", () => {
    const result = calculateLastFeedOrder({
      orderDate: "2026-08-01",
      orderTime: "00:00",
      consumptionRate: 0.45,
      houses: [
        {
          houseId: "h1",
          houseNumber: 1,
          headCount: 10000,
          binAPounds: 10000,
          binBPounds: 0,
          feedUpAt: feedUpAtFromCatch("2026-08-02", "10:00"),
        },
      ],
    });
    // Catch 10:00 → feed up 05:00 → feed off 00:00 on Aug 2.
    // From order Aug 1 00:00 to feed off Aug 2 00:00 = 24 hours.
    assert.equal(result.houses[0].hoursUntilFeedOff, 24);
  });

  it("ignores a later wall-clock time when order time is set", () => {
    const later = calculateLastFeedOrder({
      orderDate: "2026-08-01",
      orderTime: "00:00",
      consumptionRate: 0.45,
      now: new Date("2026-08-29T17:00:00"),
      houses: [
        {
          houseId: "h1",
          houseNumber: 1,
          headCount: 10000,
          binAPounds: 10000,
          binBPounds: 0,
          feedUpAt: feedUpAtFromCatch("2026-08-02", "10:00"),
        },
      ],
    });
    const fromOrder = calculateLastFeedOrder({
      orderDate: "2026-08-01",
      orderTime: "00:00",
      consumptionRate: 0.45,
      houses: [
        {
          houseId: "h1",
          houseNumber: 1,
          headCount: 10000,
          binAPounds: 10000,
          binBPounds: 0,
          feedUpAt: feedUpAtFromCatch("2026-08-02", "10:00"),
        },
      ],
    });
    assert.equal(later.houses[0].hoursUntilFeedOff, 0);
    assert.equal(fromOrder.houses[0].hoursUntilFeedOff, 24);
  });

  it("shifts hours by the same amount when the order time changes", () => {
    const house = {
      houseId: "h1",
      houseNumber: 1,
      headCount: 10000,
      binAPounds: 10000,
      binBPounds: 0,
      feedUpAt: feedUpAtFromCatch("2026-08-02", "10:00"),
    };
    const morning = calculateLastFeedOrder({
      orderDate: "2026-08-01",
      orderTime: "08:00",
      consumptionRate: 0.45,
      houses: [house],
    });
    const noon = calculateLastFeedOrder({
      orderDate: "2026-08-01",
      orderTime: "12:00",
      consumptionRate: 0.45,
      houses: [house],
    });
    assert.equal(morning.houses[0].hoursUntilFeedOff, 16);
    assert.equal(noon.houses[0].hoursUntilFeedOff, 12);
    assert.equal(
      (morning.houses[0].hoursUntilFeedOff ?? 0) - (noon.houses[0].hoursUntilFeedOff ?? 0),
      4,
    );
  });
});
