import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyPhoneSnapshot } from "../src/lib/offline/emptySnapshot.ts";
import {
  loadHostedReplica,
  saveHostedReplica,
  websiteHasPhoneFarms,
} from "../src/lib/offline/hostedReplica.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const empty = emptyPhoneSnapshot({
  userId: "user_1",
  userEmail: "tech@poultry.local",
  userName: "Tech",
});
const farm = {
  id: "farm_1",
  farmName: "Weylin Groom",
  growerName: "Grower",
  farmNumber: "1",
  phoneNumber: null,
  isActive: true,
  deletedAt: null,
  notes: null,
  numberOfHouses: 2,
  numberOfGenerators: null,
  address: null,
  city: null,
  state: null,
  zipCode: null,
};
const phone = { ...empty, farms: [farm] };
const website = { ...empty, farms: [{ ...farm }] };

assert.equal(websiteHasPhoneFarms(phone, website), true);
assert.equal(websiteHasPhoneFarms(phone, empty), false);
assert.equal(websiteHasPhoneFarms(phone, null), false);
assert.equal(websiteHasPhoneFarms(empty, empty), true);

const stored = await saveHostedReplica("Tech@Poultry.local", phone);
assert.ok(stored);
assert.equal(stored.userEmail, "tech@poultry.local");
const loaded = await loadHostedReplica("tech@poultry.local");
assert.equal(websiteHasPhoneFarms(phone, loaded), true);
assert.equal(loaded?.farms[0]?.farmName, "Weylin Groom");

const { pushPhoneReplicaToWebsite } = await import(join(root, "src/lib/offline/syncPhoneToWebsite.ts"));
globalThis.fetch = async () => new Response(JSON.stringify({ ok: false }), { status: 500 });
assert.equal(await pushPhoneReplicaToWebsite(phone), false);
globalThis.fetch = async () =>
  new Response(JSON.stringify({ ok: true, snapshot: phone }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
assert.equal(await pushPhoneReplicaToWebsite(phone), true);
globalThis.fetch = async () =>
  new Response(JSON.stringify({ ok: true, snapshot: empty }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
assert.equal(await pushPhoneReplicaToWebsite(phone), false);

const sync = read("src/lib/offline/syncPhoneToWebsite.ts");
assert.match(sync, /pushPhoneReplicaToWebsite/);
assert.match(sync, /\/api\/offline\/snapshot/);
assert.match(sync, /websiteHasPhoneFarms/);
assert.doesNotMatch(sync, /Work is already up/);

const route = read("src/app/api/offline/snapshot/route.ts");
assert.match(route, /export async function POST/);
assert.match(route, /saveHostedReplica/);
assert.match(route, /loadHostedReplica/);
assert.match(route, /websiteHasPhoneFarms/);

console.log("hosted-replica: ok");
