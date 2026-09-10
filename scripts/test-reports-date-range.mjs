import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(join(root, "src/app/(dashboard)/reports/page.tsx"), "utf8");
const fields = readFileSync(join(root, "src/components/ReportDateRangeFields.tsx"), "utf8");

assert.match(fields, /grid grid-cols-2/);
assert.match(fields, /type="date"/);
assert.match(fields, /compact/);
assert.match(fields, /px-2/);
assert.doesNotMatch(fields, /min-h-\[52px\]/);

assert.match(page, /ReportDateRangeFields fromLabel="Start" toLabel="Finish"/);
assert.match(page, /ReportDateRangeFields fromLabel="From" toLabel="To" from=\{from\} to=\{to\}/);
assert.equal(
  (page.match(/<ReportDateRangeFields /g) ?? []).length,
  3,
);
assert.doesNotMatch(page, /<p className="mt-1 text-xs text-stone-500">\{format\((fromDate|toDate)/);

console.log("reports-date-range: ok");
