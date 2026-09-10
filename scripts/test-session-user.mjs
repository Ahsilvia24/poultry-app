import assert from "node:assert/strict";
import { requireUserId, farmOwnedBy } from "../src/lib/session-user.ts";

assert.equal(requireUserId("user_1"), "user_1");
assert.throws(() => requireUserId(undefined), /Unauthorized/);
assert.throws(() => requireUserId(""), /Unauthorized/);
assert.throws(() => requireUserId("   "), /Unauthorized/);
assert.deepEqual(farmOwnedBy("user_1"), { userId: "user_1", deletedAt: null });
assert.throws(() => farmOwnedBy(undefined), /Unauthorized/);

console.log("session-user: ok");
