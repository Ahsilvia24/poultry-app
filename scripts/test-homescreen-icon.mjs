import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
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

for (const rel of [
  "public/apple-touch-icon.png",
  "public/apple-touch-icon-precomposed.png",
  "public/icon-192.png",
  "src/app/apple-icon.png",
]) {
  assert.ok(existsSync(join(root, rel)), `missing ${rel}`);
}

assert.deepEqual(pngSize(join(root, "public/apple-touch-icon.png")), { width: 180, height: 180 });

const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
assert.match(layout, /apple-touch-icon\.png/);
assert.match(layout, /appleWebApp/);

const proxy = readFileSync(join(root, "src/proxy.ts"), "utf8");
assert.match(proxy, /isHomeScreenAsset/);
assert.ok(proxy.includes("apple-touch-icon"), "proxy must skip the chicken icon");

assert.equal(isHomeScreenAsset("/apple-touch-icon.png"), true);
assert.equal(isHomeScreenAsset("/login"), false);

console.log("homescreen-icon: ok");
