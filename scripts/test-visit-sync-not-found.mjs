import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { chooseLeftoverCreatedId } = await import(join(root, "src/lib/offline/remapIds.ts"));

assert.equal(
  chooseLeftoverCreatedId({
    sameFingerprint: ["vis_same"],
    sameDay: ["vis_day"],
  }),
  "vis_same",
);
assert.equal(chooseLeftoverCreatedId({ sameDay: ["vis_only"] }), "vis_only");
assert.equal(chooseLeftoverCreatedId({ sameDay: ["vis_a", "vis_b"] }), null);

const ops = read("src/app/actions/ops.ts");
const updateVisit = ops.slice(
  ops.indexOf("export async function updateVisitAction"),
  ops.indexOf("export async function deleteIssueAction"),
);
assert.match(updateVisit, /chooseLeftoverCreatedId/);
assert.match(updateVisit, /isLocalRecordId\(visitId\)/);
assert.match(updateVisit, /if \(!leftoverId\)/);
assert.match(updateVisit, /if \(!isLocalRecordId\(visitId\) && !existing\) return \{ error: "Visit not found" \}/);
assert.match(updateVisit, /prisma\.farmVisit\.create/);
assert.match(updateVisit, /return \{ success: true, id: created\.id \}/);
assert.match(updateVisit, /return \{ success: true, id: leftoverId \}/);

const reorder = ops.slice(
  ops.indexOf("export async function reorderVisitAction"),
  ops.indexOf("export async function updateVisitAction"),
);
assert.match(reorder, /if \(!visit\) return \{ success: true \}/);
assert.doesNotMatch(reorder, /if \(!visit\) return \{ error: "Visit not found" \}/);

const writes = read("src/lib/offline/flushWrites.ts");
assert.match(writes, /case "updateVisit":\n      return fromCreated\(await updateVisitAction/);
assert.doesNotMatch(writes, /case "updateVisit":\n      return fromAction\(await updateVisitAction/);

console.log("visit-sync-not-found: ok");
