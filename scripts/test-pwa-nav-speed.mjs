import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const nextConfig = read("next.config.ts");
assert.match(nextConfig, /staleTimes/);
assert.match(nextConfig, /dynamic:\s*30/);
assert.match(nextConfig, /static:\s*180/);

const servicePage = read("src/app/(dashboard)/farms/[id]/service/page.tsx");
assert.doesNotMatch(servicePage, /loadServiceFarmContext/);
assert.match(servicePage, /Promise\.all/);
assert.match(servicePage, /listServiceFormDraftKinds\(id, userId\)/);
assert.match(servicePage, /listStoredServiceForms\(id, userId\)/);
assert.match(servicePage, /prisma\.farm\.findFirst/);

const farmContext = read("src/lib/serviceForms/farmContext.ts");
assert.match(farmContext, /farm: \{ userId, deletedAt: null \}/);

const dashboard = read("src/lib/dashboard.ts");
assert.match(dashboard, /Promise\.all\(\[/);
assert.match(dashboard, /followUpCompletion\.findMany/);
assert.match(dashboard, /litterEvent\.findMany/);
assert.doesNotMatch(dashboard, /litterEvents:\s*\{/);

const ensure = read("src/lib/ensureActiveFlockHouseFlocks.ts");
assert.match(ensure, /const concurrency = 6/);
assert.match(ensure, /Promise\.all/);

const nav = read("src/components/AppNav.tsx");
assert.match(nav, /router\.prefetch/);
assert.match(nav, /pendingHref/);
assert.match(nav, /prefetch/);

const quickLinks = read("src/components/FarmQuickLinks.tsx");
assert.match(quickLinks, /router\.prefetch\(serviceHref\)/);

const farmPage = read("src/app/(dashboard)/farms/[id]/page.tsx");
assert.match(farmPage, /const \[farm, thresholds\] = await Promise\.all/);

for (const rel of [
  "src/app/(dashboard)/loading.tsx",
  "src/app/(dashboard)/farms/[id]/loading.tsx",
  "src/app/(dashboard)/farms/[id]/service/loading.tsx",
]) {
  const file = read(rel);
  assert.match(file, /animate-pulse|RouteLoadingSkeleton/);
}

console.log("pwa-nav-speed: ok");
