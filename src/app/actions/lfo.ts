"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertFarmAccess, requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { DEFAULT_LFO_CONSUMPTION_RATE } from "@/lib/lfo/calculate";
import { birdAgeFromPlacement } from "@/lib/mortality/calculations";
import { parseDateKey } from "@/lib/visits/schedule";
import { lastFeedOrderSchema } from "@/lib/validations";

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

export async function createLastFeedOrderAction(farmId: string, formData: FormData) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);

  const parsed = lastFeedOrderSchema.safeParse({
    orderDate: formData.get("orderDate"),
    consumptionRate: formData.get("consumptionRate") || DEFAULT_LFO_CONSUMPTION_RATE,
    notes: emptyToNull(formData.get("notes")),
    houseInventories: parseHouseInventories(formData),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid LFO" };
  }

  const activeFlock = await prisma.flock.findFirst({
    where: { farmId, flockStatus: "ACTIVE", deletedAt: null },
    orderBy: { placementDate: "desc" },
  });
  if (!activeFlock) {
    return { error: "This farm needs an active flock before you can create an LFO." };
  }

  const farmHouses = await prisma.house.findMany({
    where: { farmId, deletedAt: null },
    select: { id: true },
  });
  const farmHouseIds = new Set(farmHouses.map((h) => h.id));
  if (
    parsed.data.houseInventories.length === 0 ||
    parsed.data.houseInventories.some((h) => !farmHouseIds.has(h.houseId))
  ) {
    return { error: "House inventory does not match this farm." };
  }

  let createdId: string;
  try {
    const orderDate = new Date(parsed.data.orderDate);
    const birdAgeInDays = birdAgeFromPlacement(activeFlock.placementDate, parseDateKey(parsed.data.orderDate));
    const created = await prisma.$transaction(async (tx) => {
      const lfo = await tx.lastFeedOrder.create({
        data: {
          farmId,
          flockId: activeFlock.id,
          orderDate,
          consumptionRate: parsed.data.consumptionRate,
          notes: parsed.data.notes,
          houseInventories: {
            create: parsed.data.houseInventories.map((h) => ({
              houseId: h.houseId,
              binAPounds: h.binAPounds,
              binBPounds: h.binBPounds,
              feedUpAt: parseFeedUpDate(h.feedUpAt),
            })),
          },
        },
      });
      // Visit is independent of the LFO row — deleting the LFO must not remove it.
      await tx.farmVisit.create({
        data: {
          farmId,
          flockId: activeFlock.id,
          visitDate: orderDate,
          birdAgeInDays,
          visitType: "WEIGH_DAY",
          generalBirdCondition: "Healthy",
          notes: parsed.data.notes?.trim() || "Last Feed Order",
        },
      });
      return lfo;
    });
    createdId = created.id;
  } catch {
    return { error: "Could not save LFO. Try again." };
  }

  revalidatePath("/lfo");
  revalidatePath(`/lfo/${createdId}`);
  revalidatePath(`/farms/${farmId}`);
  redirect(`/lfo/${createdId}`);
}

export async function updateLastFeedOrderAction(lfoId: string, formData: FormData) {
  const user = await requireUser();
  const existing = await assertLfoAccess(lfoId, user.id!);

  const parsed = lastFeedOrderSchema.safeParse({
    orderDate: formData.get("orderDate"),
    consumptionRate: formData.get("consumptionRate") || DEFAULT_LFO_CONSUMPTION_RATE,
    notes: emptyToNull(formData.get("notes")),
    houseInventories: parseHouseInventories(formData),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid LFO" };
  }

  const farmHouses = await prisma.house.findMany({
    where: { farmId: existing.farmId, deletedAt: null },
    select: { id: true },
  });
  const farmHouseIds = new Set(farmHouses.map((h) => h.id));
  if (
    parsed.data.houseInventories.length === 0 ||
    parsed.data.houseInventories.some((h) => !farmHouseIds.has(h.houseId))
  ) {
    return { error: "House inventory does not match this farm." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.lastFeedOrder.update({
        where: { id: lfoId },
        data: {
          orderDate: new Date(parsed.data.orderDate),
          consumptionRate: parsed.data.consumptionRate,
          notes: parsed.data.notes,
        },
      });

      for (const inv of parsed.data.houseInventories) {
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
          },
          update: {
            binAPounds: inv.binAPounds,
            binBPounds: inv.binBPounds,
            feedUpAt: parseFeedUpDate(inv.feedUpAt),
          },
        });
      }
    });
  } catch {
    return { error: "Could not update LFO. Try again." };
  }

  revalidatePath("/lfo");
  revalidatePath(`/lfo/${lfoId}`);
  return { ok: true };
}

export async function deleteLastFeedOrderAction(lfoId: string) {
  const user = await requireUser();
  const existing = await assertLfoAccess(lfoId, user.id!);

  // LFO-only delete — any visit logged at create time is intentionally kept.
  await prisma.lastFeedOrder.delete({ where: { id: lfoId } });

  revalidatePath("/lfo");
  revalidatePath(`/lfo/${lfoId}`);
  revalidatePath(`/farms/${existing.farmId}`);
  return { ok: true as const };
}
