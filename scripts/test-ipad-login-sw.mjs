import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sw = readFileSync(join(root, "public/sw.js"), "utf8");

/** Same helper as public/sw.js — Safari rejects a worker response with redirected. */
function withoutRedirect(response) {
  if (!response || !response.redirected) return response;
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
}

const loginPage = new Response("<html>Sign in</html>", {
  status: 200,
  headers: { "Content-Type": "text/html" },
});
Object.defineProperty(loginPage, "redirected", { value: true });
assert.equal(loginPage.redirected, true);

const safe = withoutRedirect(loginPage);
assert.equal(safe.redirected, false);
assert.equal(safe.status, 200);
assert.equal(await safe.text(), "<html>Sign in</html>");

const ok = new Response("dashboard", { status: 200 });
assert.equal(withoutRedirect(ok), ok);

assert.match(sw, /poultrytech-offline-v19/);
assert.match(sw, /function withoutRedirect/);
assert.match(sw, /Safari cannot show a worker response that followed a redirect/);
assert.match(sw, /isPublicAuthPath\(path\)/);
assert.match(sw, /\.then\(withoutRedirect\)/);
assert.match(sw, /return withoutRedirect\(response\)/);
assert.match(sw, /path === "\/login"/);
assert.match(sw, /path\.startsWith\("\/register"\)/);
assert.doesNotMatch(
  sw,
  /if \(await isSignedOut\(\)\) \{\s*if \(isPublicAuthPath/,
);

console.log("ipad-login-sw: ok");
