import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { publicSyncLeftoverError, visitSaveError } from "./ensureVisitType.ts";

describe("publicSyncLeftoverError", () => {
  it("hides the Next.js production digest text", () => {
    assert.equal(
      publicSyncLeftoverError(
        "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error.",
      ),
      undefined,
    );
    assert.equal(publicSyncLeftoverError("Farm work did not upload."), "Farm work did not upload.");
    assert.equal(publicSyncLeftoverError("No database"), undefined);
    assert.equal(publicSyncLeftoverError("  "), undefined);
  });
});

describe("visitSaveError", () => {
  it("maps a missing Weight Projection enum to a retry message", () => {
    assert.match(
      visitSaveError(new Error('invalid input value for enum "VisitType": "WEIGHT_PROJECTION"')),
      /visit type/,
    );
    assert.match(visitSaveError(new Error("boom")), /Could not save this visit/);
  });
});
