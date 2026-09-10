import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const { truncateWithPeriod, fitOneDotName } = await import(
  `file://${join(root, "src/lib/oneDotName.ts")}`
);

assert.equal(truncateWithPeriod("WEYLIN GROOM", 12), "WEYLIN GROOM");
assert.equal(truncateWithPeriod("WEYLIN GROOM", 8), "WEYLIN.");
assert.equal(truncateWithPeriod("WEYLIN GROOM", 1), ".");
assert.doesNotMatch(truncateWithPeriod("WEYLIN GROOM", 8), /\.\.\./);

assert.equal(
  fitOneDotName("WEYLIN GROOM", (value) => value.length <= 12),
  "WEYLIN GROOM",
);
assert.equal(
  fitOneDotName("WEYLIN GROOM", (value) => value.length <= 8),
  "WEYLIN.",
);
assert.equal(fitOneDotName("WEYLIN GROOM", (value) => value.length <= 8).slice(-1), ".");
assert.doesNotMatch(fitOneDotName("WEYLIN GROOM", (value) => value.length <= 8), /\.\.\./);

const list = readFileSync(join(root, "src/components/FollowUpsDueList.tsx"), "utf8");
assert.match(list, /OneDotName/);
assert.match(list, /ml-auto flex shrink-0 items-baseline gap-1\.5/);
assert.doesNotMatch(list, /min-w-\[6\.5rem\]/);
assert.doesNotMatch(list, /min-w-\[5\.5rem\]/);
assert.doesNotMatch(list, /truncate/);

const page = readFileSync(join(root, "src/app/(dashboard)/page.tsx"), "utf8");
assert.match(page, /OneDotName text=\{c\.farmName\}/);

const mobile = readFileSync(join(root, "mobile/app/(tabs)/index.tsx"), "utf8");
assert.match(mobile, /OneDotName/);
assert.doesNotMatch(mobile, /minWidth: 78/);
assert.doesNotMatch(mobile, /width: 92/);

console.log("one-dot-name: ok");
