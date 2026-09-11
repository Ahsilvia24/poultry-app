import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isHomeScreenAsset } from "../src/lib/home-screen-icons.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.ok(existsSync(join(root, "public/sw.js")), "missing public/sw.js");
assert.ok(existsSync(join(root, "public/offline.html")), "missing public/offline.html");

const sw = read("public/sw.js");
assert.match(sw, /poultrytech-offline-v2/);
assert.match(sw, /NETWORK_MS = 4000/);
assert.match(sw, /addEventListener\("fetch"/);
assert.match(sw, /request\.method !== "GET"/);
assert.match(sw, /networkFirst/);
assert.match(sw, /cacheFirst/);
assert.match(sw, /fetchWithTimeout/);
assert.match(sw, /navigator\.onLine === false/);
assert.match(sw, /\/offline\.html/);
assert.match(sw, /apple-touch-icon\.png/);
assert.doesNotMatch(sw, /sql-wasm/);
assert.match(sw, /path\.startsWith\("\/api\/"\)/);

const offline = read("public/offline.html");
assert.match(offline, /No phone service/);
assert.match(offline, /href="\/"/);

const layout = read("src/app/layout.tsx");
assert.match(layout, /RegisterServiceWorker/);

const register = read("src/components/RegisterServiceWorker.tsx");
assert.match(register, /serviceWorker\.register\("\/sw\.js"/);
assert.match(register, /NODE_ENV !== "production"/);

const banner = read("src/components/OfflineBanner.tsx");
assert.match(banner, /No service — showing last loaded data/);

const shell = read("src/components/DashboardShell.tsx");
assert.match(shell, /OfflineBanner/);

const errorPage = read("src/app/error.tsx");
assert.match(errorPage, /window\.location\.reload\(\)/);
assert.match(errorPage, /navigator\.onLine === false/);
assert.match(errorPage, /No service — using the last saved screen/);

const globalError = read("src/app/global-error.tsx");
assert.match(globalError, /window\.location\.reload\(\)/);
assert.match(globalError, /navigator\.onLine === false/);

const proxy = read("src/proxy.ts");
assert.ok(proxy.includes(String.raw`sw\\.js`), "proxy matcher should skip sw.js");
assert.ok(proxy.includes(String.raw`offline\\.html`), "proxy matcher should skip offline.html");

const nextConfig = read("next.config.ts");
assert.match(nextConfig, /source: "\/sw\.js"/);
assert.match(nextConfig, /Service-Worker-Allowed/);
assert.match(nextConfig, /dynamic:\s*180/);
assert.match(nextConfig, /static:\s*600/);

const nav = read("src/components/AppNav.tsx");
assert.match(nav, /addEventListener\("online"/);

assert.equal(isHomeScreenAsset("/sw.js"), true);
assert.equal(isHomeScreenAsset("/offline.html"), true);
assert.equal(isHomeScreenAsset("/login"), false);

console.log("offline-sw: ok");
