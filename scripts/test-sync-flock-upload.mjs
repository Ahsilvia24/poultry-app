import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { isActionTransportError } = await import(
  join(root, "src/lib/offline/actionTransportError.ts")
);
const { createFlockAlreadyUploaded, createFlockOccupiedFlockWhere } = await import(
  join(root, "src/lib/flock/createFlockSync.ts")
);

const digest = new Error(
  "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error.",
);
assert.equal(isActionTransportError(digest), true);
assert.equal(isActionTransportError({ digest: "NEXT_REDIRECT;replace;/farms/1" }), true);
assert.equal(isActionTransportError(new Error("NEXT_REDIRECT")), true);
assert.equal(isActionTransportError(new Error("House 1 is already on active flock 26-01.")), false);

assert.equal(createFlockAlreadyUploaded(["h1", "h2"], ["h1", "h2"]), true);
assert.equal(createFlockAlreadyUploaded(["h1", "h2"], ["h1"]), true);
assert.equal(createFlockAlreadyUploaded(["h1"], ["h1", "h2"]), false);
assert.equal(createFlockAlreadyUploaded([], []), true);

assert.deepEqual(createFlockOccupiedFlockWhere("farm-1"), {
  farmId: "farm-1",
  flockStatus: "ACTIVE",
  deletedAt: null,
});
assert.deepEqual(createFlockOccupiedFlockWhere("farm-1", "flock-1"), {
  farmId: "farm-1",
  flockStatus: "ACTIVE",
  deletedAt: null,
  id: { not: "flock-1" },
});

const action = read("src/app/actions/farms.ts");
assert.match(action, /createFlockAlreadyUploaded/);
assert.match(action, /createFlockOccupiedFlockWhere/);
assert.match(action, /if \(options\?\.skipRedirect\) return \{ success: true as const, id: flockId/);
assert.doesNotMatch(
  action,
  /revalidatePath\(`\/farms\/\$\{farmId\}`\);\n  if \(options\?\.skipRedirect\)/,
);

const flush = read("src/lib/offline/flushWrites.ts");
assert.match(flush, /isActionTransportError/);
assert.match(flush, /createFlockAction\(farmId, formData, \{ skipRedirect: true \}\)/);
assert.match(flush, /Could not upload this flock/);

console.log("sync-flock-upload: ok");
