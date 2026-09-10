import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nav = readFileSync(join(root, "src/components/AppNav.tsx"), "utf8");
const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");
const expoTabs = readFileSync(join(root, "mobile/app/(tabs)/_layout.tsx"), "utf8");

assert.match(nav, /0\.7rem\+env\(safe-area-inset-bottom/);
assert.match(layout, /viewportFit: "cover"/);
assert.match(expoTabs, /insets\.bottom \+ 10/);

console.log("tab-bar-padding: ok");
