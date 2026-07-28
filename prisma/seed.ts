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
import { addDays, format, getDay, nextDay, startOfDay, subDays } from "date-fns";

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
  await prisma.houseFlock.deleteMany();
  await prisma.farmIssue.deleteMany();
  await prisma.farmVisit.deleteMany();
  await prisma.litterEvent.deleteMany();
  await prisma.flock.deleteMany();
  await prisma.house.deleteMany();
  await prisma.farm.deleteMany();
  await prisma.userSettings.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("password123", 12);
  const user = await prisma.user.create({
    data: {
      name: "Alex Technician",
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

  const today = startOfDay(new Date());

  // Catch dates chosen so Weight Projection / LFO land in the next week
  const catchMon = upcomingWeekday(today, 1); // Mon → WP Tue before, LFO Fri before
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
      note: `Catch Mon ${format(catchMon, "MMM d")} — 28 overdue, 35 Day + Weight Projection + LFO`,
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
        notes: demo.note,
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

    if (demos.indexOf(demo) === 2) {
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

  console.log("Seed complete — 8 demo farms with staggered follow-ups.");
  console.log("Login: tech@poultry.local / password123");
  for (const d of demos) {
    console.log(
      `- ${d.farmName}: place ${format(d.placementDate, "EEE MMM d")} → catch ${format(d.projectedCatchDate, "EEE MMM d")} (${d.note})`,
    );
  }
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
