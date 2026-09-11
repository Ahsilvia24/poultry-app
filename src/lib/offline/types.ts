import type { getDashboardData } from "@/lib/dashboard";

export const OFFLINE_SNAPSHOT_VERSION = 2 as const;

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
  numberOfGenerators: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
};

export type OfflineHouse = {
  id: string;
  farmId: string;
  houseNumber: number;
  squareFootage: number;
  totalFanCFM: number | null;
  totalPowerCFM: number | null;
  numberOfFans: number | null;
  notes: string | null;
  loggedTemp: string | null;
  loggedTempAt: string | null;
  deletedAt: string | null;
};

export type OfflineFlockRef = {
  id: string;
  farmId: string;
  flockNumber: string;
  flockStatus: string;
  placementDate: string;
  projectedCatchDate: string | null;
  actualCatchDate: string | null;
  targetMarketAge: number | null;
  growthRateLbsPerDay: number | null;
  deletedAt: string | null;
};

export type OfflineHouseFlock = {
  id: string;
  flockId: string;
  houseId: string;
  placedBirdCount: number;
  placementDate: string | null;
  catchDate: string | null;
  catchTime: string | null;
};

export type OfflineMortality = {
  id: string;
  houseFlockId: string;
  mortalityDate: string;
  birdAgeInDays: number;
  dailyMortalityCount: number;
  cullCount: number;
  totalDailyLoss: number;
  isDraft: boolean;
};

export type OfflineVisit = {
  id: string;
  farmId: string;
  flockId: string | null;
  visitDate: string;
  visitType: string;
  birdAgeInDays: number | null;
  generalBirdCondition: string | null;
  followUpRequired: boolean;
  followUpDate: string | null;
  notes: string | null;
  loggedAt: string | null;
};

export type OfflineIssue = {
  id: string;
  farmId: string;
  houseId: string | null;
  flockId: string | null;
  dateReported: string;
  category: string;
  priority: string;
  description: string;
  correctiveAction: string | null;
  assignedTo: string | null;
  status: string;
};

export type OfflineLitter = {
  id: string;
  farmId: string;
  houseId: string | null;
  eventDate: string;
  eventType: string;
  litterDepth: number | null;
  contractor: string | null;
  notes: string | null;
};

export type OfflineFeed = {
  id: string;
  flockId: string | null;
  houseFlockId: string | null;
  deliveryDate: string;
  feedType: string | null;
  feedMill: string | null;
  ticketNumber: string | null;
  poundsDelivered: number;
  notes: string | null;
};

export type OfflineLfo = {
  id: string;
  farmId: string;
  flockId: string;
  orderDate: string;
  orderTime: string | null;
  consumptionRate: number;
  calculatedAt: string | null;
  notes: string | null;
  createdAt: string;
};

export type OfflineLfoInv = {
  id: string;
  lastFeedOrderId: string;
  houseId: string;
  binAPounds: number;
  binBPounds: number;
  headCount: number | null;
  feedUpAt: string | null;
};

export type OfflineGenLog = {
  id: string;
  farmId: string;
  logDate: string;
  gen1Hours: number | null;
  gen2Hours: number | null;
  gen3Hours: number | null;
  gen4Hours: number | null;
};

export type OfflineSettings = {
  farmOrder: string;
  appTimeZone: string;
  dailyMortalityWarningPct: number;
  dailyMortalityCriticalPct: number;
  sevenDayMortalityWarningPct: number;
  sevenDayMortalityCriticalPct: number;
  alertRisingThreeDays: boolean;
  defaultMarketAgeDays: number;
  notifyEmail: boolean;
  notifyInApp: boolean;
};

export type OfflineFormWriteAction =
  | "updateFarm"
  | "deactivateFarm"
  | "reactivateFarm"
  | "deleteFarm"
  | "createHouse"
  | "updateHouse"
  | "deleteHouse"
  | "createVisit"
  | "updateVisit"
  | "deleteVisit"
  | "createIssue"
  | "updateIssue"
  | "deleteIssue"
  | "createLitter"
  | "updateLitter"
  | "deleteLitter"
  | "createFeed"
  | "updateFeed"
  | "deleteFeed"
  | "createGeneratorLog"
  | "updateGeneratorLog"
  | "deleteGeneratorLog"
  | "saveFarmLfo"
  | "createManualLfo"
  | "deleteLfo"
  | "saveMortalitySeries"
  | "toggleFollowUp";

export type OfflineFormWrite = {
  action: OfflineFormWriteAction;
  id?: string;
  farmId?: string;
  fields?: Record<string, string>;
  listFields?: Record<string, string[]>;
  extra?: unknown;
};

export type OfflineOutboxItem = {
  id: string;
  createdAt: string;
  kind:
    | "applyPlacement"
    | "applyCatch"
    | "updateHouseTemp"
    | "updateSettings"
    | "formWrite";
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
  houses: OfflineHouse[];
  flocks: OfflineFlockRef[];
  houseFlocks: OfflineHouseFlock[];
  mortalities: OfflineMortality[];
  visits: OfflineVisit[];
  issues: OfflineIssue[];
  litterEvents: OfflineLitter[];
  feedDeliveries: OfflineFeed[];
  lfos: OfflineLfo[];
  lfoInventories: OfflineLfoInv[];
  generatorLogs: OfflineGenLog[];
  dashboard: Awaited<ReturnType<typeof getDashboardData>> | null;
};

export type OfflineSnapshotResponse =
  | { ok: true; snapshot: OfflineSnapshot }
  | { ok: false; error: string };
