import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isHomeScreenAsset } from "../src/lib/home-screen-icons.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function read(rel) {
  return readFileSync(join(root, rel), "utf8");
}

for (const rel of ["public/sw.js", "mobile/public/sw.js"]) {
  assert.ok(existsSync(join(root, rel)), `missing ${rel}`);
  const sw = read(rel);
  assert.match(sw, /poultrytech-offline-v1/);
  assert.match(sw, /addEventListener\("fetch"/);
  assert.match(sw, /request\.method !== "GET"/);
  assert.match(sw, /networkFirst/);
  assert.match(sw, /cacheFirst/);
  assert.match(sw, /sql-wasm\.wasm/);
  assert.match(sw, /apple-touch-icon\.png/);
}

assert.equal(read("public/sw.js"), read("mobile/public/sw.js"));

const html = read("mobile/app/+html.tsx");
assert.match(html, /serviceWorker\.register\("\/sw\.js"/);

const layout = read("src/app/layout.tsx");
assert.match(layout, /RegisterServiceWorker/);
assert.match(layout, /serviceWorker\.register\("\/sw\.js"/);

const proxy = read("src/proxy.ts");
assert.ok(proxy.includes(String.raw`sw\\.js`), "proxy matcher should skip sw.js");

const stage = read("scripts/stage-github-pages.sh");
assert.match(stage, /sw\.js/);

const nextConfig = read("next.config.ts");
assert.match(nextConfig, /source: "\/sw\.js"/);
assert.match(nextConfig, /Service-Worker-Allowed/);

assert.equal(isHomeScreenAsset("/sw.js"), true);
assert.equal(isHomeScreenAsset("/sql-wasm.wasm"), true);
assert.equal(isHomeScreenAsset("/login"), false);

console.log("offline-sw: ok");
