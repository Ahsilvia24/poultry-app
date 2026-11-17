import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MortalityRecordLike } from "@/types";
import {
  averageDailyMortalityLast7Days,
  buildMortalitySummaries,
  projectedMortalityAtCatch,
  summarizeForDate,
  sumMortalityLast7Days,
} from "./calculations.ts";

function row(mortalityDate: Date | string, dailyMortalityCount: number, birdAgeInDays: number): MortalityRecordLike {
  return {
    mortalityDate,
    birdAgeInDays,
    dailyMortalityCount,
    cullCount: 0,
    totalDailyLoss: dailyMortalityCount,
  };
}

/** UTC midnight, the same shape as a saved calendar day and appToday(). */
function utcDay(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day));
}

describe("sumMortalityLast7Days", () => {
  const today = utcDay(2026, 10, 22);
  const dayTwo = [
    row(utcDay(2026, 10, 20), 80, 0),
    row(utcDay(2026, 10, 21), 120, 1),
    row(utcDay(2026, 10, 22), 443, 2),
  ];

  it("matches the farm total on day 2, including today", () => {
    assert.equal(sumMortalityLast7Days(dayTwo, today), 643);
    const summary = summarizeForDate(20_000, dayTwo, today);
    assert.equal(summary.cumulative, 643);
    assert.equal(summary.sevenDay, 643);
    assert.equal(summary.today, 443);
  });

  it("keeps a day eight calendar days back out of the window", () => {
    const withOlder = [...dayTwo, row(utcDay(2026, 10, 14), 50, 0)];
    assert.equal(sumMortalityLast7Days(withOlder, today), 643);
    const summaries = buildMortalitySummaries(20_000, withOlder);
    const latest = summaries[summaries.length - 1]!;
    assert.equal(latest.date, "2026-10-22");
    assert.equal(latest.rolling7DayMortalityCount, 643);
    assert.equal(latest.cumulativeMortalityCount, 693);
  });

  it("includes the oldest day of the 7-day window", () => {
    const withEdge = [...dayTwo, row("2026-10-16", 10, 0)];
    assert.equal(sumMortalityLast7Days(withEdge, today), 653);
    assert.equal(sumMortalityLast7Days([...withEdge, row("2026-10-15", 9, 0)], today), 653);
  });
});

describe("averageDailyMortalityLast7Days", () => {
  it("always divides the last seven boxes by 7, even with six blanks", () => {
    const today = utcDay(2026, 11, 17);
    // Only one filled box in the window; the other six are blank → 70 / 7 = 10.
    const oneFilled = [row(utcDay(2026, 11, 17), 70, 40)];
    assert.equal(sumMortalityLast7Days(oneFilled, today), 70);
    assert.equal(averageDailyMortalityLast7Days(oneFilled, today), 10);
  });
});

describe("projectedMortalityAtCatch", () => {
  it("adds last-7 avg daily loss through the house catch day", () => {
    const today = utcDay(2026, 10, 22);
    const records = [
      row(utcDay(2026, 10, 20), 80, 0),
      row(utcDay(2026, 10, 21), 120, 1),
      row(utcDay(2026, 10, 22), 443, 2),
    ];
    const summary = summarizeForDate(20_000, records, today);
    const avgDaily = averageDailyMortalityLast7Days(records, today);
    assert.equal(avgDaily, 643 / 7);
    assert.equal(projectedMortalityAtCatch(summary.cumulative, avgDaily, 10), Math.round(643 + (643 / 7) * 10));
  });

  it("applies one-filled-day average to each remaining day of the flock", () => {
    const today = utcDay(2026, 11, 17);
    const records = [row(utcDay(2026, 11, 17), 70, 40)];
    const avgDaily = averageDailyMortalityLast7Days(records, today);
    assert.equal(avgDaily, 10);
    // 70 cumulative so far + 10/day × 5 days left → 120
    assert.equal(projectedMortalityAtCatch(70, avgDaily, 5), 120);
  });

  it("stays at cumulative when catch is today or past", () => {
    assert.equal(projectedMortalityAtCatch(500, 40, 0), 500);
    assert.equal(projectedMortalityAtCatch(500, 40, -3), 500);
  });
});
