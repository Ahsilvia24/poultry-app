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

function lossForDay(
  day: number,
  houseIndex: number,
  intensity: "low" | "normal" | "high" = "normal",
): { mort: number; cull: number; cause: MortalityCause } {
  const base =
    intensity === "high" ? 6 : intensity === "low" ? 1 : houseIndex % 3 === 0 ? 3 : houseIndex % 3 === 1 ? 2 : 1;
  const mort = Math.max(0, base + (day < 7 ? 2 : 0) + (day % 5 === 0 ? 2 : 0));
  const cull = day % 4 === 0 ? (intensity === "high" ? 2 : 1) : 0;
  const causes: MortalityCause[] = [
    MortalityCause.EARLY_MORTALITY,
    MortalityCause.LEG_ISSUES,
    MortalityCause.FLIP_OVER,
    MortalityCause.RESPIRATORY,
    MortalityCause.UNKNOWN,
    MortalityCause.HEAT_STRESS,
    MortalityCause.CULL,
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
          houseLength: 480,
          houseWidth: 50,
          totalFanCFM: 170000 + i * 2500,
          numberOfFans: 11 + (i % 3),
          coolingPadSquareFootage: 1100,
          feederType: i % 2 === 0 ? "Pan" : "Chain",
          drinkerType: "Nipple",
          controllerType: i % 2 === 0 ? "Rotem" : "Chore-Tronics",
          yearBuilt: baseYear + (i % 6),
          minVentilationCFM: 11000,
        },
      }),
    );
  }
  return houses;
}

async function createFlock(input: {
  userId: string;
  farmId: string;
  houseIds: string[];
  flockNumber: string;
  flockName?: string;
  placementDate: Date;
  projectedCatchDate: Date;
  actualCatchDate?: Date | null;
  status?: FlockStatus;
  birdType?: string;
  sex?: FlockSex;
  mortalityIntensity?: "low" | "normal" | "high";
  /** Skip every Nth day to leave missing-mortality gaps for testing alerts. */
  skipMortalityEvery?: number;
  withFeed?: boolean;
  weightSampleLbs?: number | null;
  growthRateLbsPerDay?: number | null;
  settlement?: {
    marketAgeInDays: number;
    weightLbs: number;
    feedConversion: number;
    adjustedFeedConversion: number;
    goodPoundsSold: number;
    settlementNo: number;
  } | null;
}) {
  const placementDate = startOfDay(input.placementDate);
  const projectedCatchDate = startOfDay(input.projectedCatchDate);
  const today = startOfDay(new Date());
  const status = input.status ?? FlockStatus.ACTIVE;
  const ageToday = Math.max(
    0,
    Math.min(
      Math.floor((today.getTime() - placementDate.getTime()) / 86400000),
      Math.floor((projectedCatchDate.getTime() - placementDate.getTime()) / 86400000),
    ),
  );
  const perHouse = 22000 + (input.houseIds.length % 3) * 500;
  const marketAge = Math.round(
    (projectedCatchDate.getTime() - placementDate.getTime()) / 86400000,
  );

  const flock = await prisma.flock.create({
    data: {
      farmId: input.farmId,
      flockNumber: input.flockNumber,
      flockName: input.flockName ?? `Flock ${input.flockNumber}`,
      placementDate,
      projectedCatchDate,
      actualCatchDate: input.actualCatchDate ? startOfDay(input.actualCatchDate) : null,
      processingPlant: "Central Processing",
      birdType: input.birdType ?? "Ross 708",
      sex: input.sex ?? FlockSex.STRAIGHT_RUN,
      initialBirdCount: perHouse * input.houseIds.length,
      flockStatus: status,
      targetMarketAge: marketAge,
      targetMarketWeight: 6.4,
      weightSampleLbs: input.weightSampleLbs ?? null,
      weightSampleDate:
        input.weightSampleLbs != null && ageToday >= 28
          ? subDays(today, 2)
          : null,
      growthRateLbsPerDay: input.growthRateLbsPerDay ?? 0.14,
      litterConditionAtPlacement: "Fresh cake removed",
      settlementMarketAgeInDays: input.settlement?.marketAgeInDays ?? null,
      settlementWeightLbs: input.settlement?.weightLbs ?? null,
      settlementFeedConversion: input.settlement?.feedConversion ?? null,
      settlementAdjustedFeedConversion: input.settlement?.adjustedFeedConversion ?? null,
      settlementGoodPoundsSold: input.settlement?.goodPoundsSold ?? null,
      settlementNo: input.settlement?.settlementNo ?? null,
      houseFlocks: {
        create: input.houseIds.map((houseId) => ({ houseId, placedBirdCount: perHouse })),
      },
    },
    include: { houseFlocks: true },
  });

  const seedMortality =
    status === FlockStatus.ACTIVE || status === FlockStatus.COMPLETED;
  if (seedMortality && placementDate <= today) {
    const maxAge =
      status === FlockStatus.COMPLETED && input.actualCatchDate
        ? Math.max(
            0,
            Math.floor(
              (startOfDay(input.actualCatchDate).getTime() - placementDate.getTime()) /
                86400000,
            ),
          )
        : ageToday;

    for (let hi = 0; hi < flock.houseFlocks.length; hi++) {
      const hf = flock.houseFlocks[hi]!;
      const rows = [];
      for (let d = 0; d <= maxAge; d++) {
        if (input.skipMortalityEvery && d > 0 && d % input.skipMortalityEvery === 0) {
          continue;
        }
        const dayLoss = lossForDay(d, hi, input.mortalityIntensity);
        rows.push({
          houseFlockId: hf.id,
          mortalityDate: addDays(placementDate, d),
          birdAgeInDays: d,
          dailyMortalityCount: dayLoss.mort,
          cullCount: dayLoss.cull,
          totalDailyLoss: dayLoss.mort + dayLoss.cull,
          mortalityCause: dayLoss.cause,
          enteredByUserId: input.userId,
        });
      }
      if (rows.length) {
        await prisma.dailyMortality.createMany({ data: rows });
      }

      if (input.withFeed !== false && maxAge >= 5) {
        await prisma.feedDelivery.create({
          data: {
            flockId: flock.id,
            houseFlockId: hf.id,
            deliveryDate: addDays(placementDate, Math.min(5, maxAge)),
            feedType: "Starter",
            feedMill: "Valley Feed",
            ticketNumber: `${input.flockNumber}-S-${hi + 1}`,
            poundsDelivered: 24000,
            tonsDelivered: 12,
          },
        });
        if (maxAge >= 18) {
          await prisma.feedDelivery.create({
            data: {
              flockId: flock.id,
              houseFlockId: hf.id,
              deliveryDate: addDays(placementDate, Math.min(18, maxAge)),
              feedType: "Grower",
              feedMill: "Valley Feed",
              ticketNumber: `${input.flockNumber}-G-${hi + 1}`,
              poundsDelivered: 42000,
              tonsDelivered: 21,
            },
          });
        }
      }

      if (status === FlockStatus.COMPLETED && input.settlement) {
        await prisma.flockPerformance.create({
          data: {
            houseFlockId: hf.id,
            marketAgeInDays: input.settlement.marketAgeInDays,
            averageLiveWeight: input.settlement.weightLbs,
            feedConversion: input.settlement.feedConversion,
            adjustedFeedConversion: input.settlement.adjustedFeedConversion,
            livabilityPercentage: 96.2 - hi * 0.3,
            mortalityPercentage: 3.8 + hi * 0.3,
            condemnationPercentage: 0.4,
            settlementDate: input.actualCatchDate
              ? addDays(startOfDay(input.actualCatchDate), 5)
              : null,
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
  await prisma.lastFeedOrderHouseInventory.deleteMany();
  await prisma.lastFeedOrder.deleteMany();
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
  const catchMon = upcomingWeekday(today, 1);
  const catchThu = upcomingWeekday(today, 4);
  const catchWed = upcomingWeekday(today, 3);
  const catchFri = upcomingWeekday(today, 5);

  type DemoFarm = {
    farmName: string;
    growerName: string;
    phoneNumber: string;
    email?: string;
    houses: number;
    isActive?: boolean;
    note: string;
    setup: (farmId: string, houseIds: string[]) => Promise<void>;
  };

  const demos: DemoFarm[] = [
    {
      farmName: "Oak Hollow",
      growerName: "Dan Reeves",
      phoneNumber: "410-555-0110",
      email: "dan@oakhollow.example",
      houses: 2,
      note: "Prebrood — placement in 2 days",
      setup: async (farmId, houseIds) => {
        await createFlock({
          userId: user.id,
          farmId,
          houseIds,
          flockNumber: "OH-410",
          placementDate: addDays(today, 2),
          projectedCatchDate: addDays(today, 44),
        });
        await prisma.litterEvent.create({
          data: {
            farmId,
            eventDate: subDays(today, 1),
            eventType: LitterEventType.FULL_LITTER_CLEANOUT,
            litterDepth: 4,
            contractor: "Eastern Litter Co",
            cost: 4200,
            notes: "Cleanout before next place",
          },
        });
      },
    },
    {
      farmName: "Willow Bend",
      growerName: "Pat Nguyen",
      phoneNumber: "410-555-0111",
      houses: 3,
      note: "Placement today",
      setup: async (farmId, houseIds) => {
        const flock = await createFlock({
          userId: user.id,
          farmId,
          houseIds,
          flockNumber: "WB-220",
          placementDate: today,
          projectedCatchDate: addDays(today, 42),
          birdType: "Cobb 500",
        });
        await prisma.farmVisit.create({
          data: {
            farmId,
            flockId: flock.id,
            visitDate: today,
            birdAgeInDays: 0,
            visitType: VisitType.PLACEMENT,
            generalBirdCondition: "Excellent",
            activityLevel: "Active",
            notes: "Chicks looking strong off the truck",
          },
        });
      },
    },
    {
      farmName: "Cedar Creek",
      growerName: "John Miller",
      phoneNumber: "410-555-0112",
      houses: 4,
      note: "Day 3 — open water issue + recent visit",
      setup: async (farmId, houseIds) => {
        const flock = await createFlock({
          userId: user.id,
          farmId,
          houseIds,
          flockNumber: "CC-103",
          placementDate: subDays(today, 3),
          projectedCatchDate: addDays(subDays(today, 3), 42),
        });
        await prisma.farmIssue.create({
          data: {
            farmId,
            houseId: houseIds[1],
            flockId: flock.id,
            dateReported: subDays(today, 1),
            category: IssueCategory.WATER,
            priority: IssuePriority.HIGH,
            description: "Low pressure on drinker line B",
            assignedTo: "Grower",
            status: IssueStatus.OPEN,
          },
        });
        await prisma.farmVisit.create({
          data: {
            farmId,
            flockId: flock.id,
            visitDate: subDays(today, 1),
            birdAgeInDays: 2,
            visitType: VisitType.SEVEN_DAY,
            generalBirdCondition: "Good",
            notes: "Walked houses; flagged water pressure",
            followUpRequired: true,
            followUpDate: addDays(today, 2),
          },
        });
        await prisma.litterEvent.create({
          data: {
            farmId,
            houseId: houseIds[0],
            eventDate: subDays(today, 8),
            eventType: LitterEventType.DE_CAKING,
            litterDepth: 3,
            contractor: "Grower",
          },
        });
      },
    },
    {
      farmName: "Pine Ridge",
      growerName: "Maria Santos",
      phoneNumber: "410-555-0113",
      houses: 4,
      note: "Day 7 — missing mortality gaps for alert testing",
      setup: async (farmId, houseIds) => {
        await createFlock({
          userId: user.id,
          farmId,
          houseIds,
          flockNumber: "PR-204",
          placementDate: subDays(today, 7),
          projectedCatchDate: addDays(subDays(today, 7), 42),
          skipMortalityEvery: 3,
          mortalityIntensity: "low",
        });
      },
    },
    {
      farmName: "Maple Grove",
      growerName: "Chris Bailey",
      phoneNumber: "410-555-0114",
      houses: 3,
      note: "Day 14 — elevated mortality",
      setup: async (farmId, houseIds) => {
        const flock = await createFlock({
          userId: user.id,
          farmId,
          houseIds,
          flockNumber: "MG-315",
          placementDate: subDays(today, 14),
          projectedCatchDate: addDays(subDays(today, 14), 42),
          mortalityIntensity: "high",
          sex: FlockSex.MALE,
        });
        await prisma.farmIssue.create({
          data: {
            farmId,
            houseId: houseIds[0],
            flockId: flock.id,
            dateReported: subDays(today, 3),
            category: IssueCategory.BIRD_HEALTH,
            priority: IssuePriority.CRITICAL,
            description: "Spike in early mortality / possible yolk infection",
            correctiveAction: "Vet consult scheduled",
            status: IssueStatus.MONITORING,
          },
        });
      },
    },
    {
      farmName: "Bay View",
      growerName: "Elena Cruz",
      phoneNumber: "410-555-0115",
      email: "elena@bayview.example",
      houses: 8,
      note: "Day 21 — large farm, weight sample + grower feed",
      setup: async (farmId, houseIds) => {
        await createFlock({
          userId: user.id,
          farmId,
          houseIds,
          flockNumber: "BV-118",
          placementDate: subDays(today, 21),
          projectedCatchDate: addDays(subDays(today, 21), 45),
          weightSampleLbs: 2.35,
          growthRateLbsPerDay: 0.145,
        });
        await prisma.farmVisit.create({
          data: {
            farmId,
            visitDate: subDays(today, 2),
            birdAgeInDays: 19,
            visitType: VisitType.WEIGH_DAY,
            uniformity: "Good",
            notes: "Sample weights on target",
          },
        });
      },
    },
    {
      farmName: "Sunrise Farms",
      growerName: "Tom Harper",
      phoneNumber: "410-555-0116",
      houses: 3,
      note: `Catch Mon ${format(catchMon, "MMM d")} — WP / LFO schedule + saved LFO`,
      setup: async (farmId, houseIds) => {
        const flock = await createFlock({
          userId: user.id,
          farmId,
          houseIds,
          flockNumber: "SF-507",
          placementDate: subDays(catchMon, 42),
          projectedCatchDate: catchMon,
          weightSampleLbs: 5.9,
          growthRateLbsPerDay: 0.15,
        });
        const lfo = await prisma.lastFeedOrder.create({
          data: {
            farmId,
            flockId: flock.id,
            orderDate: subDays(today, 1),
            consumptionRate: 0.48,
            notes: "Seeded LFO for catch week",
            houseInventories: {
              create: houseIds.map((houseId, i) => ({
                houseId,
                binAPounds: 18000 - i * 500,
                binBPounds: 12000 - i * 400,
                feedUpAt: addDays(catchMon, -1),
              })),
            },
          },
        });
        void lfo;
        await prisma.farmVisit.create({
          data: {
            farmId,
            flockId: flock.id,
            visitDate: subDays(today, 4),
            birdAgeInDays: 38,
            visitType: VisitType.PRE_CATCH,
            feedInventory: "Bins ~half",
            notes: "Pre-catch walk — litter dry",
          },
        });
      },
    },
    {
      farmName: "River Bend",
      growerName: "Sam Ortiz",
      phoneNumber: "410-555-0117",
      houses: 2,
      note: `Day 42 / Catch Thu ${format(catchThu, "MMM d")}`,
      setup: async (farmId, houseIds) => {
        await createFlock({
          userId: user.id,
          farmId,
          houseIds,
          flockNumber: "RB-808",
          placementDate: subDays(today, 42),
          projectedCatchDate: catchThu,
          weightSampleLbs: 6.2,
          birdType: "Ross 308",
        });
      },
    },
    {
      farmName: "Hilltop Broilers",
      growerName: "Nina Patel",
      phoneNumber: "410-555-0118",
      houses: 4,
      note: "Multi-flock: active mid-flock + completed prior with settlement",
      setup: async (farmId, houseIds) => {
        const completedCatch = subDays(today, 18);
        await createFlock({
          userId: user.id,
          farmId,
          houseIds,
          flockNumber: "HT-091",
          flockName: "Prior flock (settled)",
          placementDate: subDays(completedCatch, 43),
          projectedCatchDate: completedCatch,
          actualCatchDate: completedCatch,
          status: FlockStatus.COMPLETED,
          settlement: {
            marketAgeInDays: 43,
            weightLbs: 6.15,
            feedConversion: 1.72,
            adjustedFeedConversion: 1.68,
            goodPoundsSold: 510000,
            settlementNo: 2,
          },
        });
        await createFlock({
          userId: user.id,
          farmId,
          houseIds,
          flockNumber: "HT-092",
          flockName: "Current flock",
          placementDate: subDays(today, 10),
          projectedCatchDate: addDays(subDays(today, 10), 44),
          birdType: "Cobb 500",
        });
        await prisma.litterEvent.create({
          data: {
            farmId,
            eventDate: subDays(today, 12),
            eventType: LitterEventType.WINDROWING,
            contractor: "Grower",
            notes: "Between flocks",
          },
        });
        await prisma.farmIssue.create({
          data: {
            farmId,
            houseId: houseIds[2],
            dateReported: subDays(today, 20),
            category: IssueCategory.VENTILATION,
            priority: IssuePriority.MEDIUM,
            description: "Tunnel inlet actuator sticking on house 3",
            correctiveAction: "Lubed and monitored",
            status: IssueStatus.RESOLVED,
            resolvedDate: subDays(today, 15),
          },
        });
      },
    },
    {
      farmName: "Meadow Lane",
      growerName: "Greg Walsh",
      phoneNumber: "410-555-0119",
      houses: 5,
      note: `Catch Wed ${format(catchWed, "MMM d")} — partial follow-up completions`,
      setup: async (farmId, houseIds) => {
        const flock = await createFlock({
          userId: user.id,
          farmId,
          houseIds,
          flockNumber: "ML-611",
          placementDate: subDays(catchWed, 40),
          projectedCatchDate: catchWed,
          weightSampleLbs: 5.7,
        });
        await prisma.followUpCompletion.create({
          data: {
            farmId,
            flockId: flock.id,
            scheduledDate: subDays(today, 7),
            label: "21 Day",
            completedAt: subDays(today, 7),
            completedByUserId: user.id,
          },
        });
        await prisma.followUpCompletion.create({
          data: {
            farmId,
            flockId: flock.id,
            scheduledDate: subDays(today, 1),
            label: "28 Day",
            completedAt: subDays(today, 1),
            completedByUserId: user.id,
          },
        });
        await prisma.farmIssue.create({
          data: {
            farmId,
            houseId: houseIds[4],
            flockId: flock.id,
            dateReported: today,
            category: IssueCategory.COOLING_SYSTEM,
            priority: IssuePriority.LOW,
            description: "Pad pump noisy — schedule service after catch",
            status: IssueStatus.SCHEDULED,
          },
        });
      },
    },
    {
      farmName: "Coastal Growers",
      growerName: "Amy Brooks",
      phoneNumber: "410-555-0120",
      houses: 6,
      note: `Catch Fri ${format(catchFri, "MMM d")} — female flock, litter treatment`,
      setup: async (farmId, houseIds) => {
        await createFlock({
          userId: user.id,
          farmId,
          houseIds,
          flockNumber: "CG-330",
          placementDate: subDays(catchFri, 38),
          projectedCatchDate: catchFri,
          sex: FlockSex.FEMALE,
          birdType: "Ross 708",
          weightSampleLbs: 5.4,
          growthRateLbsPerDay: 0.13,
        });
        await prisma.litterEvent.create({
          data: {
            farmId,
            houseId: houseIds[0],
            eventDate: subDays(today, 6),
            eventType: LitterEventType.LITTER_TREATMENT,
            litterDepth: 3.5,
            contractor: "AgriTreat",
            cost: 890,
          },
        });
        await prisma.farmVisit.create({
          data: {
            farmId,
            visitDate: subDays(today, 3),
            birdAgeInDays: 35,
            visitType: VisitType.ROUTINE_SERVICE,
            litterCondition: "Good",
            waterConsumption: "Normal",
            temperature: 74,
            humidity: 62,
            notes: "House 1–3 walked",
          },
        });
      },
    },
    {
      farmName: "Idle Acres",
      growerName: "Bob Kessler",
      phoneNumber: "410-555-0121",
      houses: 2,
      isActive: false,
      note: "Inactive farm (empty) — test inactive list / reactivate",
      setup: async (farmId, houseIds) => {
        await createFlock({
          userId: user.id,
          farmId,
          houseIds,
          flockNumber: "IA-001",
          flockName: "Last flock",
          placementDate: subDays(today, 90),
          projectedCatchDate: subDays(today, 48),
          actualCatchDate: subDays(today, 48),
          status: FlockStatus.COMPLETED,
          settlement: {
            marketAgeInDays: 42,
            weightLbs: 5.95,
            feedConversion: 1.78,
            adjustedFeedConversion: 1.74,
            goodPoundsSold: 240000,
            settlementNo: 5,
          },
        });
      },
    },
  ];

  for (let i = 0; i < demos.length; i++) {
    const demo = demos[i]!;
    const farm = await prisma.farm.create({
      data: {
        userId: user.id,
        farmName: demo.farmName,
        growerName: demo.growerName,
        phoneNumber: demo.phoneNumber,
        email: demo.email ?? null,
        numberOfHouses: demo.houses,
        notes: demo.note,
        isActive: demo.isActive ?? true,
      },
    });
    const houses = await createHouses(farm.id, demo.houses, 2012 + i);
    await demo.setup(
      farm.id,
      houses.map((h) => h.id),
    );
  }

  const farmCount = demos.length;
  const activeCount = demos.filter((d) => d.isActive !== false).length;
  console.log(
    `Seed complete — ${farmCount} farms (${activeCount} active, ${farmCount - activeCount} inactive).`,
  );
  console.log("Login: tech@poultry.local / password123");
  for (const d of demos) {
    console.log(`- ${d.farmName}: ${d.note}`);
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
