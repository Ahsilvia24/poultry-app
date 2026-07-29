"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
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
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

const MOBILE_BACKUP_FORMAT = "poultrytech-mobile-backup";
const MOBILE_BACKUP_VERSION = 1;

type BackupTables = {
  farms?: Record<string, unknown>[];
  houses?: Record<string, unknown>[];
  flocks?: Record<string, unknown>[];
  house_flocks?: Record<string, unknown>[];
  daily_mortality?: Record<string, unknown>[];
  farm_visits?: Record<string, unknown>[];
  last_feed_orders?: Record<string, unknown>[];
  lfo_house_inventory?: Record<string, unknown>[];
  follow_up_completions?: Record<string, unknown>[];
  farm_issues?: Record<string, unknown>[];
  litter_events?: Record<string, unknown>[];
  feed_deliveries?: Record<string, unknown>[];
};

type MobileBackupPayload = {
  format?: string;
  version?: number;
  tables?: BackupTables;
};

export type ImportMobileBackupResult =
  | {
      ok: true;
      imported: {
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
        feedDeliveries: number;
      };
      skipped: string[];
      warnings: string[];
    }
  | { ok: false; error: string };

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

function bool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v === "1" || v.toLowerCase() === "true";
  return false;
}

/** Parse mobile yyyy-MM-dd / ISO / epoch into a Date (UTC noon for date-only). */
function dateOnly(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T12:00:00.000Z`);
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dateTime(v: unknown): Date | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function enumOr<T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  const s = str(v);
  if (s && (allowed as readonly string[]).includes(s)) return s as T;
  return fallback;
}

function newId() {
  return randomUUID();
}

export async function importMobileBackupAction(
  jsonText: string,
  options?: { replaceExisting?: boolean },
): Promise<ImportMobileBackupResult> {
  const user = await requireUser();
  const userId = user.id!;

  let payload: MobileBackupPayload;
  try {
    payload = JSON.parse(jsonText) as MobileBackupPayload;
  } catch {
    return { ok: false, error: "Invalid JSON — could not parse the backup file." };
  }

  if (payload.format !== MOBILE_BACKUP_FORMAT) {
    return {
      ok: false,
      error: `Unrecognized backup format (expected ${MOBILE_BACKUP_FORMAT}).`,
    };
  }
  if (payload.version !== MOBILE_BACKUP_VERSION) {
    return {
      ok: false,
      error: `Unsupported backup version ${String(payload.version)} (expected ${MOBILE_BACKUP_VERSION}).`,
    };
  }

  const tables = payload.tables ?? {};
  const skipped: string[] = [];
  const warnings: string[] = [];

  const farmIds = new Map<string, string>();
  const houseIds = new Map<string, string>();
  const flockIds = new Map<string, string>();
  const houseFlockIds = new Map<string, string>();
  const lfoIds = new Map<string, string>();

  const flockStatusValues = Object.values(FlockStatus);
  const flockSexValues = Object.values(FlockSex);
  const mortalityCauseValues = Object.values(MortalityCause);
  const visitTypeValues = Object.values(VisitType);
  const litterTypeValues = Object.values(LitterEventType);
  const issueCategoryValues = Object.values(IssueCategory);
  const issuePriorityValues = Object.values(IssuePriority);
  const issueStatusValues = Object.values(IssueStatus);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        if (options?.replaceExisting) {
          await tx.farm.deleteMany({ where: { userId } });
        }

        let farms = 0;
        let houses = 0;
        let flocks = 0;
        let houseFlocks = 0;
        let mortality = 0;
        let visits = 0;
        let lastFeedOrders = 0;
        let followUps = 0;
        let issues = 0;
        let litterEvents = 0;
        let feedDeliveries = 0;

        for (const row of tables.farms ?? []) {
          const oldId = str(row.id);
          if (!oldId) {
            skipped.push("farm without id");
            continue;
          }
          if (str(row.deleted_at)) {
            skipped.push(`deleted farm ${oldId}`);
            continue;
          }
          const farmName = str(row.farm_name) ?? "Imported farm";
          const growerName = str(row.grower_name) ?? "";
          const id = newId();
          await tx.farm.create({
            data: {
              id,
              userId,
              farmName,
              growerName,
              phoneNumber: str(row.phone_number),
              email: str(row.email),
              notes: str(row.notes),
              numberOfHouses: int(row.number_of_houses, 0),
              isActive: bool(row.is_active ?? 1),
            },
          });
          farmIds.set(oldId, id);
          farms += 1;
        }

        for (const row of tables.houses ?? []) {
          const oldId = str(row.id);
          const oldFarmId = str(row.farm_id);
          if (!oldId || !oldFarmId) {
            skipped.push("house missing id/farm");
            continue;
          }
          if (str(row.deleted_at)) {
            skipped.push(`deleted house ${oldId}`);
            continue;
          }
          const farmId = farmIds.get(oldFarmId);
          if (!farmId) {
            skipped.push(`house ${oldId} (farm not imported)`);
            continue;
          }
          const id = newId();
          await tx.house.create({
            data: {
              id,
              farmId,
              houseNumber: int(row.house_number, 1),
              squareFootage: num(row.square_footage) ?? 29700,
              totalFanCFM: num(row.total_fan_cfm),
              numberOfFans: num(row.number_of_fans) != null ? int(row.number_of_fans) : null,
            },
          });
          houseIds.set(oldId, id);
          houses += 1;
        }

        // Precompute placed totals for initialBirdCount
        const placedByFlock = new Map<string, number>();
        for (const row of tables.house_flocks ?? []) {
          const fid = str(row.flock_id);
          if (!fid) continue;
          placedByFlock.set(fid, (placedByFlock.get(fid) ?? 0) + int(row.placed_bird_count, 0));
        }

        for (const row of tables.flocks ?? []) {
          const oldId = str(row.id);
          const oldFarmId = str(row.farm_id);
          if (!oldId || !oldFarmId) {
            skipped.push("flock missing id/farm");
            continue;
          }
          const farmId = farmIds.get(oldFarmId);
          if (!farmId) {
            skipped.push(`flock ${oldId} (farm not imported)`);
            continue;
          }
          const placementDate = dateOnly(row.placement_date);
          if (!placementDate) {
            skipped.push(`flock ${oldId} (invalid placement date)`);
            continue;
          }
          const id = newId();
          await tx.flock.create({
            data: {
              id,
              farmId,
              flockNumber: str(row.flock_number) ?? "1",
              placementDate,
              projectedCatchDate: dateOnly(row.projected_catch_date),
              actualCatchDate: dateOnly(row.actual_catch_date),
              growthRateLbsPerDay: num(row.growth_rate_lbs_per_day),
              flockStatus: enumOr(row.flock_status, flockStatusValues, FlockStatus.ACTIVE),
              sex: enumOr(row.sex, flockSexValues, FlockSex.STRAIGHT_RUN),
              initialBirdCount: placedByFlock.get(oldId) ?? 0,
            },
          });
          flockIds.set(oldId, id);
          flocks += 1;
        }

        for (const row of tables.house_flocks ?? []) {
          const oldId = str(row.id);
          const oldFlockId = str(row.flock_id);
          const oldHouseId = str(row.house_id);
          if (!oldId || !oldFlockId || !oldHouseId) {
            skipped.push("house_flock missing ids");
            continue;
          }
          const flockId = flockIds.get(oldFlockId);
          const houseId = houseIds.get(oldHouseId);
          if (!flockId || !houseId) {
            skipped.push(`house_flock ${oldId} (missing flock/house)`);
            continue;
          }
          const id = newId();
          await tx.houseFlock.create({
            data: {
              id,
              flockId,
              houseId,
              placedBirdCount: int(row.placed_bird_count, 0),
            },
          });
          houseFlockIds.set(oldId, id);
          houseFlocks += 1;
        }

        if (
          (tables.house_flocks ?? []).some(
            (row) => str(row.placement_date) || str(row.catch_date),
          )
        ) {
          warnings.push(
            "Per-house placement/catch dates exist on the phone only and were not imported (flock-level dates were).",
          );
        }

        for (const row of tables.daily_mortality ?? []) {
          const oldHf = str(row.house_flock_id);
          const mortalityDate = dateOnly(row.mortality_date);
          if (!oldHf || !mortalityDate) {
            skipped.push("mortality row missing house_flock/date");
            continue;
          }
          const houseFlockId = houseFlockIds.get(oldHf);
          if (!houseFlockId) {
            skipped.push(`mortality (house_flock not imported)`);
            continue;
          }
          const dailyMortalityCount = int(row.daily_mortality_count, 0);
          const cullCount = int(row.cull_count, 0);
          try {
            await tx.dailyMortality.create({
              data: {
                id: newId(),
                houseFlockId,
                mortalityDate,
                birdAgeInDays: int(row.bird_age_in_days, 0),
                dailyMortalityCount,
                cullCount,
                totalDailyLoss: int(row.total_daily_loss, dailyMortalityCount),
                mortalityCause: enumOr(
                  row.mortality_cause,
                  mortalityCauseValues,
                  MortalityCause.UNKNOWN,
                ),
                comments: str(row.comments),
                enteredByUserId: userId,
                isDraft: bool(row.is_draft),
              },
            });
            mortality += 1;
          } catch (e) {
            if (
              e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === "P2002"
            ) {
              skipped.push(`duplicate mortality ${oldHf} ${mortalityDate.toISOString().slice(0, 10)}`);
            } else {
              throw e;
            }
          }
        }

        for (const row of tables.farm_visits ?? []) {
          const oldFarmId = str(row.farm_id);
          const visitDate = dateOnly(row.visit_date);
          if (!oldFarmId || !visitDate) {
            skipped.push("visit missing farm/date");
            continue;
          }
          const farmId = farmIds.get(oldFarmId);
          if (!farmId) {
            skipped.push("visit (farm not imported)");
            continue;
          }
          const oldFlockId = str(row.flock_id);
          await tx.farmVisit.create({
            data: {
              id: newId(),
              farmId,
              flockId: oldFlockId ? flockIds.get(oldFlockId) ?? null : null,
              visitDate,
              birdAgeInDays: num(row.bird_age_in_days) != null ? int(row.bird_age_in_days) : null,
              visitType: enumOr(row.visit_type, visitTypeValues, VisitType.ROUTINE_SERVICE),
              generalBirdCondition: str(row.general_bird_condition),
              notes: str(row.notes),
              followUpRequired: bool(row.follow_up_required),
              followUpDate: dateOnly(row.follow_up_date),
            },
          });
          visits += 1;
        }

        // Active flock fallback per farm for LFOs missing flock_id
        const activeFlockByFarm = new Map<string, string>();
        for (const [oldFlockId, newFlockId] of flockIds) {
          const flockRow = (tables.flocks ?? []).find((r) => str(r.id) === oldFlockId);
          const oldFarmId = str(flockRow?.farm_id);
          if (!oldFarmId) continue;
          const newFarmId = farmIds.get(oldFarmId);
          if (!newFarmId) continue;
          const status = enumOr(flockRow?.flock_status, flockStatusValues, FlockStatus.ACTIVE);
          if (status === FlockStatus.ACTIVE && !activeFlockByFarm.has(newFarmId)) {
            activeFlockByFarm.set(newFarmId, newFlockId);
          }
        }
        for (const [oldFlockId, newFlockId] of flockIds) {
          const flockRow = (tables.flocks ?? []).find((r) => str(r.id) === oldFlockId);
          const oldFarmId = str(flockRow?.farm_id);
          if (!oldFarmId) continue;
          const newFarmId = farmIds.get(oldFarmId);
          if (!newFarmId || activeFlockByFarm.has(newFarmId)) continue;
          activeFlockByFarm.set(newFarmId, newFlockId);
        }

        for (const row of tables.last_feed_orders ?? []) {
          const oldId = str(row.id);
          const oldFarmId = str(row.farm_id);
          const orderDate = dateOnly(row.order_date);
          if (!oldId || !oldFarmId || !orderDate) {
            skipped.push("LFO missing id/farm/date");
            continue;
          }
          const farmId = farmIds.get(oldFarmId);
          if (!farmId) {
            skipped.push(`LFO ${oldId} (farm not imported)`);
            continue;
          }
          const oldFlockId = str(row.flock_id);
          let flockId = oldFlockId ? flockIds.get(oldFlockId) : undefined;
          if (!flockId) flockId = activeFlockByFarm.get(farmId);
          if (!flockId) {
            skipped.push(`LFO ${oldId} (no flock on farm)`);
            continue;
          }

          const inventories = (tables.lfo_house_inventory ?? []).filter(
            (inv) => str(inv.lfo_id) === oldId,
          );
          const consumptionRate =
            num(inventories[0]?.consumption_rate) ?? num(row.consumption_rate) ?? 0.45;

          const id = newId();
          await tx.lastFeedOrder.create({
            data: {
              id,
              farmId,
              flockId,
              orderDate,
              consumptionRate,
              notes: str(row.notes),
            },
          });
          lfoIds.set(oldId, id);
          lastFeedOrders += 1;

          for (const inv of inventories) {
            const oldHouseId = str(inv.house_id);
            if (!oldHouseId) continue;
            const houseId = houseIds.get(oldHouseId);
            if (!houseId) {
              skipped.push(`LFO inventory house ${oldHouseId} not imported`);
              continue;
            }
            await tx.lastFeedOrderHouseInventory.create({
              data: {
                id: newId(),
                lastFeedOrderId: id,
                houseId,
                binAPounds: num(inv.bin_a_pounds) ?? 0,
                binBPounds: num(inv.bin_b_pounds) ?? 0,
                feedUpAt: dateTime(inv.feed_up_at),
              },
            });
          }
        }

        for (const row of tables.follow_up_completions ?? []) {
          const oldFarmId = str(row.farm_id);
          const scheduledDate = dateOnly(row.scheduled_date);
          const label = str(row.label);
          const completedAt = dateTime(row.completed_at) ?? new Date();
          if (!oldFarmId || !scheduledDate || !label) {
            skipped.push("follow-up missing farm/date/label");
            continue;
          }
          const farmId = farmIds.get(oldFarmId);
          if (!farmId) {
            skipped.push("follow-up (farm not imported)");
            continue;
          }
          const oldFlockId = str(row.flock_id);
          try {
            await tx.followUpCompletion.create({
              data: {
                id: newId(),
                farmId,
                flockId: oldFlockId ? flockIds.get(oldFlockId) ?? null : null,
                scheduledDate,
                label,
                status: str(row.status) === "DISMISSED" ? "DISMISSED" : "COMPLETED",
                completedAt,
                completedByUserId: userId,
              },
            });
            followUps += 1;
          } catch (e) {
            if (
              e instanceof Prisma.PrismaClientKnownRequestError &&
              e.code === "P2002"
            ) {
              skipped.push(`duplicate follow-up ${label}`);
            } else {
              throw e;
            }
          }
        }

        for (const row of tables.farm_issues ?? []) {
          const oldFarmId = str(row.farm_id);
          const dateReported = dateOnly(row.date_reported);
          const description = str(row.description);
          if (!oldFarmId || !dateReported || !description) {
            skipped.push("issue missing farm/date/description");
            continue;
          }
          const farmId = farmIds.get(oldFarmId);
          if (!farmId) {
            skipped.push("issue (farm not imported)");
            continue;
          }
          const oldHouseId = str(row.house_id);
          const oldFlockId = str(row.flock_id);
          await tx.farmIssue.create({
            data: {
              id: newId(),
              farmId,
              houseId: oldHouseId ? houseIds.get(oldHouseId) ?? null : null,
              flockId: oldFlockId ? flockIds.get(oldFlockId) ?? null : null,
              dateReported,
              category: enumOr(row.category, issueCategoryValues, IssueCategory.OTHER),
              priority: enumOr(row.priority, issuePriorityValues, IssuePriority.MEDIUM),
              description,
              correctiveAction: str(row.corrective_action),
              assignedTo: str(row.assigned_to),
              status: enumOr(row.status, issueStatusValues, IssueStatus.OPEN),
            },
          });
          issues += 1;
        }

        for (const row of tables.litter_events ?? []) {
          const oldFarmId = str(row.farm_id);
          const eventDate = dateOnly(row.event_date);
          if (!oldFarmId || !eventDate) {
            skipped.push("litter event missing farm/date");
            continue;
          }
          const farmId = farmIds.get(oldFarmId);
          if (!farmId) {
            skipped.push("litter event (farm not imported)");
            continue;
          }
          const oldHouseId = str(row.house_id);
          await tx.litterEvent.create({
            data: {
              id: newId(),
              farmId,
              houseId: oldHouseId ? houseIds.get(oldHouseId) ?? null : null,
              eventDate,
              eventType: enumOr(
                row.event_type,
                litterTypeValues,
                LitterEventType.FULL_LITTER_CLEANOUT,
              ),
              litterDepth: num(row.litter_depth),
              contractor: str(row.contractor),
              cost: num(row.cost),
              notes: str(row.notes),
            },
          });
          litterEvents += 1;
        }

        for (const row of tables.feed_deliveries ?? []) {
          const deliveryDate = dateOnly(row.delivery_date);
          const pounds = num(row.pounds_delivered);
          if (!deliveryDate || pounds == null) {
            skipped.push("feed delivery missing date/pounds");
            continue;
          }
          const oldFlockId = str(row.flock_id);
          const oldHf = str(row.house_flock_id);
          const flockId = oldFlockId ? flockIds.get(oldFlockId) ?? null : null;
          const houseFlockId = oldHf ? houseFlockIds.get(oldHf) ?? null : null;
          if (!flockId && !houseFlockId) {
            skipped.push("feed delivery (no flock/house_flock)");
            continue;
          }
          await tx.feedDelivery.create({
            data: {
              id: newId(),
              flockId,
              houseFlockId,
              deliveryDate,
              feedType: str(row.feed_type),
              feedMill: str(row.feed_mill),
              ticketNumber: str(row.ticket_number),
              poundsDelivered: pounds,
              tonsDelivered: pounds / 2000,
              notes: str(row.notes),
            },
          });
          feedDeliveries += 1;
        }

        return {
          farms,
          houses,
          flocks,
          houseFlocks,
          mortality,
          visits,
          lastFeedOrders,
          followUps,
          issues,
          litterEvents,
          feedDeliveries,
        };
      },
      { timeout: 120_000 },
    );

    revalidatePath("/");
    revalidatePath("/farms");
    revalidatePath("/settings");
    revalidatePath("/mortality");
    revalidatePath("/dashboard");

    return {
      ok: true,
      imported: result,
      skipped: skipped.slice(0, 40),
      warnings: warnings.slice(0, 20),
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Import failed",
    };
  }
}
