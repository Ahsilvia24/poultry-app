"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import {
  birdAgeFromPlacement,
  calcTotalDailyLoss,
  getLatestSummary,
} from "@/lib/mortality/calculations";
import { prisma } from "@/lib/prisma";
import { mortalityBatchSchema } from "@/lib/validations";

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
  const birdAge = birdAgeFromPlacement(flock.placementDate, mortalityDate);
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

  return { success: true, count: results.length, birdAgeInDays: birdAge };
}
