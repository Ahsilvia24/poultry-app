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
    farmNumber: emptyToNull(formData.get("farmNumber")),
    address: emptyToNull(formData.get("address")),
    city: emptyToNull(formData.get("city")),
    state: emptyToNull(formData.get("state")),
    zipCode: emptyToNull(formData.get("zipCode")),
    phoneNumber: emptyToNull(formData.get("phoneNumber")),
    notes: emptyToNull(formData.get("notes")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid farm" };

  const farm = await prisma.farm.create({
    data: {
      userId: user.id!,
      farmName: parsed.data.farmName,
      growerName: parsed.data.growerName?.trim() || "",
      farmNumber: parsed.data.farmNumber,
      address: parsed.data.address,
      city: parsed.data.city,
      state: parsed.data.state,
      zipCode: parsed.data.zipCode,
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
    farmNumber: emptyToNull(formData.get("farmNumber")),
    address: emptyToNull(formData.get("address")),
    city: emptyToNull(formData.get("city")),
    state: emptyToNull(formData.get("state")),
    zipCode: emptyToNull(formData.get("zipCode")),
    phoneNumber: emptyToNull(formData.get("phoneNumber")),
    notes: emptyToNull(formData.get("notes")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid farm" };

  await prisma.farm.update({
    where: { id: farmId },
    data: {
      farmName: parsed.data.farmName,
      growerName: parsed.data.growerName?.trim() || "",
      farmNumber: parsed.data.farmNumber,
      address: parsed.data.address,
      city: parsed.data.city,
      state: parsed.data.state,
      zipCode: parsed.data.zipCode,
      phoneNumber: parsed.data.phoneNumber,
      notes: parsed.data.notes,
    },
  });
  revalidatePath(`/farms/${farmId}`);
  revalidatePath("/farms");
  revalidatePath("/");
}

export async function archiveFarmAction(farmId: string) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);
  await prisma.farm.update({
    where: { id: farmId },
    data: { isActive: false, deletedAt: new Date() },
  });
  revalidatePath("/farms");
  redirect("/farms");
}

export async function createHouseAction(farmId: string, formData: FormData) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);
  const parsed = houseSchema.safeParse({
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
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid house" };

  await prisma.$transaction(async (tx) => {
    await tx.house.create({ data: { farmId, ...parsed.data } });
    const count = await tx.house.count({ where: { farmId, deletedAt: null } });
    await tx.farm.update({ where: { id: farmId }, data: { numberOfHouses: count } });
  });

  revalidatePath(`/farms/${farmId}`);
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
