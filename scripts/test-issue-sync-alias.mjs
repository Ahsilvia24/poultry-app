import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const { aliasesFromCreated, chooseLeftoverCreatedId } = await import(
  join(root, "src/lib/offline/remapIds.ts")
);

assert.deepEqual(aliasesFromCreated({}, "local-issue-1", "iss_server"), {
  "local-issue-1": "iss_server",
});
assert.deepEqual(aliasesFromCreated({ a: "b" }, "local-issue-1", "local-issue-1"), { a: "b" });
assert.deepEqual(aliasesFromCreated({ a: "b" }, undefined, "iss_server"), { a: "b" });

assert.equal(
  chooseLeftoverCreatedId({ existingId: "iss_1", sameFingerprint: ["iss_2"], sameDay: ["iss_3"] }),
  "iss_1",
);
assert.equal(
  chooseLeftoverCreatedId({ sameFingerprint: ["iss_2", "iss_9"], sameDay: ["iss_3"] }),
  "iss_2",
);
assert.equal(chooseLeftoverCreatedId({ sameDay: ["iss_only"] }), "iss_only");
assert.equal(chooseLeftoverCreatedId({ sameDay: ["iss_a", "iss_b"] }), null);
assert.equal(chooseLeftoverCreatedId({}), null);

const ops = read("src/app/actions/ops.ts");
const createIssue = ops.slice(
  ops.indexOf("export async function createIssueAction"),
  ops.indexOf("export async function deleteVisitAction"),
);
const updateIssue = ops.slice(
  ops.indexOf("export async function updateIssueAction"),
  ops.indexOf("export async function deleteLitterEventAction"),
);
assert.match(createIssue, /return \{ success: true, id: created\.id \}/);
assert.doesNotMatch(createIssue, /return \{ success: true \};/);
assert.match(updateIssue, /chooseLeftoverCreatedId/);
assert.match(updateIssue, /isLocalRecordId\(issueId\)/);
assert.match(updateIssue, /if \(!leftoverId\)/);
assert.match(updateIssue, /return \{ success: true, id: leftoverId \}/);
assert.match(updateIssue, /return \{ success: true, id: created\.id \}/);

const writes = read("src/lib/offline/flushWrites.ts");
assert.match(writes, /aliasesFromCreated/);
assert.match(writes, /function fromCreated/);
assert.match(writes, /case "createIssue":\n      return fromCreated\(await createIssueAction/);
assert.match(writes, /case "updateIssue":\n      return fromCreated\(await updateIssueAction/);
assert.match(writes, /case "createLitter":\n      return fromCreated\(await createLitterEventAction/);
assert.match(writes, /case "createFeed":\n      return fromCreated\(await createFeedDeliveryAction/);
assert.doesNotMatch(writes, /case "createIssue":\n      return fromAction\(await createIssueAction/);

console.log("issue-sync-alias: ok");
