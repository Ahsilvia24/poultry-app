export type MortalityStatus = "Normal" | "Watch" | "High" | "Critical";

export type DailyMortalityInput = {
  dailyMortalityCount: number;
  cullCount: number;
};

export type MortalityRecordLike = {
  mortalityDate: Date | string;
  birdAgeInDays: number;
  dailyMortalityCount: number;
  cullCount: number;
  totalDailyLoss: number;
  mortalityCause?: string;
};

export type MortalitySummary = {
  date: string;
  birdAgeInDays: number;
  dailyMortalityCount: number;
  cullCount: number;
  totalDailyLoss: number;
  dailyMortalityPercentage: number;
  rolling7DayMortalityCount: number;
  rolling7DayMortalityPercentage: number;
  cumulativeMortalityCount: number;
  cumulativeMortalityPercentage: number;
  remainingBirdCount: number;
};

export type ThresholdSettings = {
  dailyMortalityWarningPct: number;
  dailyMortalityCriticalPct: number;
  sevenDayMortalityWarningPct: number;
  sevenDayMortalityCriticalPct: number;
  alertRisingThreeDays: boolean;
};

export type FarmCardSummary = {
  id: string;
  farmName: string;
  growerName: string;
  flockAgeDays: number | null;
  totalBirdsPlaced: number;
  todayMortality: number;
  sevenDayMortality: number;
  cumulativeMortality: number;
  cumulativeMortalityPct: number;
  openIssues: number;
  lastVisitDate: string | null;
  status: MortalityStatus;
  missingTodayMortality: boolean;
};
