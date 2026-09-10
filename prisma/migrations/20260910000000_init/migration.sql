-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('TECHNICIAN', 'ADMIN', 'GROWER', 'VETERINARIAN');

-- CreateEnum
CREATE TYPE "FlockSex" AS ENUM ('MALE', 'FEMALE', 'STRAIGHT_RUN', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "FlockStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MortalityCause" AS ENUM ('UNKNOWN', 'EARLY_MORTALITY', 'LEG_ISSUES', 'FLIP_OVER', 'HEART_RELATED', 'RESPIRATORY', 'ENTERITIS', 'COCCIDIOSIS', 'HEAT_STRESS', 'COLD_STRESS', 'EQUIPMENT_ISSUE', 'SMOTHERING', 'PREDATOR', 'CULL', 'YOLK_INFECTION', 'BACTERIA', 'ESCHERICHIA_COLI', 'OTHER');

-- CreateEnum
CREATE TYPE "LitterEventType" AS ENUM ('FULL_LITTER_CLEANOUT', 'PARTIAL_LITTER_CLEANOUT', 'DE_CAKING', 'WINDROWING', 'TILL', 'LITTER_TREATMENT', 'TOP_DRESSING', 'COMPOST_REMOVAL', 'OTHER');

-- CreateEnum
CREATE TYPE "VisitType" AS ENUM ('ROUTINE_SERVICE', 'DELIVERY', 'PREBROOD', 'PLACEMENT', 'SEVEN_DAY', 'WEIGH_DAY', 'VACCINATION', 'MEDICATION', 'EQUIPMENT_ISSUE', 'MORTALITY_INVESTIGATION', 'PRE_CATCH', 'LAST_FEED_ORDER', 'CERTIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('FEED', 'WATER', 'VENTILATION', 'COOLING_SYSTEM', 'HEATING_SYSTEM', 'CONTROLLER', 'ELECTRICAL', 'STRUCTURE', 'BIOSECURITY', 'BIRD_HEALTH', 'LITTER', 'OTHER');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'MONITORING', 'SCHEDULED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "MeasurementUnit" AS ENUM ('IMPERIAL', 'METRIC');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'TECHNICIAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dailyMortalityWarningPct" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "dailyMortalityCriticalPct" DOUBLE PRECISION NOT NULL DEFAULT 0.3,
    "sevenDayMortalityWarningPct" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "sevenDayMortalityCriticalPct" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "alertRisingThreeDays" BOOLEAN NOT NULL DEFAULT true,
    "missingMortalityAlertTime" TEXT NOT NULL DEFAULT '14:00',
    "preferredUnits" "MeasurementUnit" NOT NULL DEFAULT 'IMPERIAL',
    "defaultMarketAgeDays" INTEGER NOT NULL DEFAULT 52,
    "notifyEmail" BOOLEAN NOT NULL DEFAULT false,
    "notifyInApp" BOOLEAN NOT NULL DEFAULT true,
    "farmOrder" TEXT NOT NULL DEFAULT 'age_desc',
    "ageBandThresholdsJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "farmName" TEXT NOT NULL,
    "growerName" TEXT NOT NULL,
    "farmNumber" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "phoneNumber" TEXT,
    "email" TEXT,
    "numberOfHouses" INTEGER NOT NULL DEFAULT 0,
    "numberOfGenerators" INTEGER,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "House" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "houseNumber" INTEGER NOT NULL,
    "squareFootage" DOUBLE PRECISION NOT NULL,
    "houseLength" DOUBLE PRECISION,
    "houseWidth" DOUBLE PRECISION,
    "totalFanCFM" DOUBLE PRECISION,
    "totalPowerCFM" DOUBLE PRECISION,
    "numberOfFans" INTEGER,
    "coolingPadSquareFootage" DOUBLE PRECISION,
    "feederType" TEXT,
    "drinkerType" TEXT,
    "controllerType" TEXT,
    "yearBuilt" INTEGER,
    "minVentilationCFM" DOUBLE PRECISION,
    "fanCycleOnSeconds" INTEGER,
    "fanCycleOffSeconds" INTEGER,
    "notes" TEXT,
    "loggedTemp" TEXT,
    "loggedTempAt" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "House_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flock" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "flockNumber" TEXT NOT NULL,
    "flockName" TEXT,
    "placementDate" TIMESTAMP(3) NOT NULL,
    "projectedCatchDate" TIMESTAMP(3),
    "actualCatchDate" TIMESTAMP(3),
    "processingPlant" TEXT,
    "birdType" TEXT,
    "sex" "FlockSex" NOT NULL DEFAULT 'STRAIGHT_RUN',
    "initialBirdCount" INTEGER NOT NULL,
    "flockStatus" "FlockStatus" NOT NULL DEFAULT 'ACTIVE',
    "targetMarketAge" INTEGER,
    "targetMarketWeight" DOUBLE PRECISION,
    "weightSampleLbs" DOUBLE PRECISION,
    "weightSampleDate" DATE,
    "growthRateLbsPerDay" DOUBLE PRECISION,
    "settlementMarketAgeInDays" INTEGER,
    "settlementWeightLbs" DOUBLE PRECISION,
    "settlementFeedConversion" DOUBLE PRECISION,
    "settlementAdjustedFeedConversion" DOUBLE PRECISION,
    "settlementGoodPoundsSold" DOUBLE PRECISION,
    "settlementNo" INTEGER,
    "litterConditionAtPlacement" TEXT,
    "notes" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HouseFlock" (
    "id" TEXT NOT NULL,
    "flockId" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "placedBirdCount" INTEGER NOT NULL,
    "placementDate" DATE,
    "catchDate" DATE,
    "catchTime" TEXT,
    "processingPlant" TEXT,
    "finalBirdCount" INTEGER,
    "finalAverageWeight" DOUBLE PRECISION,
    "totalFeedDelivered" DOUBLE PRECISION,
    "feedConversion" DOUBLE PRECISION,
    "totalMortality" INTEGER,
    "mortalityPercentage" DOUBLE PRECISION,
    "condemnationPercentage" DOUBLE PRECISION,
    "livabilityPercentage" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HouseFlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyMortality" (
    "id" TEXT NOT NULL,
    "houseFlockId" TEXT NOT NULL,
    "mortalityDate" DATE NOT NULL,
    "birdAgeInDays" INTEGER NOT NULL,
    "dailyMortalityCount" INTEGER NOT NULL DEFAULT 0,
    "cullCount" INTEGER NOT NULL DEFAULT 0,
    "totalDailyLoss" INTEGER NOT NULL DEFAULT 0,
    "mortalityCause" "MortalityCause" NOT NULL DEFAULT 'UNKNOWN',
    "comments" TEXT,
    "enteredByUserId" TEXT,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyMortality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedDelivery" (
    "id" TEXT NOT NULL,
    "flockId" TEXT,
    "houseFlockId" TEXT,
    "deliveryDate" DATE NOT NULL,
    "feedType" TEXT,
    "feedMill" TEXT,
    "ticketNumber" TEXT,
    "poundsDelivered" DOUBLE PRECISION NOT NULL,
    "tonsDelivered" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LastFeedOrder" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "flockId" TEXT NOT NULL,
    "orderDate" DATE NOT NULL,
    "orderTime" TEXT,
    "consumptionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.45,
    "calculatedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LastFeedOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LastFeedOrderHouseInventory" (
    "id" TEXT NOT NULL,
    "lastFeedOrderId" TEXT NOT NULL,
    "houseId" TEXT NOT NULL,
    "binAPounds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "binBPounds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "headCount" INTEGER,
    "feedUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LastFeedOrderHouseInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlockPerformance" (
    "id" TEXT NOT NULL,
    "houseFlockId" TEXT NOT NULL,
    "marketAgeInDays" INTEGER,
    "averageLiveWeight" DOUBLE PRECISION,
    "totalLiveWeight" DOUBLE PRECISION,
    "feedConversion" DOUBLE PRECISION,
    "adjustedFeedConversion" DOUBLE PRECISION,
    "livabilityPercentage" DOUBLE PRECISION,
    "mortalityPercentage" DOUBLE PRECISION,
    "condemnationPercentage" DOUBLE PRECISION,
    "settlementDate" TIMESTAMP(3),
    "settlementNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlockPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LitterEvent" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "houseId" TEXT,
    "eventDate" DATE NOT NULL,
    "eventType" "LitterEventType" NOT NULL,
    "litterDepth" DOUBLE PRECISION,
    "contractor" TEXT,
    "cost" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LitterEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmVisit" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "flockId" TEXT,
    "visitDate" DATE NOT NULL,
    "birdAgeInDays" INTEGER,
    "visitType" "VisitType" NOT NULL DEFAULT 'ROUTINE_SERVICE',
    "generalBirdCondition" TEXT,
    "activityLevel" TEXT,
    "uniformity" TEXT,
    "litterCondition" TEXT,
    "waterConsumption" TEXT,
    "feedInventory" TEXT,
    "temperature" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "staticPressure" DOUBLE PRECISION,
    "notes" TEXT,
    "followUpRequired" BOOLEAN NOT NULL DEFAULT false,
    "followUpDate" TIMESTAMP(3),
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpCompletion" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "flockId" TEXT,
    "scheduledDate" DATE NOT NULL,
    "label" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmIssue" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "houseId" TEXT,
    "flockId" TEXT,
    "dateReported" DATE NOT NULL,
    "category" "IssueCategory" NOT NULL,
    "priority" "IssuePriority" NOT NULL DEFAULT 'MEDIUM',
    "description" TEXT NOT NULL,
    "correctiveAction" TEXT,
    "assignedTo" TEXT,
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratorLog" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "logDate" DATE NOT NULL,
    "gen1Hours" DOUBLE PRECISION,
    "gen2Hours" DOUBLE PRECISION,
    "gen3Hours" DOUBLE PRECISION,
    "gen4Hours" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratorLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");

-- CreateIndex
CREATE INDEX "Farm_userId_idx" ON "Farm"("userId");

-- CreateIndex
CREATE INDEX "Farm_farmName_idx" ON "Farm"("farmName");

-- CreateIndex
CREATE INDEX "Farm_growerName_idx" ON "Farm"("growerName");

-- CreateIndex
CREATE INDEX "House_farmId_idx" ON "House"("farmId");

-- CreateIndex
CREATE UNIQUE INDEX "House_farmId_houseNumber_key" ON "House"("farmId", "houseNumber");

-- CreateIndex
CREATE INDEX "Flock_farmId_idx" ON "Flock"("farmId");

-- CreateIndex
CREATE INDEX "Flock_flockStatus_idx" ON "Flock"("flockStatus");

-- CreateIndex
CREATE INDEX "Flock_flockNumber_idx" ON "Flock"("flockNumber");

-- CreateIndex
CREATE INDEX "HouseFlock_flockId_idx" ON "HouseFlock"("flockId");

-- CreateIndex
CREATE INDEX "HouseFlock_houseId_idx" ON "HouseFlock"("houseId");

-- CreateIndex
CREATE UNIQUE INDEX "HouseFlock_flockId_houseId_key" ON "HouseFlock"("flockId", "houseId");

-- CreateIndex
CREATE INDEX "DailyMortality_mortalityDate_idx" ON "DailyMortality"("mortalityDate");

-- CreateIndex
CREATE INDEX "DailyMortality_houseFlockId_idx" ON "DailyMortality"("houseFlockId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyMortality_houseFlockId_mortalityDate_key" ON "DailyMortality"("houseFlockId", "mortalityDate");

-- CreateIndex
CREATE INDEX "FeedDelivery_flockId_idx" ON "FeedDelivery"("flockId");

-- CreateIndex
CREATE INDEX "FeedDelivery_houseFlockId_idx" ON "FeedDelivery"("houseFlockId");

-- CreateIndex
CREATE INDEX "FeedDelivery_deliveryDate_idx" ON "FeedDelivery"("deliveryDate");

-- CreateIndex
CREATE INDEX "LastFeedOrder_farmId_idx" ON "LastFeedOrder"("farmId");

-- CreateIndex
CREATE INDEX "LastFeedOrder_flockId_idx" ON "LastFeedOrder"("flockId");

-- CreateIndex
CREATE INDEX "LastFeedOrder_orderDate_idx" ON "LastFeedOrder"("orderDate");

-- CreateIndex
CREATE INDEX "LastFeedOrderHouseInventory_lastFeedOrderId_idx" ON "LastFeedOrderHouseInventory"("lastFeedOrderId");

-- CreateIndex
CREATE INDEX "LastFeedOrderHouseInventory_houseId_idx" ON "LastFeedOrderHouseInventory"("houseId");

-- CreateIndex
CREATE UNIQUE INDEX "LastFeedOrderHouseInventory_lastFeedOrderId_houseId_key" ON "LastFeedOrderHouseInventory"("lastFeedOrderId", "houseId");

-- CreateIndex
CREATE UNIQUE INDEX "FlockPerformance_houseFlockId_key" ON "FlockPerformance"("houseFlockId");

-- CreateIndex
CREATE INDEX "LitterEvent_farmId_idx" ON "LitterEvent"("farmId");

-- CreateIndex
CREATE INDEX "LitterEvent_eventDate_idx" ON "LitterEvent"("eventDate");

-- CreateIndex
CREATE INDEX "FarmVisit_farmId_idx" ON "FarmVisit"("farmId");

-- CreateIndex
CREATE INDEX "FarmVisit_visitDate_idx" ON "FarmVisit"("visitDate");

-- CreateIndex
CREATE INDEX "FollowUpCompletion_farmId_idx" ON "FollowUpCompletion"("farmId");

-- CreateIndex
CREATE INDEX "FollowUpCompletion_flockId_idx" ON "FollowUpCompletion"("flockId");

-- CreateIndex
CREATE INDEX "FollowUpCompletion_scheduledDate_idx" ON "FollowUpCompletion"("scheduledDate");

-- CreateIndex
CREATE UNIQUE INDEX "FollowUpCompletion_farmId_scheduledDate_label_key" ON "FollowUpCompletion"("farmId", "scheduledDate", "label");

-- CreateIndex
CREATE INDEX "FarmIssue_farmId_idx" ON "FarmIssue"("farmId");

-- CreateIndex
CREATE INDEX "FarmIssue_status_idx" ON "FarmIssue"("status");

-- CreateIndex
CREATE INDEX "FarmIssue_priority_idx" ON "FarmIssue"("priority");

-- CreateIndex
CREATE INDEX "GeneratorLog_farmId_idx" ON "GeneratorLog"("farmId");

-- CreateIndex
CREATE INDEX "GeneratorLog_logDate_idx" ON "GeneratorLog"("logDate");

-- AddForeignKey
ALTER TABLE "UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Farm" ADD CONSTRAINT "Farm_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "House" ADD CONSTRAINT "House_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flock" ADD CONSTRAINT "Flock_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseFlock" ADD CONSTRAINT "HouseFlock_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "Flock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HouseFlock" ADD CONSTRAINT "HouseFlock_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMortality" ADD CONSTRAINT "DailyMortality_houseFlockId_fkey" FOREIGN KEY ("houseFlockId") REFERENCES "HouseFlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyMortality" ADD CONSTRAINT "DailyMortality_enteredByUserId_fkey" FOREIGN KEY ("enteredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedDelivery" ADD CONSTRAINT "FeedDelivery_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "Flock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedDelivery" ADD CONSTRAINT "FeedDelivery_houseFlockId_fkey" FOREIGN KEY ("houseFlockId") REFERENCES "HouseFlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LastFeedOrder" ADD CONSTRAINT "LastFeedOrder_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LastFeedOrder" ADD CONSTRAINT "LastFeedOrder_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "Flock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LastFeedOrderHouseInventory" ADD CONSTRAINT "LastFeedOrderHouseInventory_lastFeedOrderId_fkey" FOREIGN KEY ("lastFeedOrderId") REFERENCES "LastFeedOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LastFeedOrderHouseInventory" ADD CONSTRAINT "LastFeedOrderHouseInventory_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlockPerformance" ADD CONSTRAINT "FlockPerformance_houseFlockId_fkey" FOREIGN KEY ("houseFlockId") REFERENCES "HouseFlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LitterEvent" ADD CONSTRAINT "LitterEvent_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LitterEvent" ADD CONSTRAINT "LitterEvent_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmVisit" ADD CONSTRAINT "FarmVisit_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmVisit" ADD CONSTRAINT "FarmVisit_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "Flock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpCompletion" ADD CONSTRAINT "FollowUpCompletion_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpCompletion" ADD CONSTRAINT "FollowUpCompletion_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "Flock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmIssue" ADD CONSTRAINT "FarmIssue_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmIssue" ADD CONSTRAINT "FarmIssue_houseId_fkey" FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmIssue" ADD CONSTRAINT "FarmIssue_flockId_fkey" FOREIGN KEY ("flockId") REFERENCES "Flock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratorLog" ADD CONSTRAINT "GeneratorLog_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

