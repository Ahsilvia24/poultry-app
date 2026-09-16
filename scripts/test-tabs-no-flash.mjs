import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const ctx = read("src/components/KeypadNavContext.tsx");
assert.match(ctx, /openRef/);
assert.match(ctx, /if \(!openRef\.current\) return/);
assert.match(
  ctx,
  /House cards \/ tools call setKeypadOpen\(false\)/,
  "document why already-closed false must not hide tabs",
);

const house = read("src/components/HouseCard.tsx");
assert.match(house, /setKeypadOpen\(tempOpen\)/);
assert.match(house, /return \(\) => setKeypadOpen\(false\)/);

const tools = read("src/components/ConsumptionRateCalculator.tsx");
assert.match(tools, /setKeypadOpen\(active != null\)/);
assert.match(tools, /return \(\) => setKeypadOpen\(false\)/);

const nav = read("src/components/AppNav.tsx");
assert.match(nav, /if \(keypadOpen\) return null/);

console.log("tabs-no-flash: ok");
