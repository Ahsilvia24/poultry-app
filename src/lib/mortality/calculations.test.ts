import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MortalityRecordLike } from "@/types";
import { buildMortalitySummaries, summarizeForDate, sumMortalityLast7Days } from "./calculations.ts";

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
