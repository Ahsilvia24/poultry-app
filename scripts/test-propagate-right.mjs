import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const web = readFileSync(join(root, "src/components/HouseCardActions.tsx"), "utf8");
const expo = readFileSync(join(root, "mobile/app/(tabs)/farms/[id]/index.tsx"), "utf8");

const webBlock = web.slice(web.indexOf("function PropagateCheck"), web.indexOf("export function HouseCardActions"));
assert.match(webBlock, /ml-auto/);
assert.match(webBlock, /w-fit/);
assert.ok(
  webBlock.indexOf(">Propagate<") < webBlock.indexOf('type="checkbox"'),
  "web: Propagate label must come before the checkbox",
);

const expoBlock = expo.slice(expo.indexOf("function PropagateCheck"), expo.indexOf("const MAX_GENERATOR_LOGS_DISPLAY"));
assert.match(expoBlock, /alignSelf:\s*"flex-end"/);
assert.ok(
  expoBlock.indexOf("Propagate") < expoBlock.indexOf("Ionicons name=\"checkmark\""),
  "expo: Propagate label must come before the checkbox",
);

console.log("propagate-right: ok");
