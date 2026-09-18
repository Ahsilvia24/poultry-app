import assert from "node:assert/strict";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import {
  LOGOUT_FETCH_MS,
  SIGN_OUT_FLUSH_MS,
  SIGN_OUT_OVERALL_MS,
  isSyncTimeout,
  withTimeout,
} from "../src/lib/offline/syncTimeout.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.ok(SIGN_OUT_FLUSH_MS <= 4_000);
assert.ok(LOGOUT_FETCH_MS <= 2_000);
assert.ok(SIGN_OUT_OVERALL_MS <= 4_000);
assert.ok(SIGN_OUT_OVERALL_MS < 15_000, "leave must be faster than a full sync");

const started = Date.now();
try {
  await withTimeout(new Promise(() => undefined), 40);
  assert.fail("hung work should time out");
} catch (error) {
  assert.equal(isSyncTimeout(error), true);
}
assert.ok(Date.now() - started < 1000);

let flushPending = 7;
try {
  flushPending = (await withTimeout(new Promise(() => undefined), 40)).pending;
  assert.fail("stalled flush should not block leave");
} catch {
  /* Settings Sign out uses the last known pending count. */
}
assert.equal(flushPending, 7);

const settings = read("src/components/SettingsScreen.tsx");
assert.match(settings, /withTimeout\(flushNow\(\), SIGN_OUT_FLUSH_MS\)/);
assert.match(settings, /leaveApp\(true\)/);
assert.doesNotMatch(settings, /disabled=\{busy\}/);

const local = read("src/lib/offline/signOutLocal.ts");
assert.match(local, /withTimeout\(prepareLeave\(\), SIGN_OUT_OVERALL_MS\)/);
assert.match(local, /location\.replace\("\/api\/leave"\)/);

console.log("sign-out-never-hangs: ok");
