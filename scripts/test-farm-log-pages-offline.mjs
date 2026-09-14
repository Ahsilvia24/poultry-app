import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

assert.ok(existsSync(join(root, "src/lib/offline/selectIssues.ts")));
assert.ok(existsSync(join(root, "src/lib/offline/selectLitter.ts")));
assert.ok(existsSync(join(root, "src/lib/offline/selectFeed.ts")));
assert.ok(existsSync(join(root, "src/components/FarmLogListTile.tsx")));
assert.ok(existsSync(join(root, "src/app/(dashboard)/farms/[id]/issues/page.tsx")));
assert.ok(existsSync(join(root, "src/app/(dashboard)/farms/[id]/issues/new/page.tsx")));
assert.ok(existsSync(join(root, "src/app/(dashboard)/farms/[id]/issues/[issueId]/page.tsx")));
assert.ok(existsSync(join(root, "src/app/(dashboard)/farms/[id]/litter/page.tsx")));
assert.ok(existsSync(join(root, "src/app/(dashboard)/farms/[id]/litter/new/page.tsx")));
assert.ok(existsSync(join(root, "src/app/(dashboard)/farms/[id]/litter/[eventId]/page.tsx")));
assert.ok(existsSync(join(root, "src/app/(dashboard)/farms/[id]/feed/page.tsx")));
assert.ok(existsSync(join(root, "src/app/(dashboard)/farms/[id]/feed/new/page.tsx")));
assert.ok(existsSync(join(root, "src/app/(dashboard)/farms/[id]/feed/[deliveryId]/page.tsx")));
assert.ok(existsSync(join(root, "mobile/app/(tabs)/farms/[id]/issues/index.tsx")));
assert.ok(existsSync(join(root, "mobile/app/(tabs)/farms/[id]/litter/index.tsx")));
assert.ok(existsSync(join(root, "mobile/app/(tabs)/farms/[id]/feed/index.tsx")));
assert.equal(existsSync(join(root, "src/components/FarmIssuesSection.tsx")), false);
assert.equal(existsSync(join(root, "src/components/FarmLitterSection.tsx")), false);
assert.equal(existsSync(join(root, "src/components/FarmFeedSection.tsx")), false);

const { applyFormWrite } = await import(join(root, "src/lib/offline/applyWrites.ts"));
const { isReplicaHref } = await import(join(root, "src/lib/offline/hasFarmGraph.ts"));
const { selectIssue, selectIssues } = await import(join(root, "src/lib/offline/selectIssues.ts"));
const { selectLitter, selectLitterEvent } = await import(join(root, "src/lib/offline/selectLitter.ts"));
const { selectFeed, selectFeedDelivery } = await import(join(root, "src/lib/offline/selectFeed.ts"));

for (const kind of ["issues", "litter", "feed"]) {
  assert.equal(isReplicaHref(`/farms/abc/${kind}`), true);
  assert.equal(isReplicaHref(`/farms/abc/${kind}/new`), true);
  assert.equal(isReplicaHref(`/farms/abc/${kind}/row-1`), true);
  assert.equal(isReplicaHref(`/farms/new/${kind}`), false);
}

function snapshot() {
  return {
    version: 2,
    userId: "user-1",
    userName: "Alex",
    userEmail: "alex@example.com",
    pulledAt: "2026-09-14T12:00:00.000Z",
    settings: {
      farmOrder: "name_asc",
      appTimeZone: "America/Chicago",
      dailyMortalityWarningPct: 0.15,
      dailyMortalityCriticalPct: 0.3,
      sevenDayMortalityWarningPct: 1,
      sevenDayMortalityCriticalPct: 2,
      alertRisingThreeDays: true,
      defaultMarketAgeDays: 52,
      notifyEmail: false,
      notifyInApp: true,
    },
    farms: [
      {
        id: "farm-1",
        farmName: "Oak Ridge",
        growerName: "Pat",
        farmNumber: "1",
        phoneNumber: null,
        isActive: true,
        deletedAt: null,
        notes: null,
        numberOfHouses: 1,
        numberOfGenerators: null,
        address: null,
        city: null,
        state: null,
        zipCode: null,
      },
    ],
    houses: [
      {
        id: "house-1",
        farmId: "farm-1",
        houseNumber: 1,
        squareFootage: 20000,
        totalFanCFM: null,
        totalPowerCFM: null,
        numberOfFans: null,
        notes: null,
        loggedTemp: null,
        loggedTempAt: null,
        deletedAt: null,
      },
    ],
    flocks: [
      {
        id: "flock-1",
        farmId: "farm-1",
        flockNumber: "A1",
        flockStatus: "ACTIVE",
        placementDate: "2026-09-01",
        projectedCatchDate: "2026-10-23",
        actualCatchDate: null,
        targetMarketAge: 52,
        growthRateLbsPerDay: null,
        deletedAt: null,
      },
    ],
    houseFlocks: [
      {
        id: "hf-1",
        flockId: "flock-1",
        houseId: "house-1",
        placedBirdCount: 20000,
        placementDate: "2026-09-01",
        catchDate: "2026-10-23",
        catchTime: null,
      },
    ],
    mortalities: [],
    visits: [],
    issues: Array.from({ length: 10 }, (_, i) => ({
      id: `issue-${i + 1}`,
      farmId: "farm-1",
      houseId: null,
      flockId: "flock-1",
      dateReported: `2026-09-${String(i + 1).padStart(2, "0")}`,
      category: "OTHER",
      priority: "MEDIUM",
      description: `Issue ${i + 1}`,
      correctiveAction: null,
      assignedTo: null,
      status: "OPEN",
    })),
    litterEvents: Array.from({ length: 10 }, (_, i) => ({
      id: `litter-${i + 1}`,
      farmId: "farm-1",
      houseId: "house-1",
      eventDate: `2026-09-${String(i + 1).padStart(2, "0")}`,
      eventType: "CAKE_OUT",
      litterDepth: null,
      contractor: null,
      notes: null,
    })),
    feedDeliveries: Array.from({ length: 10 }, (_, i) => ({
      id: `feed-${i + 1}`,
      flockId: "flock-1",
      houseFlockId: "hf-1",
      deliveryDate: `2026-09-${String(i + 1).padStart(2, "0")}`,
      feedType: "Starter",
      feedMill: "Heavener",
      ticketNumber: null,
      poundsDelivered: 1000 + i,
      notes: null,
    })),
    lfos: [],
    lfoInventories: [],
    generatorLogs: [],
    dashboard: null,
  };
}

const issues = selectIssues(snapshot(), "farm-1");
assert.ok(issues);
assert.equal(issues.farmName, "Oak Ridge");
assert.equal(issues.activeFlockId, "flock-1");
assert.equal(issues.houses.length, 1);
assert.equal(issues.issues.length, 10, "issues page lists every issue, not a farm-page slice");
assert.equal(issues.issues[0].id, "issue-10");
assert.equal(selectIssue(snapshot(), "farm-1", "issue-3")?.dateReported, "2026-09-03");
assert.equal(selectIssue(snapshot(), "farm-1", "missing"), null);
assert.equal(selectIssues(snapshot(), "farm-missing"), null);

const createdIssue = applyFormWrite(snapshot(), {
  action: "createIssue",
  id: "local-issue-1",
  farmId: "farm-1",
  fields: {
    farmId: "farm-1",
    dateReported: "2026-09-14",
    category: "EQUIPMENT",
    description: "Fan down",
  },
});
assert.equal(selectIssues(createdIssue, "farm-1")?.issues[0].id, "local-issue-1");
const deletedIssue = applyFormWrite(createdIssue, {
  action: "deleteIssue",
  id: "local-issue-1",
  farmId: "farm-1",
});
assert.equal(
  selectIssues(deletedIssue, "farm-1")?.issues.some((row) => row.id === "local-issue-1"),
  false,
);

const litter = selectLitter(snapshot(), "farm-1");
assert.ok(litter);
assert.equal(litter.events.length, 10);
assert.equal(litter.events[0].id, "litter-10");
assert.equal(litter.events[0].houseNumber, 1);
assert.equal(selectLitterEvent(snapshot(), "farm-1", "litter-3")?.eventDate, "2026-09-03");

const createdLitter = applyFormWrite(snapshot(), {
  action: "createLitter",
  id: "local-litter-1",
  farmId: "farm-1",
  fields: {
    farmId: "farm-1",
    eventDate: "2026-09-14",
    eventType: "FULL_LITTER_CLEANOUT",
  },
});
assert.equal(selectLitter(createdLitter, "farm-1")?.events[0].id, "local-litter-1");
const deletedLitter = applyFormWrite(createdLitter, {
  action: "deleteLitter",
  id: "local-litter-1",
  farmId: "farm-1",
});
assert.equal(
  selectLitter(deletedLitter, "farm-1")?.events.some((row) => row.id === "local-litter-1"),
  false,
);

const feed = selectFeed(snapshot(), "farm-1");
assert.ok(feed);
assert.equal(feed.deliveries.length, 10);
assert.equal(feed.deliveries[0].id, "feed-10");
assert.equal(feed.feedFarms[0].flocks[0].houses[0].houseFlockId, "hf-1");
assert.equal(selectFeedDelivery(snapshot(), "farm-1", "feed-3")?.deliveryDate, "2026-09-03");

const createdFeed = applyFormWrite(snapshot(), {
  action: "createFeed",
  id: "local-feed-1",
  farmId: "farm-1",
  fields: {
    flockId: "flock-1",
    houseFlockId: "hf-1",
    deliveryDate: "2026-09-14",
    poundsDelivered: "2500",
    feedType: "Starter",
  },
});
assert.equal(selectFeed(createdFeed, "farm-1")?.deliveries[0].id, "local-feed-1");
const deletedFeed = applyFormWrite(createdFeed, {
  action: "deleteFeed",
  id: "local-feed-1",
  farmId: "farm-1",
});
assert.equal(
  selectFeed(deletedFeed, "farm-1")?.deliveries.some((row) => row.id === "local-feed-1"),
  false,
);

const swipe = read("src/components/SwipeCommitDeleteRow.tsx");
assert.match(swipe, /button, input, textarea, select, \[data-no-swipe\]/);
assert.doesNotMatch(swipe, /closest\("a, button/);
assert.match(swipe, /passive: false/);
assert.match(swipe, /touchAction: "pan-y"/);

const tile = read("src/components/FarmLogListTile.tsx");
assert.match(tile, /useReplicaNavigate/);
assert.match(tile, /SwipeCommitDeleteRow/);
assert.match(tile, /role="link"/);
assert.match(tile, /setGone\(true\)/);
assert.doesNotMatch(tile, /<ReplicaLink/);
assert.doesNotMatch(tile, /<a /);

const hook = read("src/lib/offline/useHiddenReplicaDeletes.ts");
assert.match(hook, /setHiddenIds/);
assert.match(hook, /queue\(formWrite/);
assert.doesNotMatch(hook, /startTransition\(async \(\) => \{\s*if \(enabled\)/);

const visitTile = read("src/components/LoggedVisitTile.tsx");
assert.match(visitTile, /FarmLogListTile/);
assert.doesNotMatch(visitTile, /<ReplicaLink/);

for (const file of [
  "src/components/FarmVisitsView.tsx",
  "src/components/FarmIssuesView.tsx",
  "src/components/FarmLitterView.tsx",
  "src/components/FarmFeedView.tsx",
]) {
  const src = read(file);
  assert.match(src, /useHiddenReplicaDeletes/);
  assert.doesNotMatch(src, /startTransition/);
  assert.doesNotMatch(src, /startDelete/);
}

const missingVisits = applyFormWrite(
  { ...snapshot(), visits: undefined },
  { action: "deleteVisit", id: "visit-1", farmId: "farm-1" },
);
assert.equal(Array.isArray(missingVisits.visits), true);

const nav = read("src/components/OfflineNav.tsx");
assert.match(nav, /selectIssues/);
assert.match(nav, /selectLitter/);
assert.match(nav, /selectFeed/);
assert.match(nav, /FarmIssuesView/);
assert.match(nav, /FarmLitterView/);
assert.match(nav, /FarmFeedView/);
assert.match(nav, /issuesList/);
assert.match(nav, /litterList/);
assert.match(nav, /feedList/);

const links = read("src/components/FarmQuickLinks.tsx");
assert.match(links, /issuesHref = `\/farms\/\$\{farmId\}\/issues`/);
assert.match(links, /litterHref = `\/farms\/\$\{farmId\}\/litter`/);
assert.match(links, /feedHref = `\/farms\/\$\{farmId\}\/feed`/);
assert.doesNotMatch(links, /#issues/);
assert.doesNotMatch(links, /#litter/);
assert.doesNotMatch(links, /#feed/);

const farm = read("src/components/FarmDetailView.tsx");
assert.doesNotMatch(farm, /FarmIssuesSection/);
assert.doesNotMatch(farm, /FarmLitterSection/);
assert.doesNotMatch(farm, /FarmFeedSection/);

const expoFarm = read("mobile/app/(tabs)/farms/[id]/index.tsx");
assert.match(expoFarm, /pathname: "\/\(tabs\)\/farms\/\[id\]\/issues"/);
assert.match(expoFarm, /pathname: "\/\(tabs\)\/farms\/\[id\]\/litter"/);
assert.match(expoFarm, /pathname: "\/\(tabs\)\/farms\/\[id\]\/feed"/);
assert.doesNotMatch(expoFarm, /Recent Issues/);
assert.doesNotMatch(expoFarm, /Litter Events/);
assert.doesNotMatch(expoFarm, /Feed Deliveries/);

const expoIssues = read("mobile/app/(tabs)/farms/[id]/issues/index.tsx");
assert.match(expoIssues, /listFarmIssues/);
assert.match(expoIssues, /SwipeCommitDeleteRow/);
assert.match(expoIssues, /deleteIssue/);

const expoLitter = read("mobile/app/(tabs)/farms/[id]/litter/index.tsx");
assert.match(expoLitter, /listFarmLitterEvents/);
assert.match(expoLitter, /deleteLitterEvent/);

const expoFeed = read("mobile/app/(tabs)/farms/[id]/feed/index.tsx");
assert.match(expoFeed, /listFarmFeedDeliveries/);
assert.match(expoFeed, /deleteFeedDelivery/);

const issueForm = read("mobile/src/components/IssueFormScreen.tsx");
assert.match(issueForm, /getFarmLogHouses/);
assert.doesNotMatch(issueForm, /getFarmDetail/);

const litterForm = read("mobile/src/components/LitterFormScreen.tsx");
assert.match(litterForm, /getFarmLogHouses/);
assert.doesNotMatch(litterForm, /getFarmDetail/);

const feedForm = read("mobile/src/components/FeedFormScreen.tsx");
assert.match(feedForm, /getFarmFeedContext/);
assert.doesNotMatch(feedForm, /getFarmDetail/);

console.log("farm-log-pages-offline ok");
