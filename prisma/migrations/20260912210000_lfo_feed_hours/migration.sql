-- AlterTable
ALTER TABLE "UserSettings" ADD COLUMN "lfoFeedUpHoursBeforeCatch" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "UserSettings" ADD COLUMN "lfoFeedOffHoursBeforeCatch" INTEGER NOT NULL DEFAULT 10;
