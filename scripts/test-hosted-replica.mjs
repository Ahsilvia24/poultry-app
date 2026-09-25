import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyPhoneSnapshot } from "../src/lib/offline/emptySnapshot.ts";
import {
  clearHostedReplicaMemory,
  loadHostedReplica,
  saveHostedReplica,
  websiteHasPhoneFarms,
} from "../src/lib/offline/hostedReplica.ts";
import { setHostedReplicaDurableStore } from "../src/lib/offline/replicaStore.ts";

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
const phoneWithWork = {
  ...phone,
  mortalities: [
    {
      id: "m1",
      houseFlockId: "hf1",
      mortalityDate: "2026-09-24",
      birdAgeInDays: 10,
      dailyMortalityCount: 2,
      cullCount: 0,
      totalDailyLoss: 2,
      isDraft: false,
    },
  ],
};
assert.equal(
  websiteHasPhoneFarms(phoneWithWork, website),
  false,
  "same farm names are not enough when website is missing phone work",
);

setHostedReplicaDurableStore(null);
clearHostedReplicaMemory();
assert.equal(await saveHostedReplica("Tech@Poultry.local", phone), null);
assert.equal(await loadHostedReplica("tech@poultry.local"), null);

const durable = new Map();
setHostedReplicaDurableStore({
  async put(key, snapshot) {
    durable.set(key, snapshot);
    return true;
  },
  async get(key) {
    return durable.get(key) ?? null;
  },
});

const stored = await saveHostedReplica("Tech@Poultry.local", phone);
assert.ok(stored);
assert.equal(stored.userEmail, "tech@poultry.local");
const loaded = await loadHostedReplica("tech@poultry.local");
assert.equal(websiteHasPhoneFarms(phone, loaded), true);
assert.equal(loaded?.farms[0]?.farmName, "Weylin Groom");

clearHostedReplicaMemory();
const fromDurable = await loadHostedReplica("tech@poultry.local");
assert.equal(websiteHasPhoneFarms(phone, fromDurable), true);

setHostedReplicaDurableStore({
  async put() {
    return true;
  },
  async get() {
    return null;
  },
});
clearHostedReplicaMemory();
assert.equal(await saveHostedReplica("tech@poultry.local", phone), null);

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

let posts = 0;
let gets = 0;
globalThis.fetch = async (_url, init) => {
  const method = String(init?.method || "GET").toUpperCase();
  if (method === "POST") {
    posts += 1;
    return new Response(JSON.stringify({ ok: true, snapshot: phone }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  gets += 1;
  return new Response(JSON.stringify({ ok: true, snapshot: empty }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
assert.equal(await pushPhoneReplicaToWebsite(phone), false);
assert.equal(posts, 1);
assert.equal(gets, 1);

const sync = read("src/lib/offline/syncPhoneToWebsite.ts");
assert.match(sync, /pushPhoneReplicaToWebsite/);
assert.match(sync, /\/api\/offline\/snapshot/);
assert.match(sync, /websiteHasPhoneFarms/);
assert.match(sync, /method: "GET"/);
assert.doesNotMatch(sync, /Work is already up/);

const hosted = read("src/lib/offline/hostedReplica.ts");
assert.match(hosted, /putDurableReplica/);
assert.match(hosted, /getDurableReplica/);
assert.doesNotMatch(hosted, /\/tmp\/poultry-hosted-replicas/);

const store = read("src/lib/offline/replicaStore.ts");
assert.match(store, /hosted_phone_replica/);
assert.match(store, /@neondatabase\/serverless/);
assert.match(store, /setHostedReplicaDurableStore/);

const route = read("src/app/api/offline/snapshot/route.ts");
assert.match(route, /export async function POST/);
assert.match(route, /saveHostedReplica/);
assert.match(route, /loadHostedReplica/);
assert.match(route, /websiteHasPhoneFarms/);

console.log("hosted-replica: ok");
