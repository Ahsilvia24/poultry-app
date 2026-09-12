import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const page = readFileSync(join(root, "src/components/ReportsView.tsx"), "utf8");
const fields = readFileSync(join(root, "src/components/ReportDateRangeFields.tsx"), "utf8");

assert.match(fields, /grid grid-cols-2/);
assert.match(fields, /DateKeyField/);
assert.match(fields, /min-w-0 overflow-hidden/);
assert.doesNotMatch(fields, /type="date"/);
assert.doesNotMatch(fields, /min-h-\[52px\]/);

assert.match(page, /fromLabel="Start"/);
assert.match(page, /toLabel="Finish"/);
assert.match(page, /fromLabel="From"/);
assert.match(page, /toLabel="To"/);
assert.match(page, /from=\{model.from\}/);
assert.match(page, /to=\{model.to\}/);
assert.equal((page.match(/<ReportDateRangeFields/g) ?? []).length, 3);
assert.doesNotMatch(page, /<p className="mt-1 text-xs text-stone-500">\{format\((fromDate|toDate)/);

console.log("reports-date-range: ok");
