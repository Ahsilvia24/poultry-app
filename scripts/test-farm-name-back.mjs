import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const expoFarm = read("mobile/app/(tabs)/farms/[id]/index.tsx");
assert.match(expoFarm, /<BackHeader/);
assert.match(expoFarm, /title=\{farm\.farmName\}/);
assert.match(expoFarm, /backLabel="Farms"/);
assert.doesNotMatch(
  expoFarm,
  /style=\{\[styles\.title, \{ flexShrink: 1, textAlign: "right", fontSize: 24 \}\]\}/,
);

const expoHeader = read("mobile/src/components/ui.tsx");
const backHeader = expoHeader.slice(expoHeader.indexOf("export function BackHeader"));
assert.match(backHeader, /flexShrink: 0/);
assert.match(backHeader, /minWidth: 0/);
assert.match(backHeader, /overflow: "hidden"/);
assert.match(backHeader, /numberOfLines=\{1\}/);
assert.match(backHeader, /adjustsFontSizeToFit/);
assert.match(backHeader, /trailing\?: ReactNode/);

const farmDetail = read("src/components/FarmDetailView.tsx");
assert.match(farmDetail, /grid-cols-\[auto_minmax\(0,1fr\)\]/);
assert.match(farmDetail, /shrink-0/);
assert.doesNotMatch(farmDetail, /grid-cols-\[auto_1fr\]/);

const farmInfo = read("src/components/FarmInfoEditor.tsx");
assert.match(farmInfo, /overflow-hidden/);
assert.match(farmInfo, /truncate/);
assert.match(farmInfo, /min-w-0 flex-1/);
assert.doesNotMatch(farmInfo, /justify-self-end/);

const webHeader = read("src/components/ui.tsx");
const webBack = webHeader.slice(webHeader.indexOf("export function BackHeader"));
assert.match(webBack, /shrink-0/);
assert.match(webBack, /truncate/);
assert.match(webBack, /overflow-hidden/);

const expoLfo = read("mobile/app/(tabs)/lfo/[id].tsx");
assert.match(expoLfo, /numberOfLines=\{1\}/);
assert.match(expoLfo, /minWidth: 0/);
assert.match(expoLfo, /flexShrink: 0/);

console.log("farm-name-back: ok");
