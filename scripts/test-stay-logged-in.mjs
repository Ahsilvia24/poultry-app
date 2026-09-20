import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const auth = read("src/lib/auth.ts");
assert.match(auth, /isActiveSession/);
assert.match(auth, /} catch {\s*return session;/);

const authConfig = read("src/lib/auth.config.ts");
assert.match(authConfig, /SESSION_MAX_AGE_SECONDS = 60 \* 60 \* 24 \* 400/);
assert.match(authConfig, /maxAge: SESSION_MAX_AGE_SECONDS/);

const active = read("src/lib/active-session.ts");
assert.match(active, /if \(!lookup\.ok\) return true;/);
assert.match(active, /if \(!user\) return true;/);
assert.match(active, /decideActiveSession\(\{ ok: false \}/);
assert.match(active, /reuseExistingSessionId/);
assert.match(active, /if \(reuse\) return reuse;/);

const mobileAuth = read("src/lib/mobile-auth.ts");
assert.match(mobileAuth, /400d/);

const sw = read("public/sw.js");
assert.match(sw, /poultrytech-offline-v18/);
assert.match(sw, /OPEN_MS = 8000/);
assert.match(sw, /responseLooksLikeLogin/);
assert.match(sw, /cache\.match\("\/offline\.html"\)/);
assert.match(sw, /SIGNED_OUT_FLAG/);
assert.match(sw, /type === "sign-out"/);

console.log("stay-logged-in: ok");
