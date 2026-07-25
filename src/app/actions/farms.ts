"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertFarmAccess, requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { farmSchema, flockSchema, houseSchema } from "@/lib/validations";

function emptyToNull(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

export async function createFarmAction(formData: FormData) {
  const user = await requireUser();
  const parsed = farmSchema.safeParse({
    farmName: formData.get("farmName"),
    growerName: emptyToNull(formData.get("growerName")),
    phoneNumber: emptyToNull(formData.get("phoneNumber")),
    notes: emptyToNull(formData.get("notes")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid farm" };

  const farm = await prisma.farm.create({
    data: {
      userId: user.id!,
      farmName: parsed.data.farmName,
      growerName: parsed.data.growerName?.trim() || "",
      phoneNumber: parsed.data.phoneNumber,
      notes: parsed.data.notes,
    },
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
      notes: parsed.data.notes,
    },
  });
  revalidatePath(`/farms/${farmId}`);
  revalidatePath("/farms");
  revalidatePath("/");
}

export async function deactivateFarmAction(farmId: string) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);
  await prisma.farm.update({
    where: { id: farmId },
    data: { isActive: false, deletedAt: null },
  });
  revalidatePath("/farms");
  revalidatePath(`/farms/${farmId}`);
  revalidatePath("/");
  redirect("/farms?status=inactive");
}

export async function deleteFarmAction(farmId: string) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);
  await prisma.farm.update({
    where: { id: farmId },
    data: { isActive: false, deletedAt: new Date() },
  });
  revalidatePath("/farms");
  revalidatePath("/");
  redirect("/farms");
}

/** @deprecated Use deleteFarmAction */
export async function archiveFarmAction(farmId: string) {
  return deleteFarmAction(farmId);
}

function parseHouseForm(formData: FormData) {
  return houseSchema.safeParse({
    houseNumber: formData.get("houseNumber"),
    squareFootage: formData.get("squareFootage"),
    houseLength: emptyToNull(formData.get("houseLength")),
    houseWidth: emptyToNull(formData.get("houseWidth")),
    totalFanCFM: emptyToNull(formData.get("totalFanCFM")),
    numberOfFans: emptyToNull(formData.get("numberOfFans")),
    coolingPadSquareFootage: emptyToNull(formData.get("coolingPadSquareFootage")),
    feederType: emptyToNull(formData.get("feederType")),
    drinkerType: emptyToNull(formData.get("drinkerType")),
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

  await prisma.house.update({
    where: { id: houseId },
    data: parsed.data,
  });

  revalidatePath(`/farms/${farmId}`);
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
  const housePlacements = houseIds.map((houseId, i) => ({
    houseId,
    placedBirdCount: Number(placedCounts[i]),
  }));

  const parsed = flockSchema.safeParse({
    flockNumber: formData.get("flockNumber"),
    flockName: emptyToNull(formData.get("flockName")),
    placementDate: formData.get("placementDate"),
    projectedCatchDate: emptyToNull(formData.get("projectedCatchDate")),
    actualCatchDate: emptyToNull(formData.get("actualCatchDate")),
    processingPlant: emptyToNull(formData.get("processingPlant")),
    birdType: emptyToNull(formData.get("birdType")),
    sex: formData.get("sex") || "STRAIGHT_RUN",
    initialBirdCount: formData.get("initialBirdCount"),
    flockStatus: formData.get("flockStatus") || "ACTIVE",
    targetMarketAge: emptyToNull(formData.get("targetMarketAge")),
    targetMarketWeight: emptyToNull(formData.get("targetMarketWeight")),
    litterConditionAtPlacement: emptyToNull(formData.get("litterConditionAtPlacement")),
    notes: emptyToNull(formData.get("notes")),
    housePlacements,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid flock" };

  if (parsed.data.flockStatus === "ACTIVE") {
    const existing = await prisma.flock.findFirst({
      where: { farmId, flockStatus: "ACTIVE", deletedAt: null },
    });
    if (existing) {
      return { error: "Only one active flock is allowed per farm. Complete or cancel the current flock first." };
    }
  }

  const totalPlaced =
    parsed.data.housePlacements?.reduce((s, h) => s + h.placedBirdCount, 0) ??
    parsed.data.initialBirdCount;

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
      initialBirdCount: totalPlaced,
      flockStatus: parsed.data.flockStatus,
      targetMarketAge: parsed.data.targetMarketAge,
      targetMarketWeight: parsed.data.targetMarketWeight,
      litterConditionAtPlacement: parsed.data.litterConditionAtPlacement,
      notes: parsed.data.notes,
      houseFlocks: {
        create: (parsed.data.housePlacements ?? []).map((hp) => ({
          houseId: hp.houseId,
          placedBirdCount: hp.placedBirdCount,
        })),
      },
    },
  });

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
