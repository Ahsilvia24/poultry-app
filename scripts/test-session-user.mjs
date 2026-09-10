import assert from "node:assert/strict";
import { requireUserId, farmOwnedBy } from "../src/lib/session-user.ts";
import { applyHostedEnv } from "./hosted-env.mjs";

assert.equal(requireUserId("user_1"), "user_1");
assert.throws(() => requireUserId(undefined), /Unauthorized/);
assert.throws(() => requireUserId(""), /Unauthorized/);
assert.throws(() => requireUserId("   "), /Unauthorized/);
assert.deepEqual(farmOwnedBy("user_1"), { userId: "user_1", deletedAt: null });
assert.throws(() => farmOwnedBy(undefined), /Unauthorized/);

const prodEnv = applyHostedEnv({
  VERCEL_ENV: "production",
  AUTH_URL: "https://poultrytechapp.com",
  VERCEL_URL: "poultry-app.vercel.app",
});
assert.equal(prodEnv.AUTH_URL, "https://poultrytechapp.com");

const unsetAuth = applyHostedEnv({ VERCEL_URL: "preview.vercel.app" });
assert.equal(unsetAuth.AUTH_URL, "https://preview.vercel.app");

console.log("session-user: ok");
