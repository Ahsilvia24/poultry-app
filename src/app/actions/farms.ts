"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addDays } from "date-fns";
import { assertFarmAccess, requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { farmSchema, createFarmSchema, flockSchema, houseSchema } from "@/lib/validations";

function emptyToNull(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

/** Parse `yyyy-MM-dd` as local noon to avoid UTC day shifts. */
function parseDateKey(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!y || !mo || !d) return null;
  return new Date(y, mo - 1, d, 12, 0, 0, 0);
}

async function syncFlockDatesFromHouses(flockId: string) {
  const hfs = await prisma.houseFlock.findMany({
    where: { flockId },
    select: { placementDate: true, catchDate: true },
  });
  const places = hfs
    .map((h) => h.placementDate)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());
  const catches = hfs
    .map((h) => h.catchDate)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime());
  const place = places[0];
  if (!place) return;
  const catchDate = catches[0] ?? addDays(place, 52);
  await prisma.flock.update({
    where: { id: flockId },
    data: { placementDate: place, projectedCatchDate: catchDate },
  });
}

export async function createFarmAction(formData: FormData) {
  const user = await requireUser();
  const parsed = createFarmSchema.safeParse({
    farmName: formData.get("farmName"),
    growerName: emptyToNull(formData.get("growerName")),
    phoneNumber: emptyToNull(formData.get("phoneNumber")),
    notes: emptyToNull(formData.get("notes")),
    numberOfHouses: formData.get("numberOfHouses") || 0,
    numberOfGenerators: formData.get("numberOfGenerators") || null,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid farm" };

  const houseCount = parsed.data.numberOfHouses;
  const defaultSquareFootage = 29700;

  const farm = await prisma.$transaction(async (tx) => {
    const created = await tx.farm.create({
      data: {
        userId: user.id!,
        farmName: parsed.data.farmName,
        growerName: parsed.data.growerName?.trim() || "",
        phoneNumber: parsed.data.phoneNumber,
        notes: parsed.data.notes,
        numberOfHouses: houseCount,
        numberOfGenerators: parsed.data.numberOfGenerators ?? null,
      },
    });

    if (houseCount > 0) {
      await tx.house.createMany({
        data: Array.from({ length: houseCount }, (_, i) => ({
          farmId: created.id,
          houseNumber: i + 1,
          squareFootage: defaultSquareFootage,
        })),
      });
    }

    return created;
  });

  revalidatePath("/farms");
  redirect(`/farms/${farm.id}`);
}

export async function updateFarmAction(farmId: string, formData: FormData) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);
  const parsed = farmSchema.safeParse({
    farmName: formData.get("farmName"),
    growerName: emptyToNull(formData.get("growerName")),
    phoneNumber: emptyToNull(formData.get("phoneNumber")),
    email: emptyToNull(formData.get("email")),
    notes: emptyToNull(formData.get("notes")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid farm" };

  await prisma.farm.update({
    where: { id: farmId },
    data: {
      farmName: parsed.data.farmName,
      growerName: parsed.data.growerName?.trim() || "",
      farmNumber: null,
      address: null,
      city: null,
      state: null,
      zipCode: null,
      phoneNumber: parsed.data.phoneNumber,
      email: parsed.data.email || null,
      notes: parsed.data.notes,
    },
  });
  revalidatePath(`/farms/${farmId}`);
  revalidatePath("/farms");
  revalidatePath("/");
}

export async function deactivateFarmAction(farmId: string, options?: { skipRedirect?: boolean }) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);
  await prisma.farm.update({
    where: { id: farmId },
    data: { isActive: false, deletedAt: null },
  });
  revalidatePath("/farms");
  revalidatePath(`/farms/${farmId}`);
  revalidatePath("/");
  if (!options?.skipRedirect) {
    redirect("/farms?status=inactive");
  }
}

export async function reactivateFarmAction(farmId: string, options?: { skipRedirect?: boolean }) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);
  await prisma.farm.update({
    where: { id: farmId },
    data: { isActive: true, deletedAt: null },
  });
  revalidatePath("/farms");
  revalidatePath(`/farms/${farmId}`);
  revalidatePath("/");
  if (!options?.skipRedirect) {
    redirect("/farms");
  }
}

export async function deleteFarmAction(farmId: string, options?: { skipRedirect?: boolean }) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);
  await prisma.farm.update({
    where: { id: farmId },
    data: { isActive: false, deletedAt: new Date() },
  });
  revalidatePath("/farms");
  revalidatePath("/");
  if (!options?.skipRedirect) {
    redirect("/farms");
  }
}

/** @deprecated Use deleteFarmAction */
export async function archiveFarmAction(farmId: string) {
  return deleteFarmAction(farmId);
}

function parseHouseForm(formData: FormData) {
  return houseSchema.safeParse({
    houseNumber: formData.get("houseNumber"),
    squareFootage: formData.get("squareFootage"),
    totalFanCFM: emptyToNull(formData.get("totalFanCFM")),
    numberOfFans: emptyToNull(formData.get("numberOfFans")),
    coolingPadSquareFootage: emptyToNull(formData.get("coolingPadSquareFootage")),
    controllerType: emptyToNull(formData.get("controllerType")),
    yearBuilt: emptyToNull(formData.get("yearBuilt")),
    minVentilationCFM: emptyToNull(formData.get("minVentilationCFM")),
    fanCycleOnSeconds: emptyToNull(formData.get("fanCycleOnSeconds")),
    fanCycleOffSeconds: emptyToNull(formData.get("fanCycleOffSeconds")),
    notes: emptyToNull(formData.get("notes")),
  });
}

export async function createHouseAction(farmId: string, formData: FormData) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);
  const parsed = parseHouseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid house" };

  await prisma.$transaction(async (tx) => {
    await tx.house.create({ data: { farmId, ...parsed.data } });
    const count = await tx.house.count({ where: { farmId, deletedAt: null } });
    await tx.farm.update({ where: { id: farmId }, data: { numberOfHouses: count } });
  });

  revalidatePath(`/farms/${farmId}`);
}

export async function updateHouseAction(farmId: string, houseId: string, formData: FormData) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);
  const parsed = parseHouseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid house" };

  const house = await prisma.house.findFirst({
    where: { id: houseId, farmId, deletedAt: null },
  });
  if (!house) return { error: "House not found" };

  const conflict = await prisma.house.findFirst({
    where: {
      farmId,
      houseNumber: parsed.data.houseNumber,
      deletedAt: null,
      NOT: { id: houseId },
    },
  });
  if (conflict) return { error: `House ${parsed.data.houseNumber} already exists on this farm` };

  // Notes are no longer edited in the house form — keep any existing value.
  const { notes: _notes, ...houseFields } = parsed.data;
  await prisma.house.update({
    where: { id: houseId },
    data: houseFields,
  });

  const applySpecsToRemaining =
    formData.get("applySpecsToRemaining") === "true" ||
    formData.get("applySpecsToRemaining") === "on";
  if (applySpecsToRemaining) {
    await prisma.house.updateMany({
      where: {
        farmId,
        deletedAt: null,
        houseNumber: { gt: parsed.data.houseNumber },
      },
      data: {
        squareFootage: parsed.data.squareFootage,
        totalFanCFM: parsed.data.totalFanCFM,
        numberOfFans: parsed.data.numberOfFans,
      },
    });
  }

  const placedRaw = emptyToNull(formData.get("placedBirdCount"));
  const placementRaw = emptyToNull(formData.get("placementDate"));
  const catchRaw = emptyToNull(formData.get("catchDate"));
  const flockNumberRaw = emptyToNull(formData.get("flockNumber"));
  const applyToRemaining =
    formData.get("applyToRemaining") === "true" || formData.get("applyToRemaining") === "on";
  const wantsFlockFields =
    placedRaw != null ||
    placementRaw != null ||
    catchRaw != null ||
    flockNumberRaw != null;

  if (wantsFlockFields) {
    let placedBirdCount: number | null = null;
    if (placedRaw != null) {
      placedBirdCount = Number(placedRaw);
      if (!Number.isFinite(placedBirdCount) || placedBirdCount < 1) {
        return { error: "Birds placed must be at least 1" };
      }
      placedBirdCount = Math.floor(placedBirdCount);
    }

    let placementDate = placementRaw ? parseDateKey(placementRaw) : null;
    if (placementRaw && !placementDate) {
      return { error: "Placement date is invalid" };
    }
    let catchDate = catchRaw ? parseDateKey(catchRaw) : null;
    if (catchRaw && !catchDate) {
      return { error: "Catch date is invalid" };
    }
    if (placementDate && !catchDate) {
      catchDate = addDays(placementDate, 52);
    }

    // Prefer the active flock this house already belongs to.
    let activeFlock = await prisma.flock.findFirst({
      where: {
        farmId,
        flockStatus: "ACTIVE",
        deletedAt: null,
        houseFlocks: { some: { houseId } },
      },
      orderBy: { placementDate: "desc" },
    });
    if (!activeFlock) {
      activeFlock = await prisma.flock.findFirst({
        where: { farmId, flockStatus: "ACTIVE", deletedAt: null },
        orderBy: { placementDate: "desc" },
      });
    }
    if (!activeFlock) {
      return { error: "Add an active flock before setting birds placed or dates" };
    }

    if (flockNumberRaw != null) {
      const nextNumber = flockNumberRaw.trim();
      if (!nextNumber) {
        return { error: "Flock ID is required" };
      }
      await prisma.flock.update({
        where: { id: activeFlock.id },
        data: { flockNumber: nextNumber },
      });
    }

    async function upsertHouseFlockFields(targetHouseId: string, includeFlockNumber: boolean) {
      const targetHf = await prisma.houseFlock.findFirst({
        where: { flockId: activeFlock!.id, houseId: targetHouseId },
      });
      if (targetHf) {
        await prisma.houseFlock.update({
          where: { id: targetHf.id },
          data: {
            ...(placedBirdCount != null ? { placedBirdCount } : {}),
            ...(placementDate != null ? { placementDate } : {}),
            ...(catchDate != null ? { catchDate } : {}),
          },
        });
      } else if (placedBirdCount != null || placementDate != null || catchDate != null) {
        if (placedBirdCount == null) {
          throw new Error("Birds placed is required when adding this house to the flock");
        }
        const place = placementDate ?? activeFlock!.placementDate;
        const catchResolved = catchDate ?? addDays(place, 52);
        await prisma.houseFlock.create({
          data: {
            flockId: activeFlock!.id,
            houseId: targetHouseId,
            placedBirdCount,
            placementDate: place,
            catchDate: catchResolved,
          },
        });
      }
      void includeFlockNumber;
    }

    try {
      await upsertHouseFlockFields(houseId, true);
      if (applyToRemaining) {
        const remaining = await prisma.house.findMany({
          where: {
            farmId,
            deletedAt: null,
            houseNumber: { gt: parsed.data.houseNumber },
          },
          select: { id: true },
          orderBy: { houseNumber: "asc" },
        });
        for (const h of remaining) {
          await upsertHouseFlockFields(h.id, false);
        }
      }
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "Could not update house flock fields",
      };
    }

    const sum = await prisma.houseFlock.aggregate({
      where: { flockId: activeFlock.id },
      _sum: { placedBirdCount: true },
    });
    await prisma.flock.update({
      where: { id: activeFlock.id },
      data: {
        initialBirdCount:
          sum._sum.placedBirdCount ?? placedBirdCount ?? activeFlock.initialBirdCount,
      },
    });
    await syncFlockDatesFromHouses(activeFlock.id);
  }

  revalidatePath(`/farms/${farmId}`);
  revalidatePath("/farms");
  revalidatePath("/");
  revalidatePath("/mortality");
  return { success: true };
}

export async function deleteHouseAction(farmId: string, houseId: string) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);

  const house = await prisma.house.findFirst({
    where: { id: houseId, farmId, deletedAt: null },
  });
  if (!house) return { error: "House not found" };

  await prisma.$transaction(async (tx) => {
    await tx.house.update({
      where: { id: houseId },
      data: { deletedAt: new Date() },
    });
    const count = await tx.house.count({ where: { farmId, deletedAt: null } });
    await tx.farm.update({ where: { id: farmId }, data: { numberOfHouses: count } });
  });

  revalidatePath(`/farms/${farmId}`);
  revalidatePath("/farms");
  revalidatePath("/");
  return { success: true };
}

export async function createFlockAction(farmId: string, formData: FormData) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);

  const houseIds = formData.getAll("houseId") as string[];
  const placedCounts = formData.getAll("placedBirdCount") as string[];
  const processingPlants = formData.getAll("houseProcessingPlant") as string[];
  // Empty houses are allowed — only keep placements with birds > 0.
  const housePlacements = houseIds
    .map((houseId, i) => ({
      houseId,
      placedBirdCount: Number(placedCounts[i]),
      processingPlant: processingPlants[i]?.trim() ? processingPlants[i]!.trim() : null,
    }))
    .filter((hp) => Number.isFinite(hp.placedBirdCount) && hp.placedBirdCount > 0);

  const totalPlaced = housePlacements.reduce((s, h) => s + h.placedBirdCount, 0);

  const parsed = flockSchema.safeParse({
    flockNumber: formData.get("flockNumber"),
    flockName: emptyToNull(formData.get("flockName")),
    placementDate: formData.get("placementDate"),
    projectedCatchDate: emptyToNull(formData.get("projectedCatchDate")),
    actualCatchDate: emptyToNull(formData.get("actualCatchDate")),
    processingPlant: null,
    birdType: emptyToNull(formData.get("birdType")),
    sex: formData.get("sex") || "STRAIGHT_RUN",
    initialBirdCount: totalPlaced > 0 ? totalPlaced : 0,
    flockStatus: formData.get("flockStatus") || "ACTIVE",
    targetMarketAge: emptyToNull(formData.get("targetMarketAge")),
    targetMarketWeight: emptyToNull(formData.get("targetMarketWeight")),
    litterConditionAtPlacement: emptyToNull(formData.get("litterConditionAtPlacement")),
    notes: emptyToNull(formData.get("notes")),
    housePlacements,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid flock" };

  if (housePlacements.length > 0) {
    const occupied = await prisma.houseFlock.findFirst({
      where: {
        houseId: { in: housePlacements.map((h) => h.houseId) },
        flock: { farmId, flockStatus: "ACTIVE", deletedAt: null },
      },
      include: { flock: { select: { flockNumber: true } }, house: { select: { houseNumber: true } } },
    });
    if (occupied) {
      return {
        error: `House ${occupied.house.houseNumber} is already on active flock ${occupied.flock.flockNumber}. Leave it empty or complete that flock first.`,
      };
    }
  }

  try {
    await prisma.flock.create({
      data: {
        farmId,
        flockNumber: parsed.data.flockNumber,
        flockName: parsed.data.flockName,
        placementDate: new Date(parsed.data.placementDate),
        projectedCatchDate: parsed.data.projectedCatchDate
          ? new Date(parsed.data.projectedCatchDate)
          : null,
        actualCatchDate: parsed.data.actualCatchDate ? new Date(parsed.data.actualCatchDate) : null,
        processingPlant: parsed.data.processingPlant,
        birdType: parsed.data.birdType,
        sex: parsed.data.sex,
        initialBirdCount: totalPlaced > 0 ? totalPlaced : 1,
        flockStatus: parsed.data.flockStatus,
        targetMarketAge: parsed.data.targetMarketAge,
        targetMarketWeight: parsed.data.targetMarketWeight,
        litterConditionAtPlacement: parsed.data.litterConditionAtPlacement,
        notes: parsed.data.notes,
        houseFlocks: {
          create: housePlacements.map((hp) => ({
            houseId: hp.houseId,
            placedBirdCount: hp.placedBirdCount,
            processingPlant: hp.processingPlant,
          })),
        },
      },
    });
  } catch {
    return { error: "Could not create flock. Try again." };
  }

  revalidatePath(`/farms/${farmId}`);
  redirect(`/farms/${farmId}`);
}

export async function completeFlockAction(flockId: string) {
  const user = await requireUser();
  const flock = await prisma.flock.findFirst({
    where: { id: flockId, farm: { userId: user.id!, deletedAt: null } },
  });
  if (!flock) throw new Error("Flock not found");

  await prisma.flock.update({
    where: { id: flockId },
    data: {
      flockStatus: "COMPLETED",
      actualCatchDate: flock.actualCatchDate ?? new Date(),
    },
  });
  revalidatePath(`/farms/${flock.farmId}`);
  revalidatePath(`/history/${flock.farmId}`);
}

export async function reactivateFlockAction(flockId: string) {
  const user = await requireUser();
  const flock = await prisma.flock.findFirst({
    where: { id: flockId, farm: { userId: user.id!, deletedAt: null } },
  });
  if (!flock) return { error: "Flock not found" };
  if (flock.flockStatus === "ACTIVE") return { error: "Flock is already active" };

  const houseIds = (
    await prisma.houseFlock.findMany({
      where: { flockId },
      select: { houseId: true },
    })
  ).map((h) => h.houseId);

  if (houseIds.length > 0) {
    const overlap = await prisma.houseFlock.findFirst({
      where: {
        houseId: { in: houseIds },
        flock: {
          farmId: flock.farmId,
          flockStatus: "ACTIVE",
          deletedAt: null,
          id: { not: flockId },
        },
      },
      include: {
        house: { select: { houseNumber: true } },
        flock: { select: { flockNumber: true } },
      },
    });
    if (overlap) {
      return {
        error: `House ${overlap.house.houseNumber} is already on active flock ${overlap.flock.flockNumber}. Complete that flock first.`,
      };
    }
  }

  await prisma.flock.update({
    where: { id: flockId },
    data: {
      flockStatus: "ACTIVE",
      // Clear auto-set catch date from completion so projections resume normally
      actualCatchDate: null,
    },
  });
  revalidatePath(`/farms/${flock.farmId}`);
  revalidatePath(`/history/${flock.farmId}`);
  revalidatePath("/");
  return { success: true };
}

export async function deleteFlockAction(flockId: string) {
  const user = await requireUser();
  const flock = await prisma.flock.findFirst({
    where: { id: flockId, deletedAt: null, farm: { userId: user.id!, deletedAt: null } },
  });
  if (!flock) return { error: "Flock not found" };
  if (flock.flockStatus === "ACTIVE") {
    return { error: "Complete the active flock before deleting it" };
  }

  await prisma.flock.update({
    where: { id: flockId },
    data: { deletedAt: new Date() },
  });
  revalidatePath(`/farms/${flock.farmId}`);
  revalidatePath(`/history/${flock.farmId}`);
  revalidatePath("/");
  return { success: true };
}

export async function updateFlockNumberAction(flockId: string, flockNumber: string) {
  const user = await requireUser();
  const flock = await prisma.flock.findFirst({
    where: { id: flockId, deletedAt: null, farm: { userId: user.id!, deletedAt: null } },
  });
  if (!flock) return { error: "Flock not found" };
  const next = flockNumber.trim();
  if (!next) return { error: "Flock number is required" };

  await prisma.flock.update({
    where: { id: flockId },
    data: { flockNumber: next },
  });
  revalidatePath(`/farms/${flock.farmId}`);
  revalidatePath(`/history/${flock.farmId}`);
  revalidatePath("/");
  return { success: true };
}

export async function updateFlockScheduleAction(flockId: string, formData: FormData) {
  const user = await requireUser();
  const flock = await prisma.flock.findFirst({
    where: { id: flockId, farm: { userId: user.id!, deletedAt: null } },
  });
  if (!flock) throw new Error("Flock not found");

  const placementDate = String(formData.get("placementDate") ?? "");
  const projectedCatchDate = emptyToNull(formData.get("projectedCatchDate"));
  const targetMarketAgeRaw = emptyToNull(formData.get("targetMarketAge"));
  const targetMarketAge = targetMarketAgeRaw ? Number(targetMarketAgeRaw) : null;

  if (!placementDate) throw new Error("Placement date is required");

  await prisma.flock.update({
    where: { id: flockId },
    data: {
      placementDate: new Date(placementDate),
      projectedCatchDate: projectedCatchDate ? new Date(projectedCatchDate) : null,
      targetMarketAge:
        targetMarketAge != null && Number.isFinite(targetMarketAge) ? targetMarketAge : null,
    },
  });

  revalidatePath(`/farms/${flock.farmId}`);
  revalidatePath("/");
}

export async function updateFlockWeightProjectionAction(flockId: string, formData: FormData) {
  const user = await requireUser();
  const flock = await prisma.flock.findFirst({
    where: { id: flockId, farm: { userId: user.id!, deletedAt: null } },
  });
  if (!flock) return { error: "Flock not found" };

  const growthRateRaw = emptyToNull(formData.get("growthRateLbsPerDay"));
  const growthRateLbsPerDay = growthRateRaw != null ? Number(growthRateRaw) : null;

  if (
    growthRateLbsPerDay == null ||
    !Number.isFinite(growthRateLbsPerDay) ||
    growthRateLbsPerDay < 0
  ) {
    return { error: "Enter a valid growth rate (lb/day)" };
  }

  try {
    await prisma.flock.update({
      where: { id: flockId },
      data: { growthRateLbsPerDay },
    });
  } catch (e) {
    console.error(e);
    return { error: "Could not save growth rate. Try refreshing the page." };
  }

  revalidatePath(`/farms/${flock.farmId}`);
  return { success: true };
}
