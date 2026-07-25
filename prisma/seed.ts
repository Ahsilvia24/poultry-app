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
import { addDays, subDays } from "date-fns";

const prisma = new PrismaClient();

function lossForDay(day: number, houseIndex: number): { mort: number; cull: number; cause: MortalityCause } {
  const base = houseIndex % 3 === 0 ? 3 : houseIndex % 3 === 1 ? 2 : 1;
  const mort = Math.max(0, base + (day < 7 ? 2 : 0) + (day % 5 === 0 ? 2 : 0));
  const cull = day % 4 === 0 ? 1 : 0;
  const causes: MortalityCause[] = [
    "EARLY_MORTALITY",
    "LEG_ISSUES",
    "FLIP_OVER",
    "RESPIRATORY",
    "UNKNOWN",
    "HEAT_STRESS",
    "CULL",
  ];
  return { mort, cull, cause: causes[day % causes.length] };
}

async function seedHistoricalFlock(
  farmId: string,
  houseIds: string[],
  flockNumber: string,
  placementOffsetDays: number,
  durationDays: number,
) {
  const placementDate = subDays(new Date(), placementOffsetDays);
  const catchDate = addDays(placementDate, durationDays);
  const perHouse = 22000;
  const flock = await prisma.flock.create({
    data: {
      farmId,
      flockNumber,
      flockName: `Flock ${flockNumber}`,
      placementDate,
      projectedCatchDate: catchDate,
      actualCatchDate: catchDate,
      processingPlant: "Central Processing",
      birdType: "Ross 708",
      sex: FlockSex.STRAIGHT_RUN,
      initialBirdCount: perHouse * houseIds.length,
      flockStatus: FlockStatus.COMPLETED,
      targetMarketAge: 42,
      targetMarketWeight: 6.2,
      litterConditionAtPlacement: "Good",
      houseFlocks: {
        create: houseIds.map((houseId) => ({
          houseId,
          placedBirdCount: perHouse,
        })),
      },
    },
    include: { houseFlocks: true },
  });

  for (let hi = 0; hi < flock.houseFlocks.length; hi++) {
    const hf = flock.houseFlocks[hi];
    let cum = 0;
    for (let d = 0; d < durationDays; d += 3) {
      const { mort, cull, cause } = lossForDay(d, hi);
      const loss = mort + cull;
      cum += loss;
      await prisma.dailyMortality.create({
        data: {
          houseFlockId: hf.id,
          mortalityDate: addDays(placementDate, d),
          birdAgeInDays: d,
          dailyMortalityCount: mort,
          cullCount: cull,
          totalDailyLoss: loss,
          mortalityCause: cause,
        },
      });
    }
    const mortPct = (cum / perHouse) * 100;
    await prisma.houseFlock.update({
      where: { id: hf.id },
      data: {
        finalBirdCount: perHouse - cum,
        finalAverageWeight: 6.1 + (hi % 5) * 0.05,
        totalFeedDelivered: 185000,
        feedConversion: 1.62,
        totalMortality: cum,
        mortalityPercentage: mortPct,
        livabilityPercentage: 100 - mortPct,
        condemnationPercentage: 0.4,
      },
    });
    await prisma.flockPerformance.create({
      data: {
        houseFlockId: hf.id,
        marketAgeInDays: durationDays,
        averageLiveWeight: 6.15,
        totalLiveWeight: (perHouse - cum) * 6.15,
        feedConversion: 1.62,
        adjustedFeedConversion: 1.58,
        livabilityPercentage: 100 - mortPct,
        mortalityPercentage: mortPct,
        condemnationPercentage: 0.4,
        settlementDate: catchDate,
        settlementNotes: "Settlement entered from company sheet",
      },
    });
    await prisma.feedDelivery.create({
      data: {
        houseFlockId: hf.id,
        flockId: flock.id,
        deliveryDate: addDays(placementDate, 10),
        feedType: "Grower",
        feedMill: "Valley Feed",
        ticketNumber: `T-${flockNumber}-${hi + 1}`,
        poundsDelivered: 48000,
        tonsDelivered: 24,
      },
    });
  }

  return flock;
}

async function createActiveFlock(
  userId: string,
  farmId: string,
  houseIds: string[],
  flockNumber: string,
  placedDaysAgo: number,
) {
  const placementDate = subDays(new Date(), placedDaysAgo);
  const perHouse = 23000;
  const flock = await prisma.flock.create({
    data: {
      farmId,
      flockNumber,
      flockName: `Active ${flockNumber}`,
      placementDate,
      projectedCatchDate: addDays(placementDate, 42),
      processingPlant: "Central Processing",
      birdType: "Cobb 500",
      sex: FlockSex.STRAIGHT_RUN,
      initialBirdCount: perHouse * houseIds.length,
      flockStatus: FlockStatus.ACTIVE,
      targetMarketAge: 42,
      targetMarketWeight: 6.4,
      litterConditionAtPlacement: "Fresh cake removed",
      houseFlocks: {
        create: houseIds.map((houseId) => ({ houseId, placedBirdCount: perHouse })),
      },
    },
    include: { houseFlocks: true },
  });

  for (let hi = 0; hi < flock.houseFlocks.length; hi++) {
    const hf = flock.houseFlocks[hi];
    for (let d = 0; d <= placedDaysAgo; d++) {
      const dayLoss = lossForDay(d, hi);
      await prisma.dailyMortality.create({
        data: {
          houseFlockId: hf.id,
          mortalityDate: addDays(placementDate, d),
          birdAgeInDays: d,
          dailyMortalityCount: dayLoss.mort,
          cullCount: dayLoss.cull,
          totalDailyLoss: dayLoss.mort + dayLoss.cull,
          mortalityCause: dayLoss.cause,
          enteredByUserId: userId,
        },
      });
    }
    await prisma.feedDelivery.create({
      data: {
        flockId: flock.id,
        houseFlockId: hf.id,
        deliveryDate: addDays(placementDate, 5),
        feedType: "Starter",
        feedMill: "Valley Feed",
        ticketNumber: `ACTIVE-${flockNumber}-${hi + 1}`,
        poundsDelivered: 24000,
        tonsDelivered: 12,
      },
    });
  }

  await prisma.feedDelivery.create({
    data: {
      flockId: flock.id,
      deliveryDate: addDays(placementDate, 12),
      feedType: "Grower",
      feedMill: "Valley Feed",
      ticketNumber: `FARM-${flockNumber}`,
      poundsDelivered: 80000,
      tonsDelivered: 40,
      notes: "Farm-level delivery",
    },
  });

  return flock;
}

async function main() {
  await prisma.dailyMortality.deleteMany();
  await prisma.flockPerformance.deleteMany();
  await prisma.feedDelivery.deleteMany();
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

  const farm1 = await prisma.farm.create({
    data: {
      userId: user.id,
      farmName: "Cedar Creek Broilers",
      growerName: "John Miller",
      farmNumber: "CC-101",
      address: "1200 Farm Road",
      city: "Salisbury",
      state: "MD",
      zipCode: "21801",
      phoneNumber: "410-555-0101",
      numberOfHouses: 4,
      notes: "Four 50x500 houses. Good grower.",
    },
  });

  const farm2 = await prisma.farm.create({
    data: {
      userId: user.id,
      farmName: "Pine Ridge Poultry",
      growerName: "Maria Santos",
      farmNumber: "PR-220",
      address: "88 Ridge Lane",
      city: "Georgetown",
      state: "DE",
      zipCode: "19947",
      phoneNumber: "302-555-0199",
      numberOfHouses: 8,
      notes: "Eight-house complex. Newer controllers.",
    },
  });

  const farm1Houses = [];
  for (let i = 1; i <= 4; i++) {
    farm1Houses.push(
      await prisma.house.create({
        data: {
          farmId: farm1.id,
          houseNumber: i,
          squareFootage: 25000,
          houseLength: 500,
          houseWidth: 50,
          totalFanCFM: 180000,
          numberOfFans: 12,
          coolingPadSquareFootage: 1200,
          feederType: "Pan",
          drinkerType: "Nipple",
          controllerType: "Chore-Tronics",
          yearBuilt: 2012 + i,
          minVentilationCFM: 12000,
          fanCycleOnSeconds: 30,
          fanCycleOffSeconds: 90,
        },
      }),
    );
  }

  const farm2Houses = [];
  for (let i = 1; i <= 8; i++) {
    farm2Houses.push(
      await prisma.house.create({
        data: {
          farmId: farm2.id,
          houseNumber: i,
          squareFootage: 24000,
          houseLength: 480,
          houseWidth: 50,
          totalFanCFM: 170000,
          numberOfFans: 11,
          coolingPadSquareFootage: 1100,
          feederType: "Pan",
          drinkerType: "Nipple",
          controllerType: "Rotem",
          yearBuilt: 2018,
          minVentilationCFM: 11000,
        },
      }),
    );
  }

  const f1Ids = farm1Houses.map((h) => h.id);
  const f2Ids = farm2Houses.map((h) => h.id);

  await seedHistoricalFlock(farm1.id, f1Ids, "F-100", 200, 42);
  await seedHistoricalFlock(farm1.id, f1Ids, "F-101", 140, 41);
  await seedHistoricalFlock(farm1.id, f1Ids, "F-102", 80, 43);
  await seedHistoricalFlock(farm2.id, f2Ids, "F-200", 210, 42);
  await seedHistoricalFlock(farm2.id, f2Ids, "F-201", 150, 40);
  await seedHistoricalFlock(farm2.id, f2Ids, "F-202", 90, 42);

  // 14+ days of mortality on active flocks
  await createActiveFlock(user.id, farm1.id, f1Ids, "F-103", 16);
  await createActiveFlock(user.id, farm2.id, f2Ids, "F-203", 14);

  await prisma.litterEvent.createMany({
    data: [
      {
        farmId: farm1.id,
        eventDate: subDays(new Date(), 85),
        eventType: LitterEventType.FULL_LITTER_CLEANOUT,
        litterDepth: 0,
        contractor: "Coastal Litter Co",
        cost: 4800,
        notes: "Full cleanout before F-102",
      },
      {
        farmId: farm1.id,
        houseId: farm1Houses[0].id,
        eventDate: subDays(new Date(), 20),
        eventType: LitterEventType.DE_CAKING,
        litterDepth: 3,
        contractor: "Grower",
        cost: 0,
      },
      {
        farmId: farm2.id,
        eventDate: subDays(new Date(), 95),
        eventType: LitterEventType.FULL_LITTER_CLEANOUT,
        contractor: "Delmarva Litter",
        cost: 9200,
      },
      {
        farmId: farm2.id,
        eventDate: subDays(new Date(), 30),
        eventType: LitterEventType.WINDROWING,
        notes: "Windrowed after rain event",
      },
    ],
  });

  await prisma.farmVisit.createMany({
    data: [
      {
        farmId: farm1.id,
        visitDate: subDays(new Date(), 2),
        birdAgeInDays: 14,
        visitType: VisitType.ROUTINE_SERVICE,
        generalBirdCondition: "Good",
        activityLevel: "Active",
        litterCondition: "Acceptable",
        temperature: 78,
        humidity: 55,
        notes: "Checked drinkers in houses 2 and 3",
        followUpRequired: true,
        followUpDate: addDays(new Date(), 3),
      },
      {
        farmId: farm2.id,
        visitDate: subDays(new Date(), 1),
        birdAgeInDays: 13,
        visitType: VisitType.SEVEN_DAY,
        generalBirdCondition: "Fair",
        activityLevel: "Moderate",
        notes: "Slight early mortality spike house 5",
        followUpRequired: true,
        followUpDate: addDays(new Date(), 1),
      },
    ],
  });

  await prisma.farmIssue.createMany({
    data: [
      {
        farmId: farm1.id,
        houseId: farm1Houses[1].id,
        dateReported: subDays(new Date(), 5),
        category: IssueCategory.WATER,
        priority: IssuePriority.HIGH,
        description: "Low pressure on drinker line B",
        correctiveAction: "Flush and check regulator",
        assignedTo: "Grower",
        status: IssueStatus.OPEN,
      },
      {
        farmId: farm1.id,
        dateReported: subDays(new Date(), 40),
        category: IssueCategory.VENTILATION,
        priority: IssuePriority.MEDIUM,
        description: "Tunnel fan belt worn",
        status: IssueStatus.RESOLVED,
        resolvedDate: subDays(new Date(), 35),
        correctiveAction: "Belt replaced",
      },
      {
        farmId: farm2.id,
        houseId: farm2Houses[4].id,
        dateReported: subDays(new Date(), 1),
        category: IssueCategory.BIRD_HEALTH,
        priority: IssuePriority.CRITICAL,
        description: "Elevated mortality overnight — investigate",
        assignedTo: "Alex Technician",
        status: IssueStatus.MONITORING,
      },
      {
        farmId: farm2.id,
        dateReported: subDays(new Date(), 10),
        category: IssueCategory.CONTROLLER,
        priority: IssuePriority.LOW,
        description: "Alarm history full — needs clear",
        status: IssueStatus.SCHEDULED,
      },
    ],
  });

  console.log("Seed complete.");
  console.log("Login: tech@poultry.local / password123");
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
