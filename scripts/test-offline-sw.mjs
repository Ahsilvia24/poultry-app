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
assert.match(sw, /poultrytech-offline-v15/);
assert.match(sw, /shouldAdoptFromOldCache/);
assert.match(sw, /\/service-forms\/placement\.pdf/);
assert.match(sw, /\/service-forms\/prebrood\.pdf/);
assert.match(sw, /\/service-forms\/service-report\.pdf/);
assert.ok(existsSync(join(root, "public/service-forms/placement.pdf")));
assert.ok(existsSync(join(root, "public/service-forms/prebrood.pdf")));
assert.ok(existsSync(join(root, "public/service-forms/service-report.pdf")));
assert.match(sw, /webmanifest\|pdf/);
assert.match(sw, /type !== "precache"/);
assert.match(sw, /type === "sign-out"/);
assert.match(sw, /SIGNED_OUT_FLAG/);
assert.match(sw, /NETWORK_MS = 1500/);
assert.match(sw, /OPEN_MS = 8000/);
assert.match(sw, /addEventListener\("fetch"/);
assert.match(sw, /request\.method !== "GET"/);
assert.match(sw, /networkFirst/);
assert.match(sw, /cacheFirst/);
assert.match(sw, /staleWhileRevalidate/);
assert.match(sw, /isNavigation/);
assert.match(sw, /adoptOldCaches/);
assert.match(sw, /fetchWithTimeout/);
assert.match(sw, /navigator\.onLine === false/);
assert.match(sw, /\/offline\.html/);
assert.match(sw, /responseLooksLikeLogin/);
assert.match(sw, /cache\.match\("\/offline\.html"\)/);
assert.match(sw, /function serveLeave/);
assert.match(sw, /cache\.match\(LEAVE_PAGE\)/);
assert.match(sw, /if \(await isSignedOut\(\)\) return serveLeave\(\)/);
assert.match(sw, /apple-touch-icon\.png/);
assert.doesNotMatch(sw, /PRECACHE\s*=\s*\[[\s\S]*?"\/",/);
assert.doesNotMatch(sw, /sql-wasm/);
assert.match(sw, /path\.startsWith\("\/api\/"\)/);
assert.match(sw, /path\.startsWith\("\/support"\)/);
assert.match(sw, /path\.startsWith\("\/privacy"\)/);
assert.match(sw, /isNavigation\(request\) \|\| isRsc\(request, url\)/);

const offline = read("public/offline.html");
assert.match(offline, /No phone service/);
assert.match(offline, /href="\/"/);
assert.match(offline, /open=/);

const layout = read("src/app/layout.tsx");
assert.match(layout, /RegisterServiceWorker/);
assert.match(layout, /LockPinchZoom/);
assert.match(layout, /themeColor: "#f3efe6"/);
assert.match(layout, /backgroundColor: "#f3efe6"/);
assert.match(layout, /updateViaCache:"none"/);

const manifest = read("public/manifest.webmanifest");
assert.match(manifest, /"background_color": "#f3efe6"/);
assert.match(manifest, /"theme_color": "#f3efe6"/);
assert.match(offline, /user-scalable=no/);
assert.match(offline, /maximum-scale=1/);

const register = read("src/components/RegisterServiceWorker.tsx");
assert.match(register, /serviceWorker\.register\("\/sw\.js"/);
assert.match(register, /updateViaCache: "none"/);
assert.match(register, /NODE_ENV !== "production"/);
assert.match(register, /precacheAppAssets/);
assert.match(register, /collectAppAssetUrls/);
assert.match(register, /warmOfflineAssets/);

const banner = read("src/components/OfflineBanner.tsx");
assert.match(banner, /No service — showing last loaded data/);
assert.match(banner, /Saves stay on this phone/);
assert.doesNotMatch(banner, /Saves need a signal/);

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
assert.ok(proxy.includes(String.raw`signed-out\\.html`), "proxy matcher should skip signed-out.html");

const nextConfig = read("next.config.ts");
assert.match(nextConfig, /source: "\/sw\.js"/);
assert.match(nextConfig, /Service-Worker-Allowed/);
assert.match(nextConfig, /dynamic:\s*180/);
assert.match(nextConfig, /static:\s*600/);

const nav = read("src/components/AppNav.tsx");
assert.match(nav, /addEventListener\("online"/);

assert.equal(isHomeScreenAsset("/sw.js"), true);
assert.equal(isHomeScreenAsset("/offline.html"), true);
assert.equal(isHomeScreenAsset("/signed-out.html"), true);
assert.equal(isHomeScreenAsset("/login"), false);

console.log("offline-sw: ok");
