"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import {
  birdAgeFromPlacement,
  calcTotalDailyLoss,
  getLatestSummary,
} from "@/lib/mortality/calculations";
import { prisma } from "@/lib/prisma";
import { mortalityBatchSchema, mortalityHouseSeriesSchema } from "@/lib/validations";

export async function saveMortalityBatchAction(raw: unknown) {
  const user = await requireUser();
  const parsed = mortalityBatchSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid mortality entry" };
  }

  const flock = await prisma.flock.findFirst({
    where: {
      id: parsed.data.flockId,
      farm: { userId: user.id!, deletedAt: null },
    },
    include: {
      houseFlocks: {
        include: { mortalities: true },
      },
    },
  });
  if (!flock) return { error: "Flock not found or access denied" };

  const mortalityDate = new Date(parsed.data.mortalityDate);
  const hfMap = new Map(flock.houseFlocks.map((hf) => [hf.id, hf]));

  for (const entry of parsed.data.entries) {
    const hf = hfMap.get(entry.houseFlockId);
    if (!hf) return { error: "Invalid house flock" };

    const loss = calcTotalDailyLoss(entry.dailyMortalityCount, entry.cullCount);
    const existingOther = hf.mortalities.filter(
      (m) => m.mortalityDate.toISOString().slice(0, 10) !== parsed.data.mortalityDate,
    );
    const latest = getLatestSummary(hf.placedBirdCount, existingOther, mortalityDate);
    const remainingBefore = latest?.remainingBirdCount ?? hf.placedBirdCount;

    if (loss > remainingBefore) {
      return {
        error: `Daily loss for a house cannot exceed remaining birds (${remainingBefore}).`,
      };
    }
  }

  const results = [];
  for (const entry of parsed.data.entries) {
    const hf = hfMap.get(entry.houseFlockId)!;
    const birdAge = birdAgeFromPlacement(hf.placementDate ?? flock.placementDate, mortalityDate);
    const loss = calcTotalDailyLoss(entry.dailyMortalityCount, entry.cullCount);
    const row = await prisma.dailyMortality.upsert({
      where: {
        houseFlockId_mortalityDate: {
          houseFlockId: entry.houseFlockId,
          mortalityDate,
        },
      },
      create: {
        houseFlockId: entry.houseFlockId,
        mortalityDate,
        birdAgeInDays: birdAge,
        dailyMortalityCount: entry.dailyMortalityCount,
        cullCount: entry.cullCount,
        totalDailyLoss: loss,
        mortalityCause: entry.mortalityCause,
        comments: entry.comments,
        isDraft: entry.isDraft ?? false,
        enteredByUserId: user.id!,
      },
      update: {
        birdAgeInDays: birdAge,
        dailyMortalityCount: entry.dailyMortalityCount,
        cullCount: entry.cullCount,
        totalDailyLoss: loss,
        mortalityCause: entry.mortalityCause,
        comments: entry.comments,
        isDraft: entry.isDraft ?? false,
        enteredByUserId: user.id!,
      },
    });
    results.push(row);
  }

  revalidatePath("/");
  revalidatePath("/mortality");
  revalidatePath(`/farms/${flock.farmId}`);

  const maxAge = results.reduce((m, r) => Math.max(m, r.birdAgeInDays), 0);
  return { success: true, count: results.length, birdAgeInDays: maxAge };
}

export async function saveMortalityHouseSeriesAction(raw: unknown) {
  const user = await requireUser();
  const parsed = mortalityHouseSeriesSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid mortality series" };
  }

  const flock = await prisma.flock.findFirst({
    where: {
      id: parsed.data.flockId,
      farm: { userId: user.id!, deletedAt: null },
    },
    include: {
      houseFlocks: {
        include: { mortalities: true },
      },
    },
  });
  if (!flock) return { error: "Flock not found or access denied" };

  const hf = flock.houseFlocks.find((h) => h.id === parsed.data.houseFlockId);
  if (!hf) return { error: "Invalid house flock" };

  const entries = [...parsed.data.entries].sort((a, b) =>
    a.mortalityDate.localeCompare(b.mortalityDate),
  );
  const clearDates = new Set(parsed.data.clearDates ?? []);

  if (clearDates.size > 0) {
    await prisma.dailyMortality.deleteMany({
      where: {
        houseFlockId: hf.id,
        mortalityDate: {
          in: [...clearDates].map((d) => new Date(d)),
        },
      },
    });
  }

  const existingByDate = new Map(
    hf.mortalities
      .map((m) => [m.mortalityDate.toISOString().slice(0, 10), m] as const)
      .filter(([dateKey]) => !clearDates.has(dateKey)),
  );
  const submittedDates = new Set(entries.map((e) => e.mortalityDate));
  const allDates = [
    ...new Set([
      ...existingByDate.keys(),
      ...entries.map((e) => e.mortalityDate),
    ]),
  ].sort();

  let remaining = hf.placedBirdCount;
  for (const dateKey of allDates) {
    if (submittedDates.has(dateKey)) {
      const entry = entries.find((e) => e.mortalityDate === dateKey)!;
      const loss = calcTotalDailyLoss(entry.dailyMortalityCount, entry.cullCount);
      if (loss > remaining) {
        return {
          error: `Day ${dateKey}: loss (${loss}) exceeds remaining birds (${remaining}).`,
        };
      }
      remaining -= loss;
    } else {
      const existing = existingByDate.get(dateKey);
      if (existing && !existing.isDraft) {
        remaining -= existing.dailyMortalityCount;
      }
    }
  }

  const placementForAge = hf.placementDate ?? flock.placementDate;

  const results = [];
  for (const entry of entries) {
    const mortalityDate = new Date(entry.mortalityDate);
    const birdAge = birdAgeFromPlacement(placementForAge, mortalityDate);
    const loss = calcTotalDailyLoss(entry.dailyMortalityCount, entry.cullCount);
    const row = await prisma.dailyMortality.upsert({
      where: {
        houseFlockId_mortalityDate: {
          houseFlockId: hf.id,
          mortalityDate,
        },
      },
      create: {
        houseFlockId: hf.id,
        mortalityDate,
        birdAgeInDays: birdAge,
        dailyMortalityCount: entry.dailyMortalityCount,
        cullCount: entry.cullCount,
        totalDailyLoss: loss,
        mortalityCause: parsed.data.mortalityCause,
        comments: parsed.data.comments,
        isDraft: parsed.data.isDraft ?? false,
        enteredByUserId: user.id!,
      },
      update: {
        birdAgeInDays: birdAge,
        dailyMortalityCount: entry.dailyMortalityCount,
        cullCount: entry.cullCount,
        totalDailyLoss: loss,
        isDraft: parsed.data.isDraft ?? false,
        enteredByUserId: user.id!,
      },
    });
    results.push(row);
  }

  revalidatePath("/");
  revalidatePath("/mortality");
  revalidatePath(`/farms/${flock.farmId}`);

  const maxAge = results.reduce((m, r) => Math.max(m, r.birdAgeInDays), 0);
  return { success: true, count: results.length, birdAgeInDays: maxAge };
}
