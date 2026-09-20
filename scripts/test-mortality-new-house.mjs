import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const farms = readFileSync(join(root, "src/app/actions/farms.ts"), "utf8");
const mortality = readFileSync(join(root, "src/app/(dashboard)/mortality/page.tsx"), "utf8");
const selectMortality = readFileSync(join(root, "src/lib/offline/selectMortality.ts"), "utf8");
const farmPage = readFileSync(join(root, "src/app/(dashboard)/farms/[id]/page.tsx"), "utf8");
const expoData = readFileSync(join(root, "mobile/src/repos/data.ts"), "utf8");

assert.match(farms, /ensureActiveFlockHouseFlocks\(farmId, \{ db: tx \}\)/);
assert.match(farms, /revalidatePath\("\/mortality"\)/);
assert.doesNotMatch(mortality, /from "@\/lib\/prisma"/);
assert.match(selectMortality, /listMortalityHouses/);
assert.doesNotMatch(selectMortality, /take:\s*1/);
assert.match(farmPage, /FarmDetailClient/);
assert.match(expoData, /ensureHousesOnActiveFlock\(farmId\)/);
assert.match(expoData, /ensureHousesOnActiveFlock\(f\.id\)/);
assert.match(expoData, /planAttachMissingHousesToActiveFlock/);

const createHouseIdx = farms.indexOf("export async function createHouseAction");
const nextExport = farms.indexOf("export async function", createHouseIdx + 1);
const createHouse = farms.slice(createHouseIdx, nextExport);
assert.match(createHouse, /ensureActiveFlockHouseFlocks/);
assert.match(createHouse, /revalidatePath\("\/mortality"\)/);

console.log("mortality-new-house: ok");
