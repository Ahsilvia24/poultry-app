import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.ok(existsSync(join(root, "src/lib/offline/buildSnapshot.ts")));
assert.ok(existsSync(join(root, "src/app/api/offline/snapshot/route.ts")));
assert.ok(existsSync(join(root, "src/lib/pdf-text-extract-client.ts")));

const layout = read("src/app/(dashboard)/layout.tsx");
assert.match(layout, /OfflineProvider/);

const provider = read("src/components/OfflineProvider.tsx");
assert.match(provider, /loadLocalSnapshot/);
assert.match(provider, /Never block the UI on sync/);
assert.match(provider, /flushOutbox/);

const importUi = read("src/components/DashboardScheduleImport.tsx");
assert.match(importUi, /extractPlacementRowsOnDevice/);
assert.match(importUi, /extractCatchRowsOnDevice/);
assert.match(importUi, /previewPlacementRowsLocal/);

const farmsPage = read("src/app/(dashboard)/farms/page.tsx");
assert.match(farmsPage, /FarmsPageClient/);

const dash = read("src/app/(dashboard)/page.tsx");
assert.match(dash, /DashboardHome/);

const { extractPlacementRowsOnDevice } = await import(
  join(root, "src/lib/placement-import/extract-client.ts")
);
const { groupPlacementFarms } = await import(join(root, "src/lib/placement-import/parse.ts"));
const { previewPlacementRowsLocal } = await import(join(root, "src/lib/offline/previewImport.ts"));

const pdfBytes = readFileSync(
  join(root, "src/lib/placement-import/fixtures/weekly-chick-placement-9-5-26.pdf"),
);
const rows = await extractPlacementRowsOnDevice({
  bytes: pdfBytes,
  fileName: "9-5-26 Placement Schedule (2).pdf",
  mimeType: "application/pdf",
});
assert.equal(rows.length, 94, `on-device PDF rows ${rows.length}`);
const farms = groupPlacementFarms(rows);
assert.equal(farms.length, 21);
const preview = previewPlacementRowsLocal(rows, []);
assert.equal(preview.length, 21);
assert.ok(preview.every((farm) => farm.isMyFarm === false));

console.log(`local-first-offline: ${rows.length} rows · ${farms.length} farms from on-device PDF`);
