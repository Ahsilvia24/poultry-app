import type { getDashboardData } from "@/lib/dashboard";

export const OFFLINE_SNAPSHOT_VERSION = 1 as const;

export type OfflineFarmRef = {
  id: string;
  farmName: string;
  growerName: string;
  farmNumber: string | null;
  phoneNumber: string | null;
  isActive: boolean;
  deletedAt: string | null;
  notes: string | null;
  numberOfHouses: number;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
};

export type OfflineFlockRef = {
  id: string;
  farmId: string;
  flockNumber: string;
  flockStatus: string;
  placementDate: string;
  deletedAt: string | null;
};

export type OfflineSettings = {
  farmOrder: string;
  appTimeZone: string;
  dailyMortalityWarningPct: number;
  dailyMortalityCriticalPct: number;
  sevenDayMortalityWarningPct: number;
  sevenDayMortalityCriticalPct: number;
  alertRisingThreeDays: boolean;
};

export type OfflineOutboxItem = {
  id: string;
  createdAt: string;
  kind: "applyPlacement" | "applyCatch";
  payload: unknown;
};

export type OfflineSnapshot = {
  version: typeof OFFLINE_SNAPSHOT_VERSION;
  userId: string;
  userName: string;
  userEmail: string;
  pulledAt: string;
  settings: OfflineSettings | null;
  farms: OfflineFarmRef[];
  flocks: OfflineFlockRef[];
  dashboard: Awaited<ReturnType<typeof getDashboardData>> | null;
};

export type OfflineSnapshotResponse =
  | { ok: true; snapshot: OfflineSnapshot }
  | { ok: false; error: string };
