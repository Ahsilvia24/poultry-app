import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lfoTargetWeekday } from "./lfoSchedule.ts";

describe("lfoTargetWeekday", () => {
  it("maps catch weekdays to the LFO weekday", () => {
    assert.equal(lfoTargetWeekday(1), 4); // Mon → Thu
    assert.equal(lfoTargetWeekday(2), 5); // Tue → Fri
    assert.equal(lfoTargetWeekday(3), 5); // Wed → Fri
    assert.equal(lfoTargetWeekday(4), 1); // Thu → Mon
    assert.equal(lfoTargetWeekday(5), 1); // Fri → Mon
    assert.equal(lfoTargetWeekday(6), null);
    assert.equal(lfoTargetWeekday(0), null);
  });
});
