import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldCommitSwipeDelete, SWIPE_DELETE_COMMIT_PX } from "./swipe-commit.ts";

describe("shouldCommitSwipeDelete", () => {
  it("needs an 80px swipe left before delete", () => {
    assert.equal(shouldCommitSwipeDelete(-40), false);
    assert.equal(shouldCommitSwipeDelete(-79), false);
    assert.equal(shouldCommitSwipeDelete(-SWIPE_DELETE_COMMIT_PX), true);
    assert.equal(shouldCommitSwipeDelete(-140), true);
  });

  it("ignores right swipes", () => {
    assert.equal(shouldCommitSwipeDelete(20), false);
    assert.equal(shouldCommitSwipeDelete(0), false);
  });
});
