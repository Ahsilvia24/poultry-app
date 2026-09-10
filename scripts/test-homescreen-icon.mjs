import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { isHomeScreenAsset } from "../src/lib/home-screen-icons.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function pngSize(path) {
  const buf = readFileSync(path);
  assert.equal(buf[0], 0x89);
  assert.equal(buf.toString("ascii", 1, 4), "PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const html = readFileSync(join(root, "mobile/app/+html.tsx"), "utf8");
assert.match(html, /rel="apple-touch-icon"/);
assert.match(html, /href="\/apple-touch-icon\.png"/);
assert.match(html, /apple-touch-icon-precomposed/);
assert.match(html, /rel="manifest"/);
assert.match(html, /apple-mobile-web-app-capable/);

const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
assert.match(layout, /apple-touch-icon\.png/);
assert.match(layout, /appleWebApp/);
assert.match(layout, /manifest\.webmanifest/);

const proxy = readFileSync(join(root, "src/proxy.ts"), "utf8");
assert.match(proxy, /apple-touch-icon/);
assert.ok(
  proxy.includes(String.raw`.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$`),
  "proxy matcher should skip image files",
);
assert.match(proxy, /isHomeScreenAsset/);

const login = readFileSync(join(root, "src/app/(auth)/login/page.tsx"), "utf8");
assert.match(login, /AuthBrand/);

const expoLogin = readFileSync(join(root, "mobile/app/login.tsx"), "utf8");
assert.match(expoLogin, /assets\/icon\.png/);

const stage = readFileSync(join(root, "scripts/stage-github-pages.sh"), "utf8");
assert.match(stage, /apple-touch-icon\.png/);
assert.match(stage, /apple-touch-icon-precomposed\.png/);
assert.match(stage, /manifest\.json/);

const required = [
  "mobile/public/apple-touch-icon.png",
  "mobile/public/apple-touch-icon-precomposed.png",
  "mobile/public/icon-192.png",
  "mobile/public/icon-512.png",
  "mobile/public/favicon.png",
  "mobile/public/manifest.json",
  "public/apple-touch-icon.png",
  "public/apple-touch-icon-precomposed.png",
  "public/icon-192.png",
  "public/icon-512.png",
  "public/favicon.png",
  "public/manifest.webmanifest",
  "src/app/apple-icon.png",
  "src/app/icon.png",
];
for (const rel of required) {
  assert.ok(existsSync(join(root, rel)), `missing ${rel}`);
}

assert.deepEqual(pngSize(join(root, "mobile/public/apple-touch-icon.png")), { width: 180, height: 180 });
assert.deepEqual(pngSize(join(root, "public/apple-touch-icon.png")), { width: 180, height: 180 });
assert.deepEqual(pngSize(join(root, "public/apple-touch-icon-precomposed.png")), {
  width: 180,
  height: 180,
});
assert.deepEqual(pngSize(join(root, "src/app/apple-icon.png")), { width: 180, height: 180 });
assert.deepEqual(pngSize(join(root, "mobile/public/icon-192.png")), { width: 192, height: 192 });
assert.deepEqual(pngSize(join(root, "mobile/public/icon-512.png")), { width: 512, height: 512 });

const expoManifest = JSON.parse(readFileSync(join(root, "mobile/public/manifest.json"), "utf8"));
assert.equal(expoManifest.short_name, "PoultryTech");
assert.ok(expoManifest.icons.some((icon) => icon.src === "/apple-touch-icon.png"));

assert.equal(isHomeScreenAsset("/apple-touch-icon.png"), true);
assert.equal(isHomeScreenAsset("/apple-touch-icon-precomposed.png"), true);
assert.equal(isHomeScreenAsset("/icon-192.png"), true);
assert.equal(isHomeScreenAsset("/apple-icon"), true);
assert.equal(isHomeScreenAsset("/login"), false);
assert.equal(isHomeScreenAsset("/"), false);

console.log("homescreen-icon: ok");
