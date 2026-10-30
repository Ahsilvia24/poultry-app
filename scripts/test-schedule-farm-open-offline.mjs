import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const followUps = readFileSync(join(root, "src/components/FollowUpsDueList.tsx"), "utf8");
const home = readFileSync(join(root, "src/components/DashboardHome.tsx"), "utf8");
const catches = readFileSync(join(root, "src/components/UpcomingCatchesList.tsx"), "utf8");
const dashboard = readFileSync(join(root, "src/lib/dashboard.ts"), "utf8");
const applyImport = readFileSync(join(root, "src/lib/offline/applyImport.ts"), "utf8");

assert.match(followUps, /ReplicaLink/);
assert.match(followUps, /href=\{`\/farms\/\$\{f\.farmId\}`\}/);
assert.doesNotMatch(followUps, /from "next\/link"/);

assert.match(home, /ReplicaLink/);
assert.match(home, /href="\/schedule\/today"/);
assert.match(catches, /catchFarmHref/);
assert.match(catches, /prefetch/);

assert.match(dashboard, /farmId: farm\.id/);
assert.match(applyImport, /farmId: farm\.id/);

console.log("schedule-farm-open-offline: ok");
