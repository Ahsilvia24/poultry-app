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

export async function toggleFollowUpCompletionAction(raw: unknown) {
  const user = await requireUser();
  const parsed = toggleSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid follow-up update" };
  }

  const farm = await prisma.farm.findFirst({
    where: { id: parsed.data.farmId, userId: user.id!, deletedAt: null },
  });
  if (!farm) return { error: "Farm not found or access denied" };

  const scheduledDate = parseDateKey(parsed.data.scheduledDate);
  const labels =
    parsed.data.label === "Weight Proj." || parsed.data.label === "Weight Projection"
      ? ["Weight Proj.", "Weight Projection"]
      : [parsed.data.label];

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

  revalidatePath("/");
  revalidatePath("/lfo");
  revalidatePath(`/farms/${parsed.data.farmId}`);
  return { success: true };
}
