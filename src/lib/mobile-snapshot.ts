import {
  FlockSex,
  FlockStatus,
  IssueCategory,
  IssuePriority,
  IssueStatus,
  LitterEventType,
  MortalityCause,
  Prisma,
  VisitType,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MOBILE_SNAPSHOT_FORMAT = "poultrytech-mobile-snapshot";
export const MOBILE_SNAPSHOT_VERSION = 1;
export const MANUAL_LFO_FARM_ID = "farm__manual__";

export const SNAPSHOT_TABLES = [
  "farms",
  "houses",
  "flocks",
  "house_flocks",
  "daily_mortality",
  "farm_visits",
  "last_feed_orders",
  "lfo_house_inventory",
  "follow_up_completions",
  "farm_issues",
  "litter_events",
  "generator_logs",
  "service_forms",
  "feed_deliveries",
] as const;

export type SnapshotTable = (typeof SNAPSHOT_TABLES)[number];
export type SnapshotRow = Record<string, unknown>;
export type SnapshotTables = Record<SnapshotTable, SnapshotRow[]>;

export type MobileSnapshot = {
  format: typeof MOBILE_SNAPSHOT_FORMAT;
  version: typeof MOBILE_SNAPSHOT_VERSION;
  tables: SnapshotTables;
};

export type ApplySnapshotResult = {
  farms: number;
  houses: number;
  flocks: number;
  houseFlocks: number;
  mortality: number;
  visits: number;
  lastFeedOrders: number;
  followUps: number;
  issues: number;
  litterEvents: number;
  generatorLogs: number;
  serviceForms: number;
  feedDeliveries: number;
  skipped: string[];
};

function emptyTables(): SnapshotTables {
  return Object.fromEntries(SNAPSHOT_TABLES.map((name) => [name, []])) as unknown as SnapshotTables;
}

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function int(v: unknown, fallback = 0): number {
  const n = num(v);
  if (n == null) return fallback;
  return Math.trunc(n);
}

function bool(v: unknown, fallback = false): boolean {
  if (v == null || v === "") return fallback;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
  return fallback;
}

function day(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }
  return v.toISOString().slice(0, 10);
}

function iso(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.toISOString();
}

function dateOnly(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T12:00:00.000Z`);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateTime(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function enumOr<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  const s = str(v);
  if (s && (allowed as readonly string[]).includes(s)) return s as T;
  return fallback;
}

function idsOf(rows: SnapshotRow[] | undefined): string[] {
  return (rows ?? []).map((row) => str(row.id)).filter((id): id is string => Boolean(id));
}

function exceptIds(ids: string[]): { id?: { notIn: string[] } } {
  return ids.length ? { id: { notIn: ids } } : {};
}

function isManualFarm(id: string | null): boolean {
  return id === MANUAL_LFO_FARM_ID;
}

export async function serializeUserSnapshot(userId: string): Promise<MobileSnapshot> {
  const farmWhere = { userId };
  const [farms, houses, flocks, houseFlocks, lastFeedOrders, inventories] = await Promise.all([
    prisma.farm.findMany({ where: farmWhere }),
    prisma.house.findMany({ where: { farm: farmWhere } }),
    prisma.flock.findMany({ where: { farm: farmWhere } }),
    prisma.houseFlock.findMany({ where: { flock: { farm: farmWhere } } }),
    prisma.lastFeedOrder.findMany({ where: { farm: farmWhere } }),
    prisma.lastFeedOrderHouseInventory.findMany({
      where: { lastFeedOrder: { farm: farmWhere } },
    }),
  ]);

  const farmIds = new Set(farms.map((f) => f.id));
  const [
    mortality,
    visits,
    followUps,
    issues,
    litterEvents,
    generatorLogs,
    serviceForms,
    feedDeliveries,
  ] = await Promise.all([
    prisma.dailyMortality.findMany({
      where: { houseFlock: { flock: { farm: farmWhere } } },
    }),
    prisma.farmVisit.findMany({ where: { farm: farmWhere } }),
    prisma.followUpCompletion.findMany({ where: { farm: farmWhere } }),
    prisma.farmIssue.findMany({ where: { farm: farmWhere } }),
    prisma.litterEvent.findMany({ where: { farm: farmWhere } }),
    prisma.generatorLog.findMany({ where: { farm: farmWhere } }),
    prisma.serviceForm.findMany({ where: { farm: farmWhere } }),
    prisma.feedDelivery.findMany({
      where: {
        OR: [{ flock: { farm: farmWhere } }, { houseFlock: { flock: { farm: farmWhere } } }],
      },
    }),
  ]);

  const consumptionByOrder = new Map(lastFeedOrders.map((o) => [o.id, o.consumptionRate]));

  const tables = emptyTables();
  tables.farms = farms
    .filter((f) => !isManualFarm(f.id))
    .map((f) => ({
      id: f.id,
      farm_name: f.farmName,
      grower_name: f.growerName,
      farm_number: f.farmNumber,
      phone_number: f.phoneNumber,
      email: f.email,
      notes: f.notes,
      number_of_houses: f.numberOfHouses,
      number_of_generators: f.numberOfGenerators,
      is_active: f.isActive ? 1 : 0,
      deleted_at: iso(f.deletedAt),
    }));

  tables.houses = houses
    .filter((h) => farmIds.has(h.farmId) && !isManualFarm(h.farmId))
    .map((h) => ({
      id: h.id,
      farm_id: h.farmId,
      house_number: h.houseNumber,
      square_footage: h.squareFootage,
      total_fan_cfm: h.totalFanCFM,
      number_of_fans: h.numberOfFans,
      logged_temp: h.loggedTemp,
      logged_temp_at: h.loggedTempAt,
      deleted_at: iso(h.deletedAt),
    }));

  tables.flocks = flocks
    .filter((f) => farmIds.has(f.farmId) && !isManualFarm(f.farmId))
    .map((f) => ({
      id: f.id,
      farm_id: f.farmId,
      flock_number: f.flockNumber,
      placement_date: day(f.placementDate),
      projected_catch_date: day(f.projectedCatchDate),
      actual_catch_date: day(f.actualCatchDate),
      growth_rate_lbs_per_day: f.growthRateLbsPerDay,
      flock_status: f.flockStatus,
    }));

  const flockIds = new Set(tables.flocks.map((f) => String(f.id)));
  tables.house_flocks = houseFlocks
    .filter((hf) => flockIds.has(hf.flockId))
    .map((hf) => ({
      id: hf.id,
      flock_id: hf.flockId,
      house_id: hf.houseId,
      placed_bird_count: hf.placedBirdCount,
      placement_date: day(hf.placementDate),
      catch_date: day(hf.catchDate),
      catch_time: hf.catchTime,
    }));

  const houseFlockIds = new Set(tables.house_flocks.map((r) => String(r.id)));
  tables.daily_mortality = mortality
    .filter((m) => houseFlockIds.has(m.houseFlockId))
    .map((m) => ({
      id: m.id,
      house_flock_id: m.houseFlockId,
      mortality_date: day(m.mortalityDate),
      bird_age_in_days: m.birdAgeInDays,
      daily_mortality_count: m.dailyMortalityCount,
      cull_count: m.cullCount,
      total_daily_loss: m.totalDailyLoss,
      mortality_cause: m.mortalityCause,
      comments: m.comments,
      is_draft: m.isDraft ? 1 : 0,
    }));

  tables.farm_visits = visits
    .filter((v) => farmIds.has(v.farmId) && !isManualFarm(v.farmId))
    .map((v) => ({
      id: v.id,
      farm_id: v.farmId,
      flock_id: v.flockId,
      visit_date: day(v.visitDate),
      visit_type: v.visitType,
      bird_age_in_days: v.birdAgeInDays,
      general_bird_condition: v.generalBirdCondition,
      notes: v.notes,
      follow_up_required: v.followUpRequired ? 1 : 0,
      follow_up_date: day(v.followUpDate),
      logged_at: iso(v.loggedAt),
    }));

  tables.last_feed_orders = lastFeedOrders
    .filter((o) => farmIds.has(o.farmId) && !isManualFarm(o.farmId))
    .map((o) => ({
      id: o.id,
      farm_id: o.farmId,
      flock_id: o.flockId,
      order_date: day(o.orderDate),
      notes: o.notes,
      calculated_at: iso(o.calculatedAt),
      created_at: iso(o.createdAt),
    }));

  const lfoIds = new Set(tables.last_feed_orders.map((r) => String(r.id)));
  tables.lfo_house_inventory = inventories
    .filter((inv) => lfoIds.has(inv.lastFeedOrderId))
    .map((inv) => ({
      id: inv.id,
      lfo_id: inv.lastFeedOrderId,
      house_id: inv.houseId,
      bin_a_pounds: inv.binAPounds,
      bin_b_pounds: inv.binBPounds,
      feed_up_at: iso(inv.feedUpAt),
      consumption_rate: consumptionByOrder.get(inv.lastFeedOrderId) ?? 0.45,
      head_count: inv.headCount,
    }));

  tables.follow_up_completions = followUps
    .filter((row) => farmIds.has(row.farmId) && !isManualFarm(row.farmId))
    .map((row) => ({
      id: row.id,
      farm_id: row.farmId,
      flock_id: row.flockId,
      scheduled_date: day(row.scheduledDate),
      label: row.label,
      completed_at: iso(row.completedAt),
      status: row.status,
    }));

  tables.farm_issues = issues
    .filter((row) => farmIds.has(row.farmId) && !isManualFarm(row.farmId))
    .map((row) => ({
      id: row.id,
      farm_id: row.farmId,
      house_id: row.houseId,
      flock_id: row.flockId,
      date_reported: day(row.dateReported),
      category: row.category,
      priority: row.priority,
      description: row.description,
      corrective_action: row.correctiveAction,
      assigned_to: row.assignedTo,
      status: row.status,
    }));

  tables.litter_events = litterEvents
    .filter((row) => farmIds.has(row.farmId) && !isManualFarm(row.farmId))
    .map((row) => ({
      id: row.id,
      farm_id: row.farmId,
      house_id: row.houseId,
      event_date: day(row.eventDate),
      event_type: row.eventType,
      litter_depth: row.litterDepth,
      contractor: row.contractor,
      cost: row.cost,
      notes: row.notes,
    }));

  tables.generator_logs = generatorLogs
    .filter((row) => farmIds.has(row.farmId) && !isManualFarm(row.farmId))
    .map((row) => ({
      id: row.id,
      farm_id: row.farmId,
      log_date: day(row.logDate),
      gen1_hours: row.gen1Hours,
      gen2_hours: row.gen2Hours,
      gen3_hours: row.gen3Hours,
      gen4_hours: row.gen4Hours,
      notes: row.notes,
    }));

  tables.service_forms = serviceForms
    .filter((row) => farmIds.has(row.farmId) && !isManualFarm(row.farmId))
    .map((row) => ({
      id: row.id,
      farm_id: row.farmId,
      flock_id: row.flockId,
      form_kind: row.formKind,
      form_date: day(row.formDate),
      payload_json: row.payloadJson,
      visit_id: row.visitId,
      created_at: iso(row.createdAt),
    }));

  tables.feed_deliveries = feedDeliveries.map((row) => ({
    id: row.id,
    flock_id: row.flockId,
    house_flock_id: row.houseFlockId,
    delivery_date: day(row.deliveryDate),
    feed_type: row.feedType,
    feed_mill: row.feedMill,
    ticket_number: row.ticketNumber,
    pounds_delivered: row.poundsDelivered,
    notes: row.notes,
  }));

  return {
    format: MOBILE_SNAPSHOT_FORMAT,
    version: MOBILE_SNAPSHOT_VERSION,
    tables,
  };
}

function asTables(body: unknown): SnapshotTables | null {
  if (!body || typeof body !== "object") return null;
  const record = body as Record<string, unknown>;
  const tables = (record.tables ?? record) as Record<string, unknown>;
  const out = emptyTables();
  for (const name of SNAPSHOT_TABLES) {
    const rows = tables[name];
    out[name] = Array.isArray(rows) ? (rows as SnapshotRow[]) : [];
  }
  return out;
}

export function parseSnapshotBody(body: unknown): SnapshotTables | null {
  return asTables(body);
}

async function assertIdsOwnedByUser(
  tx: Prisma.TransactionClient,
  userId: string,
  farmIds: string[],
  houseIds: string[],
  flockIds: string[],
  houseFlockIds: string[],
) {
  if (farmIds.length) {
    const rows = await tx.farm.findMany({
      where: { id: { in: farmIds } },
      select: { id: true, userId: true },
    });
    if (rows.some((row) => row.userId !== userId)) {
      throw new Error("A farm in this snapshot belongs to another technician");
    }
  }
  if (houseIds.length) {
    const rows = await tx.house.findMany({
      where: { id: { in: houseIds } },
      select: { id: true, farm: { select: { userId: true } } },
    });
    if (rows.some((row) => row.farm.userId !== userId)) {
      throw new Error("A house in this snapshot belongs to another technician");
    }
  }
  if (flockIds.length) {
    const rows = await tx.flock.findMany({
      where: { id: { in: flockIds } },
      select: { id: true, farm: { select: { userId: true } } },
    });
    if (rows.some((row) => row.farm.userId !== userId)) {
      throw new Error("A flock in this snapshot belongs to another technician");
    }
  }
  if (houseFlockIds.length) {
    const rows = await tx.houseFlock.findMany({
      where: { id: { in: houseFlockIds } },
      select: { id: true, flock: { select: { farm: { select: { userId: true } } } } },
    });
    if (rows.some((row) => row.flock.farm.userId !== userId)) {
      throw new Error("A house placement in this snapshot belongs to another technician");
    }
  }
}

export async function applyUserSnapshot(
  userId: string,
  incoming: SnapshotTables,
): Promise<ApplySnapshotResult> {
  const skipped: string[] = [];
  const flockStatusValues = Object.values(FlockStatus);
  const flockSexValues = Object.values(FlockSex);
  const mortalityCauseValues = Object.values(MortalityCause);
  const visitTypeValues = Object.values(VisitType);
  const litterTypeValues = Object.values(LitterEventType);
  const issueCategoryValues = Object.values(IssueCategory);
  const issuePriorityValues = Object.values(IssuePriority);
  const issueStatusValues = Object.values(IssueStatus);

  const farms = (incoming.farms ?? []).filter((row) => !isManualFarm(str(row.id)));
  const farmIdSet = new Set(idsOf(farms));
  const farmIds = [...farmIdSet];

  const houses = (incoming.houses ?? []).filter((row) => farmIdSet.has(str(row.farm_id) ?? ""));
  const flocks = (incoming.flocks ?? []).filter((row) => farmIdSet.has(str(row.farm_id) ?? ""));
  const houseIds = idsOf(houses);
  const flockIds = idsOf(flocks);
  const houseIdSet = new Set(houseIds);
  const flockIdSet = new Set(flockIds);

  const houseFlocks = (incoming.house_flocks ?? []).filter(
    (row) => flockIdSet.has(str(row.flock_id) ?? "") && houseIdSet.has(str(row.house_id) ?? ""),
  );
  const houseFlockIds = idsOf(houseFlocks);
  const houseFlockIdSet = new Set(houseFlockIds);

  return prisma.$transaction(
    async (tx) => {
      await assertIdsOwnedByUser(tx, userId, farmIds, houseIds, flockIds, houseFlockIds);

      if (farmIds.length) {
        await tx.dailyMortality.deleteMany({
          where: {
            houseFlock: { flock: { farmId: { in: farmIds } } },
            ...exceptIds(idsOf(incoming.daily_mortality)),
          },
        });
        await tx.feedDelivery.deleteMany({
          where: {
            OR: [
              { flock: { farmId: { in: farmIds } } },
              { houseFlock: { flock: { farmId: { in: farmIds } } } },
            ],
            ...exceptIds(idsOf(incoming.feed_deliveries)),
          },
        });
        await tx.farmVisit.deleteMany({
          where: { farmId: { in: farmIds }, ...exceptIds(idsOf(incoming.farm_visits)) },
        });
        await tx.followUpCompletion.deleteMany({
          where: {
            farmId: { in: farmIds },
            ...exceptIds(idsOf(incoming.follow_up_completions)),
          },
        });
        await tx.farmIssue.deleteMany({
          where: { farmId: { in: farmIds }, ...exceptIds(idsOf(incoming.farm_issues)) },
        });
        await tx.litterEvent.deleteMany({
          where: { farmId: { in: farmIds }, ...exceptIds(idsOf(incoming.litter_events)) },
        });
        await tx.generatorLog.deleteMany({
          where: { farmId: { in: farmIds }, ...exceptIds(idsOf(incoming.generator_logs)) },
        });
        await tx.serviceForm.deleteMany({
          where: { farmId: { in: farmIds }, ...exceptIds(idsOf(incoming.service_forms)) },
        });
        await tx.lastFeedOrderHouseInventory.deleteMany({
          where: {
            lastFeedOrder: { farmId: { in: farmIds } },
            ...exceptIds(idsOf(incoming.lfo_house_inventory)),
          },
        });
        await tx.lastFeedOrder.deleteMany({
          where: { farmId: { in: farmIds }, ...exceptIds(idsOf(incoming.last_feed_orders)) },
        });
        await tx.houseFlock.deleteMany({
          where: { flock: { farmId: { in: farmIds } }, ...exceptIds(houseFlockIds) },
        });
        await tx.flock.deleteMany({
          where: { farmId: { in: farmIds }, ...exceptIds(flockIds) },
        });
        await tx.house.deleteMany({
          where: { farmId: { in: farmIds }, ...exceptIds(houseIds) },
        });
      }

      let farmCount = 0;
      for (const row of farms) {
        const id = str(row.id);
        if (!id) {
          skipped.push("farm without id");
          continue;
        }
        const farmName = str(row.farm_name) ?? "Farm";
        const growerName = str(row.grower_name) ?? "";
        const gens = num(row.number_of_generators);
        const data = {
          farmName,
          growerName,
          farmNumber: str(row.farm_number),
          phoneNumber: str(row.phone_number),
          email: str(row.email),
          notes: str(row.notes),
          numberOfHouses: int(row.number_of_houses, 0),
          numberOfGenerators: gens && gens > 0 ? Math.trunc(gens) : null,
          isActive: bool(row.is_active, true),
          deletedAt: dateTime(row.deleted_at),
        };
        await tx.farm.upsert({
          where: { id },
          create: { id, userId, ...data },
          update: data,
        });
        farmCount += 1;
      }

      let houseCount = 0;
      for (const row of houses) {
        const id = str(row.id);
        const farmId = str(row.farm_id);
        if (!id || !farmId) {
          skipped.push("house missing id/farm");
          continue;
        }
        const data = {
          farmId,
          houseNumber: int(row.house_number, 1),
          squareFootage: num(row.square_footage) ?? 29700,
          totalFanCFM: num(row.total_fan_cfm),
          numberOfFans: num(row.number_of_fans) != null ? int(row.number_of_fans) : null,
          loggedTemp: str(row.logged_temp),
          loggedTempAt: str(row.logged_temp_at),
          deletedAt: dateTime(row.deleted_at),
        };
        await tx.house.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });
        houseCount += 1;
      }

      const placedByFlock = new Map<string, number>();
      for (const row of houseFlocks) {
        const fid = str(row.flock_id);
        if (!fid) continue;
        placedByFlock.set(fid, (placedByFlock.get(fid) ?? 0) + int(row.placed_bird_count, 0));
      }

      let flockCount = 0;
      for (const row of flocks) {
        const id = str(row.id);
        const farmId = str(row.farm_id);
        const placementDate = dateOnly(row.placement_date);
        if (!id || !farmId || !placementDate) {
          skipped.push("flock missing id/farm/placement");
          continue;
        }
        const data = {
          farmId,
          flockNumber: str(row.flock_number) ?? "1",
          placementDate,
          projectedCatchDate: dateOnly(row.projected_catch_date),
          actualCatchDate: dateOnly(row.actual_catch_date),
          growthRateLbsPerDay: num(row.growth_rate_lbs_per_day),
          flockStatus: enumOr(row.flock_status, flockStatusValues, FlockStatus.ACTIVE),
          sex: enumOr(row.sex, flockSexValues, FlockSex.STRAIGHT_RUN),
          initialBirdCount: placedByFlock.get(id) ?? 0,
        };
        await tx.flock.upsert({
          where: { id },
          create: { id, ...data },
          update: {
            farmId: data.farmId,
            flockNumber: data.flockNumber,
            placementDate: data.placementDate,
            projectedCatchDate: data.projectedCatchDate,
            actualCatchDate: data.actualCatchDate,
            growthRateLbsPerDay: data.growthRateLbsPerDay,
            flockStatus: data.flockStatus,
            initialBirdCount: data.initialBirdCount,
          },
        });
        flockCount += 1;
      }

      let houseFlockCount = 0;
      for (const row of houseFlocks) {
        const id = str(row.id);
        const flockId = str(row.flock_id);
        const houseId = str(row.house_id);
        if (!id || !flockId || !houseId) {
          skipped.push("house_flock missing ids");
          continue;
        }
        const data = {
          flockId,
          houseId,
          placedBirdCount: int(row.placed_bird_count, 0),
          placementDate: dateOnly(row.placement_date),
          catchDate: dateOnly(row.catch_date),
          catchTime: str(row.catch_time),
        };
        await tx.houseFlock.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });
        houseFlockCount += 1;
      }

      let mortalityCount = 0;
      for (const row of incoming.daily_mortality ?? []) {
        const id = str(row.id);
        const houseFlockId = str(row.house_flock_id);
        const mortalityDate = dateOnly(row.mortality_date);
        if (!id || !houseFlockId || !mortalityDate || !houseFlockIdSet.has(houseFlockId)) {
          skipped.push("mortality row skipped");
          continue;
        }
        const dailyMortalityCount = int(row.daily_mortality_count, 0);
        const cullCount = int(row.cull_count, 0);
        const data = {
          houseFlockId,
          mortalityDate,
          birdAgeInDays: int(row.bird_age_in_days, 0),
          dailyMortalityCount,
          cullCount,
          totalDailyLoss: int(row.total_daily_loss, dailyMortalityCount + cullCount),
          mortalityCause: enumOr(row.mortality_cause, mortalityCauseValues, MortalityCause.UNKNOWN),
          comments: str(row.comments),
          enteredByUserId: userId,
          isDraft: bool(row.is_draft),
        };
        await tx.dailyMortality.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });
        mortalityCount += 1;
      }

      let visitCount = 0;
      for (const row of incoming.farm_visits ?? []) {
        const id = str(row.id);
        const farmId = str(row.farm_id);
        const visitDate = dateOnly(row.visit_date);
        if (!id || !farmId || !visitDate || !farmIdSet.has(farmId)) {
          skipped.push("visit skipped");
          continue;
        }
        const flockId = str(row.flock_id);
        const data = {
          farmId,
          flockId: flockId && flockIdSet.has(flockId) ? flockId : null,
          visitDate,
          loggedAt: dateTime(row.logged_at) ?? dateTime(row.created_at) ?? new Date(),
          birdAgeInDays: num(row.bird_age_in_days) != null ? int(row.bird_age_in_days) : null,
          visitType: enumOr(row.visit_type, visitTypeValues, VisitType.ROUTINE_SERVICE),
          generalBirdCondition: str(row.general_bird_condition),
          notes: str(row.notes),
          followUpRequired: bool(row.follow_up_required),
          followUpDate: dateOnly(row.follow_up_date),
        };
        await tx.farmVisit.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });
        visitCount += 1;
      }

      const activeFlockByFarm = new Map<string, string>();
      for (const row of flocks) {
        const id = str(row.id);
        const farmId = str(row.farm_id);
        if (!id || !farmId) continue;
        const status = enumOr(row.flock_status, flockStatusValues, FlockStatus.ACTIVE);
        if (status === FlockStatus.ACTIVE && !activeFlockByFarm.has(farmId)) {
          activeFlockByFarm.set(farmId, id);
        }
      }
      for (const row of flocks) {
        const id = str(row.id);
        const farmId = str(row.farm_id);
        if (!id || !farmId || activeFlockByFarm.has(farmId)) continue;
        activeFlockByFarm.set(farmId, id);
      }

      let lfoCount = 0;
      for (const row of incoming.last_feed_orders ?? []) {
        const id = str(row.id);
        const farmId = str(row.farm_id);
        const orderDate = dateOnly(row.order_date);
        if (!id || !farmId || !orderDate || !farmIdSet.has(farmId) || isManualFarm(farmId)) {
          skipped.push("LFO skipped");
          continue;
        }
        const requestedFlock = str(row.flock_id);
        const flockId =
          (requestedFlock && flockIdSet.has(requestedFlock) ? requestedFlock : null) ??
          activeFlockByFarm.get(farmId);
        if (!flockId) {
          skipped.push(`LFO ${id} (no flock)`);
          continue;
        }
        const inventories = (incoming.lfo_house_inventory ?? []).filter(
          (inv) => str(inv.lfo_id) === id,
        );
        const consumptionRate =
          num(inventories[0]?.consumption_rate) ?? num(row.consumption_rate) ?? 0.45;
        const data = {
          farmId,
          flockId,
          orderDate,
          consumptionRate,
          notes: str(row.notes),
          calculatedAt: dateTime(row.calculated_at),
        };
        await tx.lastFeedOrder.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });
        lfoCount += 1;

        for (const inv of inventories) {
          const invId = str(inv.id);
          const houseId = str(inv.house_id);
          if (!invId || !houseId || !houseIdSet.has(houseId)) continue;
          const storedHeads = num(inv.head_count);
          const invData = {
            lastFeedOrderId: id,
            houseId,
            binAPounds: num(inv.bin_a_pounds) ?? 0,
            binBPounds: num(inv.bin_b_pounds) ?? 0,
            feedUpAt: dateTime(inv.feed_up_at),
            headCount: storedHeads == null ? null : Math.trunc(storedHeads),
          };
          await tx.lastFeedOrderHouseInventory.upsert({
            where: { id: invId },
            create: { id: invId, ...invData },
            update: invData,
          });
        }
      }

      let followUpCount = 0;
      for (const row of incoming.follow_up_completions ?? []) {
        const id = str(row.id);
        const farmId = str(row.farm_id);
        const scheduledDate = dateOnly(row.scheduled_date);
        const label = str(row.label);
        if (!id || !farmId || !scheduledDate || !label || !farmIdSet.has(farmId)) {
          skipped.push("follow-up skipped");
          continue;
        }
        const flockId = str(row.flock_id);
        const data = {
          farmId,
          flockId: flockId && flockIdSet.has(flockId) ? flockId : null,
          scheduledDate,
          label,
          status: str(row.status) === "DISMISSED" ? "DISMISSED" : "COMPLETED",
          completedAt: dateTime(row.completed_at) ?? new Date(),
          completedByUserId: userId,
        };
        try {
          await tx.followUpCompletion.upsert({
            where: { id },
            create: { id, ...data },
            update: data,
          });
          followUpCount += 1;
        } catch (e) {
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
            skipped.push(`duplicate follow-up ${label}`);
          } else {
            throw e;
          }
        }
      }

      let issueCount = 0;
      for (const row of incoming.farm_issues ?? []) {
        const id = str(row.id);
        const farmId = str(row.farm_id);
        const dateReported = dateOnly(row.date_reported);
        const description = str(row.description);
        if (!id || !farmId || !dateReported || !description || !farmIdSet.has(farmId)) {
          skipped.push("issue skipped");
          continue;
        }
        const houseId = str(row.house_id);
        const flockId = str(row.flock_id);
        const data = {
          farmId,
          houseId: houseId && houseIdSet.has(houseId) ? houseId : null,
          flockId: flockId && flockIdSet.has(flockId) ? flockId : null,
          dateReported,
          category: enumOr(row.category, issueCategoryValues, IssueCategory.OTHER),
          priority: enumOr(row.priority, issuePriorityValues, IssuePriority.MEDIUM),
          description,
          correctiveAction: str(row.corrective_action),
          assignedTo: str(row.assigned_to),
          status: enumOr(row.status, issueStatusValues, IssueStatus.OPEN),
        };
        await tx.farmIssue.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });
        issueCount += 1;
      }

      let litterCount = 0;
      for (const row of incoming.litter_events ?? []) {
        const id = str(row.id);
        const farmId = str(row.farm_id);
        const eventDate = dateOnly(row.event_date);
        if (!id || !farmId || !eventDate || !farmIdSet.has(farmId)) {
          skipped.push("litter skipped");
          continue;
        }
        const houseId = str(row.house_id);
        const data = {
          farmId,
          houseId: houseId && houseIdSet.has(houseId) ? houseId : null,
          eventDate,
          eventType: enumOr(row.event_type, litterTypeValues, LitterEventType.FULL_LITTER_CLEANOUT),
          litterDepth: num(row.litter_depth),
          contractor: str(row.contractor),
          cost: num(row.cost),
          notes: str(row.notes),
        };
        await tx.litterEvent.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });
        litterCount += 1;
      }

      let generatorCount = 0;
      for (const row of incoming.generator_logs ?? []) {
        const id = str(row.id);
        const farmId = str(row.farm_id);
        const logDate = dateOnly(row.log_date);
        if (!id || !farmId || !logDate || !farmIdSet.has(farmId)) {
          skipped.push("generator log skipped");
          continue;
        }
        const data = {
          farmId,
          logDate,
          gen1Hours: num(row.gen1_hours),
          gen2Hours: num(row.gen2_hours),
          gen3Hours: num(row.gen3_hours),
          gen4Hours: num(row.gen4_hours),
          notes: str(row.notes),
        };
        await tx.generatorLog.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });
        generatorCount += 1;
      }

      let serviceFormCount = 0;
      for (const row of incoming.service_forms ?? []) {
        const id = str(row.id);
        const farmId = str(row.farm_id);
        const formKind = str(row.form_kind);
        const formDate = dateOnly(row.form_date);
        const payloadJson = str(row.payload_json) ?? "{}";
        if (!id || !farmId || !formKind || !formDate || !farmIdSet.has(farmId)) {
          skipped.push("service form skipped");
          continue;
        }
        const flockId = str(row.flock_id);
        const data = {
          farmId,
          flockId: flockId && flockIdSet.has(flockId) ? flockId : null,
          formKind,
          formDate,
          payloadJson,
          visitId: str(row.visit_id),
          createdAt: dateTime(row.created_at) ?? new Date(),
        };
        await tx.serviceForm.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });
        serviceFormCount += 1;
      }

      let feedCount = 0;
      for (const row of incoming.feed_deliveries ?? []) {
        const id = str(row.id);
        const deliveryDate = dateOnly(row.delivery_date);
        const pounds = num(row.pounds_delivered);
        if (!id || !deliveryDate || pounds == null) {
          skipped.push("feed delivery skipped");
          continue;
        }
        const flockId = str(row.flock_id);
        const houseFlockId = str(row.house_flock_id);
        const resolvedFlock = flockId && flockIdSet.has(flockId) ? flockId : null;
        const resolvedHf = houseFlockId && houseFlockIdSet.has(houseFlockId) ? houseFlockId : null;
        if (!resolvedFlock && !resolvedHf) {
          skipped.push("feed delivery (no flock/house)");
          continue;
        }
        const data = {
          flockId: resolvedFlock,
          houseFlockId: resolvedHf,
          deliveryDate,
          feedType: str(row.feed_type),
          feedMill: str(row.feed_mill),
          ticketNumber: str(row.ticket_number),
          poundsDelivered: pounds,
          tonsDelivered: pounds / 2000,
          notes: str(row.notes),
        };
        await tx.feedDelivery.upsert({
          where: { id },
          create: { id, ...data },
          update: data,
        });
        feedCount += 1;
      }

      return {
        farms: farmCount,
        houses: houseCount,
        flocks: flockCount,
        houseFlocks: houseFlockCount,
        mortality: mortalityCount,
        visits: visitCount,
        lastFeedOrders: lfoCount,
        followUps: followUpCount,
        issues: issueCount,
        litterEvents: litterCount,
        generatorLogs: generatorCount,
        serviceForms: serviceFormCount,
        feedDeliveries: feedCount,
        skipped: skipped.slice(0, 40),
      };
    },
    { timeout: 120_000 },
  );
}
