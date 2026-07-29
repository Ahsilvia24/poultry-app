"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { parseDateKey } from "@/lib/visits/schedule";
import { z } from "zod";

const toggleSchema = z.object({
  farmId: z.string().min(1),
  flockId: z.string().optional().nullable(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().min(1),
  completed: z.boolean(),
});

const dismissSchema = z.object({
  farmId: z.string().min(1),
  flockId: z.string().optional().nullable(),
  scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  label: z.string().min(1),
});

function weightLabels(label: string) {
  return label === "Weight Proj." || label === "Weight Projection"
    ? ["Weight Proj.", "Weight Projection"]
    : [label];
}

async function assertFarmAccess(farmId: string, userId: string) {
  return prisma.farm.findFirst({
    where: { id: farmId, userId, deletedAt: null },
  });
}

function revalidateFollowUps(farmId: string) {
  revalidatePath("/");
  revalidatePath("/lfo");
  revalidatePath(`/farms/${farmId}`);
}

export async function toggleFollowUpCompletionAction(raw: unknown) {
  const user = await requireUser();
  const parsed = toggleSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid follow-up update" };
  }

  const farm = await assertFarmAccess(parsed.data.farmId, user.id!);
  if (!farm) return { error: "Farm not found or access denied" };

  const scheduledDate = parseDateKey(parsed.data.scheduledDate);
  const labels = weightLabels(parsed.data.label);

  if (parsed.data.completed) {
    // Prefer the short dashboard label; drop any legacy Weight Projection row.
    await prisma.followUpCompletion.deleteMany({
      where: {
        farmId: parsed.data.farmId,
        scheduledDate,
        label: { in: labels.filter((l) => l !== parsed.data.label) },
      },
    });
    await prisma.followUpCompletion.upsert({
      where: {
        farmId_scheduledDate_label: {
          farmId: parsed.data.farmId,
          scheduledDate,
          label: parsed.data.label,
        },
      },
      create: {
        farmId: parsed.data.farmId,
        flockId: parsed.data.flockId || null,
        scheduledDate,
        label: parsed.data.label,
        status: "COMPLETED",
        completedByUserId: user.id!,
      },
      update: {
        flockId: parsed.data.flockId || null,
        completedAt: new Date(),
        status: "COMPLETED",
        completedByUserId: user.id!,
      },
    });
  } else {
    await prisma.followUpCompletion.deleteMany({
      where: {
        farmId: parsed.data.farmId,
        scheduledDate,
        label: { in: labels },
      },
    });
  }

  revalidateFollowUps(parsed.data.farmId);
  return { success: true };
}

/** Remove a schedule item from the list immediately (not crossed out — gone). */
export async function dismissFollowUpAction(raw: unknown) {
  const user = await requireUser();
  const parsed = dismissSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid follow-up dismiss" };
  }

  const farm = await assertFarmAccess(parsed.data.farmId, user.id!);
  if (!farm) return { error: "Farm not found or access denied" };

  const scheduledDate = parseDateKey(parsed.data.scheduledDate);
  const labels = weightLabels(parsed.data.label);

  await prisma.followUpCompletion.deleteMany({
    where: {
      farmId: parsed.data.farmId,
      scheduledDate,
      label: { in: labels.filter((l) => l !== parsed.data.label) },
    },
  });
  await prisma.followUpCompletion.upsert({
    where: {
      farmId_scheduledDate_label: {
        farmId: parsed.data.farmId,
        scheduledDate,
        label: parsed.data.label,
      },
    },
    create: {
      farmId: parsed.data.farmId,
      flockId: parsed.data.flockId || null,
      scheduledDate,
      label: parsed.data.label,
      status: "DISMISSED",
      completedByUserId: user.id!,
    },
    update: {
      flockId: parsed.data.flockId || null,
      completedAt: new Date(),
      status: "DISMISSED",
      completedByUserId: user.id!,
    },
  });

  revalidateFollowUps(parsed.data.farmId);
  return { success: true };
}
