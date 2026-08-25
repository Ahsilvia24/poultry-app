"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertFarmAccess, requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { DEFAULT_LFO_CONSUMPTION_RATE } from "@/lib/lfo/calculate";
import { getFarmHouseHeadCounts } from "@/lib/lfo/head-counts";
import { lastFeedOrderSchema } from "@/lib/validations";
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
          consumptionRate: parsed.data.consumptionRate,
          notes: parsed.data.notes,
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

  revalidatePath("/lfo");
  revalidatePath(`/lfo/${lfoId}`);
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

  const created = await createLfoRecord(existing.farmId, parsed.data);
  if ("error" in created) return created;

  revalidatePath("/lfo");
  revalidatePath(`/lfo/${created.id}`);
  redirect(`/lfo/${created.id}`);
}

export async function deleteLastFeedOrderAction(lfoId: string) {
  const user = await requireUser();
  await assertLfoAccess(lfoId, user.id!);

  await prisma.lastFeedOrder.delete({ where: { id: lfoId } });

  revalidatePath("/lfo");
  revalidatePath(`/lfo/${lfoId}`);
  return { ok: true as const };
}
