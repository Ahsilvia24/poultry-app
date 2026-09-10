import {
  PrismaClient,
  MortalityCause,
  FlockSex,
  FlockStatus,
  LitterEventType,
  VisitType,
  IssueCategory,
  IssuePriority,
  IssueStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, format, getDay, nextDay, startOfDay, startOfWeek, subDays, subWeeks } from "date-fns";

const prisma = new PrismaClient();

function lossForDay(day: number, houseIndex: number): { mort: number; cull: number; cause: MortalityCause } {
  const base = houseIndex % 3 === 0 ? 3 : houseIndex % 3 === 1 ? 2 : 1;
  const mort = Math.max(0, base + (day < 7 ? 2 : 0) + (day % 5 === 0 ? 2 : 0));
  // Culls are a subset of mortality (not added on top)
  const cull = Math.min(day % 4 === 0 ? 1 : 0, mort);
  const causes: MortalityCause[] = [
    "EARLY_MORTALITY",
    "LEG_ISSUES",
    "FLIP_OVER",
    "RESPIRATORY",
    "UNKNOWN",
    "HEAT_STRESS",
    "CULL",
  ];
  return { mort, cull, cause: causes[day % causes.length]! };
}

async function createHouses(farmId: string, count: number, baseYear = 2015) {
  const houses = [];
  for (let i = 1; i <= count; i++) {
    houses.push(
      await prisma.house.create({
        data: {
          farmId,
          houseNumber: i,
          squareFootage: 24000 + i * 200,
          totalFanCFM: 170000,
          numberOfFans: 11,
          coolingPadSquareFootage: 1100,
          controllerType: i % 2 === 0 ? "Rotem" : "Chore-Tronics",
          yearBuilt: baseYear + (i % 6),
          minVentilationCFM: 11000,
        },
      }),
    );
  }
  return houses;
}

async function createActiveFlock(input: {
  userId: string;
  farmId: string;
  houseIds: string[];
  flockNumber: string;
  placementDate: Date;
  projectedCatchDate: Date;
  birdType?: string;
}) {
  const placementDate = startOfDay(input.placementDate);
  const projectedCatchDate = startOfDay(input.projectedCatchDate);
  const today = startOfDay(new Date());
  const ageToday = Math.max(0, Math.min(
    Math.floor((today.getTime() - placementDate.getTime()) / 86400000),
    Math.floor((projectedCatchDate.getTime() - placementDate.getTime()) / 86400000),
  ));
  const perHouse = 22000 + (input.houseIds.length % 3) * 500;
  const marketAge = Math.round(
    (projectedCatchDate.getTime() - placementDate.getTime()) / 86400000,
  );

  const flock = await prisma.flock.create({
    data: {
      farmId: input.farmId,
      flockNumber: input.flockNumber,
      flockName: `Active ${input.flockNumber}`,
      placementDate,
      projectedCatchDate,
      processingPlant: "Central Processing",
      birdType: input.birdType ?? "Ross 708",
      sex: FlockSex.STRAIGHT_RUN,
      initialBirdCount: perHouse * input.houseIds.length,
      flockStatus: FlockStatus.ACTIVE,
      targetMarketAge: marketAge,
      targetMarketWeight: 6.4,
      litterConditionAtPlacement: "Fresh cake removed",
      houseFlocks: {
        create: input.houseIds.map((houseId) => ({ houseId, placedBirdCount: perHouse })),
      },
    },
    include: { houseFlocks: true },
  });

  // Only seed mortality for ages that have already started
  if (ageToday >= 0 && placementDate <= today) {
    for (let hi = 0; hi < flock.houseFlocks.length; hi++) {
      const hf = flock.houseFlocks[hi]!;
      for (let d = 0; d <= ageToday; d++) {
        const dayLoss = lossForDay(d, hi);
        await prisma.dailyMortality.create({
          data: {
            houseFlockId: hf.id,
            mortalityDate: addDays(placementDate, d),
            birdAgeInDays: d,
            dailyMortalityCount: dayLoss.mort,
            cullCount: dayLoss.cull,
            totalDailyLoss: dayLoss.mort,
            mortalityCause: dayLoss.cause,
            enteredByUserId: input.userId,
          },
        });
      }
      if (ageToday >= 5) {
        await prisma.feedDelivery.create({
          data: {
            flockId: flock.id,
            houseFlockId: hf.id,
            deliveryDate: addDays(placementDate, Math.min(5, ageToday)),
            feedType: "Starter",
            feedMill: "Valley Feed",
            ticketNumber: `ACTIVE-${input.flockNumber}-${hi + 1}`,
            poundsDelivered: 24000,
            tonsDelivered: 12,
          },
        });
      }
    }
  }

  return flock;
}

/** Next weekday from today (0=Sun … 6=Sat). If today is that day, use next week. */
function upcomingWeekday(from: Date, weekday: number) {
  const d = startOfDay(from);
  if (getDay(d) === weekday) return addDays(d, 7);
  return startOfDay(nextDay(d, weekday as 0 | 1 | 2 | 3 | 4 | 5 | 6));
}

async function main() {
  await prisma.dailyMortality.deleteMany();
  await prisma.flockPerformance.deleteMany();
  await prisma.feedDelivery.deleteMany();
  await prisma.followUpCompletion.deleteMany();
  await prisma.lastFeedOrder.deleteMany();
  await prisma.houseFlock.deleteMany();
  await prisma.farmIssue.deleteMany();
  await prisma.farmVisit.deleteMany();
  await prisma.litterEvent.deleteMany();
  await prisma.flock.deleteMany();
  await prisma.house.deleteMany();
  await prisma.farm.deleteMany();
  await prisma.userSettings.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 12);
  // Keep a stable tech user id across re-seeds so live sessions stay valid.
  const user = await prisma.user.upsert({
    where: { email: "tech@poultry.local" },
    update: {
      name: "Alex Silvia",
      passwordHash,
      settings: {
        upsert: {
          create: {
            dailyMortalityWarningPct: 0.15,
            dailyMortalityCriticalPct: 0.3,
            sevenDayMortalityWarningPct: 1.0,
            sevenDayMortalityCriticalPct: 2.0,
          },
          update: {
            dailyMortalityWarningPct: 0.15,
            dailyMortalityCriticalPct: 0.3,
            sevenDayMortalityWarningPct: 1.0,
            sevenDayMortalityCriticalPct: 2.0,
          },
        },
      },
    },
    create: {
      name: "Alex Silvia",
      email: "tech@poultry.local",
      passwordHash,
      settings: {
        create: {
          dailyMortalityWarningPct: 0.15,
          dailyMortalityCriticalPct: 0.3,
          sevenDayMortalityWarningPct: 1.0,
          sevenDayMortalityCriticalPct: 2.0,
        },
      },
    },
  });

  // Drop any other seeded users (keep tech session stable).
  await prisma.user.deleteMany({ where: { email: { not: "tech@poultry.local" } } });

  const today = startOfDay(new Date());

  // Catch dates chosen so Weight Projection / LFO land in the next week
  const catchMon = upcomingWeekday(today, 1); // Mon → WP Tue before, LFO Thu before
  const catchThu = upcomingWeekday(today, 4); // Thu → WP Fri before, LFO Mon before
  const catchWed = upcomingWeekday(today, 3);

  type Demo = {
    farmName: string;
    growerName: string;
    phoneNumber: string;
    houses: number;
    flockNumber: string;
    placementDate: Date;
    projectedCatchDate: Date;
    note: string;
  };

  // Placement ages are relative to seed-run "today". Today's schedule only shows
  // visits due on the calendar day, so after midnight those items drop off.
  // Include a T+1 Prebrood farm so a one-night-old seed still has something due.
  const demos: Demo[] = [
    {
      farmName: "Oak Hollow",
      growerName: "Dan Reeves",
      phoneNumber: "410-555-0110",
      houses: 2,
      flockNumber: "OH-410",
      placementDate: addDays(today, 2),
      projectedCatchDate: addDays(addDays(today, 2), 42),
      note: "Prebrood today / Placement in 2 days",
    },
    {
      farmName: "Ash Grove",
      growerName: "Riley Chen",
      phoneNumber: "410-555-0118",
      houses: 2,
      flockNumber: "AG-119",
      placementDate: addDays(today, 3),
      projectedCatchDate: addDays(addDays(today, 3), 42),
      note: "Prebrood tomorrow (keeps Today's schedule non-empty overnight)",
    },
    {
      farmName: "Willow Bend",
      growerName: "Pat Nguyen",
      phoneNumber: "410-555-0111",
      houses: 3,
      flockNumber: "WB-220",
      placementDate: today,
      projectedCatchDate: addDays(today, 42),
      note: "Placement today",
    },
    {
      farmName: "Cedar Creek",
      growerName: "John Miller",
      phoneNumber: "410-555-0112",
      houses: 4,
      flockNumber: "CC-103",
      placementDate: subDays(today, 3),
      projectedCatchDate: addDays(subDays(today, 3), 42),
      note: "3 Day due",
    },
    {
      farmName: "Pine Ridge",
      growerName: "Maria Santos",
      phoneNumber: "410-555-0113",
      houses: 4,
      flockNumber: "PR-204",
      placementDate: subDays(today, 7),
      projectedCatchDate: addDays(subDays(today, 7), 42),
      note: "7 Day due",
    },
    {
      farmName: "Maple Grove",
      growerName: "Chris Bailey",
      phoneNumber: "410-555-0114",
      houses: 3,
      flockNumber: "MG-315",
      placementDate: subDays(today, 14),
      projectedCatchDate: addDays(subDays(today, 14), 42),
      note: "14 Day due",
    },
    {
      farmName: "Bay View",
      growerName: "Elena Cruz",
      phoneNumber: "410-555-0115",
      houses: 12,
      flockNumber: "BV-118",
      placementDate: subDays(today, 21),
      projectedCatchDate: addDays(subDays(today, 21), 42),
      note: "21 Day due",
    },
    {
      farmName: "Sunrise Farms",
      growerName: "Tom Harper",
      phoneNumber: "410-555-0116",
      houses: 3,
      flockNumber: "SF-507",
      placementDate: subDays(catchMon, 42),
      projectedCatchDate: catchMon,
      note: `Catch Mon ${format(catchMon, "MMM d")} — Weight Projection / LFO near catch`,
    },
    {
      farmName: "River Bend",
      growerName: "Sam Ortiz",
      phoneNumber: "410-555-0117",
      houses: 2,
      flockNumber: "RB-808",
      placementDate: subDays(today, 42),
      projectedCatchDate: catchThu,
      note: `42 Day due; Catch Thu ${format(catchThu, "MMM d")} — Weight Projection + LFO`,
    },
  ];

  void catchWed;

  for (const demo of demos) {
    const farm = await prisma.farm.create({
      data: {
        userId: user.id,
        farmName: demo.farmName,
        growerName: demo.growerName,
        phoneNumber: demo.phoneNumber,
        numberOfHouses: demo.houses,
      },
    });
    const houses = await createHouses(farm.id, demo.houses, 2014 + demos.indexOf(demo));
    await createActiveFlock({
      userId: user.id,
      farmId: farm.id,
      houseIds: houses.map((h) => h.id),
      flockNumber: demo.flockNumber,
      placementDate: demo.placementDate,
      projectedCatchDate: demo.projectedCatchDate,
    });

    if (demo.farmName === "Cedar Creek") {
      await prisma.farmIssue.create({
        data: {
          farmId: farm.id,
          houseId: houses[1]?.id,
          dateReported: subDays(today, 2),
          category: IssueCategory.WATER,
          priority: IssuePriority.HIGH,
          description: "Low pressure on drinker line B",
          assignedTo: "Grower",
          status: IssueStatus.OPEN,
        },
      });
      await prisma.farmVisit.create({
        data: {
          farmId: farm.id,
          visitDate: subDays(today, 1),
          birdAgeInDays: 2,
          visitType: VisitType.ROUTINE_SERVICE,
          generalBirdCondition: "Good",
          notes: "Walked houses after placement",
        },
      });
      await prisma.litterEvent.create({
        data: {
          farmId: farm.id,
          eventDate: subDays(demo.placementDate, 5),
          eventType: LitterEventType.DE_CAKING,
          litterDepth: 3,
          contractor: "Grower",
        },
      });
    }
  }

  // Multi-flock farm: 3 concurrent placements (houses 1–2, 3–4, 5–6).
  // LFO / mortality must pull remaining birds from every house, not just flock 1.
  const triplePlaceHouses = 6;
  const tripleFarm = await prisma.farm.create({
    data: {
      userId: user.id,
      farmName: "Triple Place",
      growerName: "Alex Silvia",
      phoneNumber: "410-555-0199",
      numberOfHouses: triplePlaceHouses,
    },
  });
  const tripleHouses = await createHouses(tripleFarm.id, triplePlaceHouses, 2020);
  const tripleFlocks = [
    { flockNumber: "26-01", ageDays: 28, houseIndexes: [0, 1] },
    { flockNumber: "26-02", ageDays: 14, houseIndexes: [2, 3] },
    { flockNumber: "26-03", ageDays: 3, houseIndexes: [4, 5] },
  ];
  for (const spec of tripleFlocks) {
    const placementDate = subDays(today, spec.ageDays);
    await createActiveFlock({
      userId: user.id,
      farmId: tripleFarm.id,
      houseIds: spec.houseIndexes.map((i) => tripleHouses[i]!.id),
      flockNumber: spec.flockNumber,
      placementDate,
      projectedCatchDate: addDays(placementDate, 52),
    });
  }

  const farmsByName = await prisma.farm.findMany({
    where: { userId: user.id, deletedAt: null },
    select: { id: true, farmName: true },
  });
  const farmIdByName = new Map(farmsByName.map((f) => [f.farmName, f.id]));
  const thisMonday = startOfWeek(today, { weekStartsOn: 1 });
  const lastMonday = subWeeks(thisMonday, 1);
  const fieldLogStops: Array<{
    farm: string;
    weekStart: Date;
    offset: number;
    hour: number;
    minute: number;
  }> = [
    { farm: "Oak Hollow", weekStart: lastMonday, offset: 0, hour: 7, minute: 10 },
    { farm: "Maple Grove", weekStart: lastMonday, offset: 0, hour: 8, minute: 40 },
    { farm: "Bay View", weekStart: lastMonday, offset: 0, hour: 11, minute: 5 },
    { farm: "Cedar Creek", weekStart: lastMonday, offset: 1, hour: 7, minute: 20 },
    { farm: "Pine Ridge", weekStart: lastMonday, offset: 1, hour: 9, minute: 15 },
    { farm: "Willow Bend", weekStart: lastMonday, offset: 2, hour: 8, minute: 0 },
    { farm: "Triple Place", weekStart: lastMonday, offset: 2, hour: 10, minute: 20 },
    { farm: "Sunrise Farms", weekStart: lastMonday, offset: 3, hour: 7, minute: 45 },
    { farm: "River Bend", weekStart: lastMonday, offset: 4, hour: 10, minute: 30 },
    { farm: "Ash Grove", weekStart: lastMonday, offset: 5, hour: 9, minute: 0 },
    { farm: "Oak Hollow", weekStart: thisMonday, offset: 0, hour: 7, minute: 5 },
    { farm: "Maple Grove", weekStart: thisMonday, offset: 0, hour: 8, minute: 25 },
    { farm: "Bay View", weekStart: thisMonday, offset: 0, hour: 10, minute: 50 },
    { farm: "Cedar Creek", weekStart: thisMonday, offset: 1, hour: 7, minute: 40 },
    { farm: "Pine Ridge", weekStart: thisMonday, offset: 1, hour: 9, minute: 10 },
    { farm: "Willow Bend", weekStart: thisMonday, offset: 2, hour: 8, minute: 15 },
    { farm: "Triple Place", weekStart: thisMonday, offset: 2, hour: 10, minute: 5 },
    { farm: "Sunrise Farms", weekStart: thisMonday, offset: 3, hour: 7, minute: 50 },
    { farm: "River Bend", weekStart: thisMonday, offset: 4, hour: 10, minute: 20 },
    { farm: "Ash Grove", weekStart: thisMonday, offset: 5, hour: 8, minute: 45 },
  ];
  for (const stop of fieldLogStops) {
    const day = addDays(stop.weekStart, stop.offset);
    if (day > today) continue;
    const farmId = farmIdByName.get(stop.farm);
    if (!farmId) continue;
    const loggedAt = new Date(day);
    loggedAt.setHours(stop.hour, stop.minute, 0, 0);
    await prisma.farmVisit.create({
      data: {
        farmId,
        visitDate: day,
        loggedAt,
        visitType: VisitType.ROUTINE_SERVICE,
        generalBirdCondition: "Healthy",
      },
    });
  }

  const exerciseHours = [0.8, 0.9, 1.0, 1.1] as const;
  const seededFarms = await prisma.farm.findMany({
    where: { userId: user.id, deletedAt: null },
    orderBy: { farmName: "asc" },
    select: { id: true, farmName: true },
  });
  for (const [farmIndex, farm] of seededFarms.entries()) {
    const genCount = (farmIndex % 4) + 1;
    await prisma.farm.update({
      where: { id: farm.id },
      data: { numberOfGenerators: genCount },
    });
    let nameHash = 0;
    for (let i = 0; i < farm.farmName.length; i++) {
      nameHash = (nameHash + farm.farmName.charCodeAt(i)) % 80;
    }
    const baseHours = 90 + nameHash;
    for (let w = 5; w >= 0; w--) {
      const weekFromOldest = 5 - w;
      const logDate = subDays(today, 7 * w);
      const hours: Array<number | null> = [null, null, null, null];
      for (let g = 0; g < genCount; g++) {
        let reading = baseHours + g * 18;
        for (let i = 0; i < weekFromOldest; i++) {
          reading = Math.round((reading + exerciseHours[(i + g) % 4]) * 10) / 10;
        }
        hours[g] = reading;
      }
      await prisma.generatorLog.create({
        data: {
          farmId: farm.id,
          logDate,
          gen1Hours: hours[0],
          gen2Hours: hours[1],
          gen3Hours: hours[2],
          gen4Hours: hours[3],
        },
      });
    }
  }

  console.log(`Seed complete — ${demos.length + 1} demo farms relative to ${format(today, "yyyy-MM-dd")}.`);
  console.log("Re-run npm run db:seed after midnight so Today's schedule stays populated.");
  console.log("Login: tech@poultry.local / password123");
  for (const d of demos) {
    console.log(
      `- ${d.farmName}: place ${format(d.placementDate, "EEE MMM d")} → catch ${format(d.projectedCatchDate, "EEE MMM d")} (${d.note})`,
    );
  }
  console.log("- Triple Place: 6 houses / 3 active flocks (26-01 H1–2, 26-02 H3–4, 26-03 H5–6)");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
