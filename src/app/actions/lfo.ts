"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertFarmAccess, requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { DEFAULT_LFO_CONSUMPTION_RATE, feedUpAtFromCatch } from "@/lib/lfo/calculate";
import { nextCustomLfoName, parseCustomLfoNumber } from "@/lib/lfo/customName";
import { getFarmHouseHeadCounts } from "@/lib/lfo/head-counts";
import { lastFeedOrderSchema } from "@/lib/validations";
import { normalizeHalfHourTime } from "@/lib/time-slots";
import { birdAgeFromPlacement } from "@/lib/mortality/calculations";
import { parseDateKey } from "@/lib/visits/schedule";
import { VISIT_TYPE_LABELS } from "@/lib/utils";
import type { z } from "zod";

function emptyToNull(value: FormDataEntryValue | null) {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function parseHouseInventories(formData: FormData) {
  const houseIds = formData.getAll("houseId") as string[];
  const binAValues = formData.getAll("binAPounds") as string[];
  const binBValues = formData.getAll("binBPounds") as string[];
  const feedUpValues = formData.getAll("feedUpAt") as string[];
  return houseIds.map((houseId, i) => ({
    houseId,
    binAPounds: binAValues[i] === "" || binAValues[i] == null ? 0 : Number(binAValues[i]),
    binBPounds: binBValues[i] === "" || binBValues[i] == null ? 0 : Number(binBValues[i]),
    feedUpAt: emptyToNull(feedUpValues[i] ?? null),
  }));
}

function parseFeedUpDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function assertLfoAccess(lfoId: string, userId: string) {
  const lfo = await prisma.lastFeedOrder.findFirst({
    where: { id: lfoId, farm: { userId, deletedAt: null } },
    include: { farm: true },
  });
  if (!lfo) throw new Error("LFO not found or access denied");
  return lfo;
}

type ParsedLfo = z.infer<typeof lastFeedOrderSchema>;

function parseLfoForm(formData: FormData) {
  return lastFeedOrderSchema.safeParse({
    orderDate: formData.get("orderDate"),
    orderTime: emptyToNull(formData.get("orderTime")),
    consumptionRate: formData.get("consumptionRate") || DEFAULT_LFO_CONSUMPTION_RATE,
    notes: emptyToNull(formData.get("notes")),
    houseInventories: parseHouseInventories(formData),
  });
}

async function assertInventoriesOnFarm(farmId: string, inventories: ParsedLfo["houseInventories"]) {
  const farmHouses = await prisma.house.findMany({
    where: { farmId, deletedAt: null },
    select: { id: true },
  });
  const farmHouseIds = new Set(farmHouses.map((h) => h.id));
  if (inventories.length === 0 || inventories.some((h) => !farmHouseIds.has(h.houseId))) {
    return "House inventory does not match this farm.";
  }
  return null;
}

/** One Last Feed Order visit per farm per order date. Manual LFOs never call this. */
async function ensureLastFeedOrderVisit(farmId: string, orderDate: string) {
  const dateKey = orderDate.trim().slice(0, 10);
  if (!farmId || !dateKey) return;
  const visitDate = parseDateKey(dateKey);
  const existing = await prisma.farmVisit.findFirst({
    where: { farmId, visitType: "LAST_FEED_ORDER", visitDate },
    select: { id: true },
  });
  if (existing) return;
  const flock = await prisma.flock.findFirst({
    where: { farmId, flockStatus: "ACTIVE", deletedAt: null },
    orderBy: { placementDate: "desc" },
    select: { id: true, placementDate: true },
  });
  try {
    await prisma.farmVisit.create({
      data: {
        farmId,
        flockId: flock?.id ?? null,
        visitDate,
        birdAgeInDays: flock
          ? birdAgeFromPlacement(flock.placementDate, visitDate)
          : null,
        visitType: "LAST_FEED_ORDER",
        generalBirdCondition: "Healthy",
        notes: VISIT_TYPE_LABELS.LAST_FEED_ORDER,
        loggedAt: new Date(),
      },
    });
  } catch {
    // LFO save still succeeds if visit logging fails.
  }
}

async function createLfoRecord(farmId: string, parsed: ParsedLfo) {
  const activeFlock = await prisma.flock.findFirst({
    where: { farmId, flockStatus: "ACTIVE", deletedAt: null },
    orderBy: { placementDate: "desc" },
  });
  if (!activeFlock) {
    return { error: "This farm needs an active flock before you can create an LFO." };
  }

  const mismatch = await assertInventoriesOnFarm(farmId, parsed.houseInventories);
  if (mismatch) return { error: mismatch };

  const asOf = new Date();
  const heads = await getFarmHouseHeadCounts(farmId);

  try {
    const created = await prisma.lastFeedOrder.create({
      data: {
        farmId,
        flockId: activeFlock.id,
        orderDate: new Date(parsed.orderDate),
        orderTime: normalizeHalfHourTime(parsed.orderTime),
        consumptionRate: parsed.consumptionRate,
        notes: parsed.notes,
        calculatedAt: asOf,
        houseInventories: {
          create: parsed.houseInventories.map((h) => ({
            houseId: h.houseId,
            binAPounds: h.binAPounds,
            binBPounds: h.binBPounds,
            feedUpAt: parseFeedUpDate(h.feedUpAt),
            headCount: heads.get(h.houseId) ?? 0,
          })),
        },
      },
    });
    await ensureLastFeedOrderVisit(farmId, parsed.orderDate);
    return { id: created.id };
  } catch {
    return { error: "Could not save LFO. Try again." };
  }
}

export async function createLastFeedOrderAction(farmId: string, formData: FormData) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);

  const parsed = parseLfoForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid LFO" };
  }

  const created = await createLfoRecord(farmId, parsed.data);
  if ("error" in created) return created;

  revalidatePath("/lfo");
  revalidatePath(`/lfo/${created.id}`);
  revalidatePath(`/farms/${farmId}`);
  revalidatePath("/");
  revalidatePath("/reports");
  redirect(`/lfo/${created.id}`);
}

export async function updateLastFeedOrderAction(lfoId: string, formData: FormData) {
  const user = await requireUser();
  const existing = await assertLfoAccess(lfoId, user.id!);

  const parsed = parseLfoForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid LFO" };
  }

  const mismatch = await assertInventoriesOnFarm(existing.farmId, parsed.data.houseInventories);
  if (mismatch) return { error: mismatch };

  try {
    const heads = await getFarmHouseHeadCounts(existing.farmId);
    await prisma.$transaction(async (tx) => {
      await tx.lastFeedOrder.update({
        where: { id: lfoId },
        data: {
          orderDate: new Date(parsed.data.orderDate),
          orderTime: normalizeHalfHourTime(parsed.data.orderTime),
          consumptionRate: parsed.data.consumptionRate,
          notes: parsed.data.notes ?? existing.notes,
          // Legacy rows: freeze the original save clock without shifting hours to now.
          ...(existing.calculatedAt ? {} : { calculatedAt: existing.createdAt }),
        },
      });

      const stored = await tx.lastFeedOrderHouseInventory.findMany({
        where: { lastFeedOrderId: lfoId },
        select: { houseId: true, headCount: true },
      });
      const storedHeadByHouse = new Map(stored.map((row) => [row.houseId, row.headCount]));

      for (const inv of parsed.data.houseInventories) {
        const storedHead = storedHeadByHouse.get(inv.houseId);
        await tx.lastFeedOrderHouseInventory.upsert({
          where: {
            lastFeedOrderId_houseId: {
              lastFeedOrderId: lfoId,
              houseId: inv.houseId,
            },
          },
          create: {
            lastFeedOrderId: lfoId,
            houseId: inv.houseId,
            binAPounds: inv.binAPounds,
            binBPounds: inv.binBPounds,
            feedUpAt: parseFeedUpDate(inv.feedUpAt),
            headCount: heads.get(inv.houseId) ?? 0,
          },
          update: {
            binAPounds: inv.binAPounds,
            binBPounds: inv.binBPounds,
            feedUpAt: parseFeedUpDate(inv.feedUpAt),
            ...(storedHead == null ? { headCount: heads.get(inv.houseId) ?? 0 } : {}),
          },
        });
      }
    });
  } catch {
    return { error: "Could not update LFO. Try again." };
  }

  await ensureLastFeedOrderVisit(existing.farmId, parsed.data.orderDate);
  revalidatePath("/lfo");
  revalidatePath(`/lfo/${lfoId}`);
  revalidatePath(`/farms/${existing.farmId}`);
  revalidatePath("/");
  revalidatePath("/reports");
  return { ok: true };
}

/** Copy the current form into a new snapshot using live head counts and now. */
export async function saveAsNewLastFeedOrderAction(fromLfoId: string, formData: FormData) {
  const user = await requireUser();
  const existing = await assertLfoAccess(fromLfoId, user.id!);

  const parsed = parseLfoForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid LFO" };
  }

  const prior = await prisma.lastFeedOrder.findMany({
    where: { farm: { userId: user.id } },
    select: { notes: true },
  });
  const nextNotes =
    parseCustomLfoNumber(existing.notes) != null
      ? nextCustomLfoName(prior.map((row) => row.notes))
      : parsed.data.notes;
  const isManualFarm = !existing.farm.isActive && existing.farm.farmName === "Manual";

  if (isManualFarm) {
    const sourceInvs = await prisma.lastFeedOrderHouseInventory.findMany({
      where: { lastFeedOrderId: fromLfoId },
      select: { houseId: true, headCount: true },
    });
    const headByHouse = new Map(sourceInvs.map((row) => [row.houseId, row.headCount]));
    try {
      await prisma.lastFeedOrder.create({
        data: {
          farmId: existing.farmId,
          flockId: existing.flockId,
          orderDate: new Date(parsed.data.orderDate),
          orderTime: normalizeHalfHourTime(parsed.data.orderTime),
          consumptionRate: parsed.data.consumptionRate,
          notes: nextNotes,
          calculatedAt: new Date(),
          houseInventories: {
            create: parsed.data.houseInventories.map((h) => ({
              houseId: h.houseId,
              binAPounds: h.binAPounds,
              binBPounds: h.binBPounds,
              feedUpAt: parseFeedUpDate(h.feedUpAt),
              headCount: headByHouse.get(h.houseId) ?? 0,
            })),
          },
        },
      });
    } catch {
      return { error: "Could not save LFO. Try again." };
    }
  } else {
    const created = await createLfoRecord(existing.farmId, { ...parsed.data, notes: nextNotes });
    if ("error" in created) return created;
    revalidatePath(`/lfo/${created.id}`);
  }

  revalidatePath("/lfo");
  revalidatePath(`/farms/${existing.farmId}`);
  revalidatePath("/");
  revalidatePath("/reports");
  return { ok: true as const };
}

export async function deleteLastFeedOrderAction(lfoId: string) {
  const user = await requireUser();
  await assertLfoAccess(lfoId, user.id!);

  await prisma.lastFeedOrder.delete({ where: { id: lfoId } });

  revalidatePath("/lfo");
  revalidatePath(`/lfo/${lfoId}`);
  return { ok: true as const };
}

async function getOrCreateManualFarm(userId: string) {
  let farm = await prisma.farm.findFirst({
    where: { userId, farmName: "Manual", isActive: false, deletedAt: null },
    include: { houses: { where: { deletedAt: null }, orderBy: { houseNumber: "asc" } }, flocks: true },
  });
  if (!farm) {
    farm = await prisma.farm.create({
      data: {
        userId,
        farmName: "Manual",
        growerName: "",
        numberOfHouses: 1,
        isActive: false,
        houses: { create: { houseNumber: 1, squareFootage: 29700 } },
        flocks: {
          create: {
            flockNumber: "MANUAL",
            placementDate: new Date(),
            initialBirdCount: 0,
            flockStatus: "COMPLETED",
          },
        },
      },
      include: { houses: { where: { deletedAt: null }, orderBy: { houseNumber: "asc" } }, flocks: true },
    });
  }
  let house = farm.houses[0];
  if (!house) {
    house = await prisma.house.create({
      data: { farmId: farm.id, houseNumber: 1, squareFootage: 29700 },
    });
  }
  let flock = farm.flocks[0];
  if (!flock) {
    flock = await prisma.flock.create({
      data: {
        farmId: farm.id,
        flockNumber: "MANUAL",
        placementDate: new Date(),
        initialBirdCount: 0,
        flockStatus: "COMPLETED",
      },
    });
  }
  return { farm, house, flock };
}

export async function createManualLastFeedOrderAction(formData: FormData) {
  const user = await requireUser();
  const { farm, house, flock } = await getOrCreateManualFarm(user.id!);

  const orderDate = String(formData.get("orderDate") ?? "").trim();
  if (!orderDate) return { error: "Order date is required" };
  const orderTime = normalizeHalfHourTime(String(formData.get("orderTime") ?? "").trim());
  const rateRaw = Number(formData.get("consumptionRate") || DEFAULT_LFO_CONSUMPTION_RATE);
  const consumptionRate =
    Number.isFinite(rateRaw) && rateRaw > 0 ? rateRaw : DEFAULT_LFO_CONSUMPTION_RATE;
  const headCount = Math.max(0, Math.round(Number(formData.get("headCount")) || 0));
  const binAPounds = Math.max(0, Number(formData.get("binAPounds")) || 0);
  const binBPounds = Math.max(0, Number(formData.get("binBPounds")) || 0);
  const catchDate = String(formData.get("catchDate") ?? "").trim();
  const catchTime = String(formData.get("catchTime") ?? "").trim();
  const feedUpAt = parseFeedUpDate(feedUpAtFromCatch(catchDate, catchTime));

  const prior = await prisma.lastFeedOrder.findMany({
    where: { farm: { userId: user.id } },
    select: { notes: true },
  });
  const customName = nextCustomLfoName(prior.map((row) => row.notes));

  try {
    await prisma.lastFeedOrder.create({
      data: {
        farmId: farm.id,
        flockId: flock.id,
        orderDate: new Date(orderDate),
        orderTime,
        consumptionRate,
        notes: customName,
        calculatedAt: new Date(),
        houseInventories: {
          create: {
            houseId: house.id,
            binAPounds,
            binBPounds,
            feedUpAt,
            headCount,
          },
        },
      },
    });
  } catch {
    return { error: "Could not save LFO. Try again." };
  }
  revalidatePath("/lfo");
  return { ok: true as const };
}