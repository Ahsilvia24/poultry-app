"use server";

import { revalidatePath } from "next/cache";
import { assertFarmAccess, requireUser } from "@/lib/auth-helpers";
import { poundsToTons } from "@/lib/feed/calculations";
import { prisma } from "@/lib/prisma";
import {
  farmIssueSchema,
  farmVisitSchema,
  feedDeliverySchema,
  litterEventSchema,
  performanceSchema,
  settingsSchema,
} from "@/lib/validations";

function emptyToNull(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

export async function createFeedDeliveryAction(formData: FormData) {
  const user = await requireUser();
  const parsed = feedDeliverySchema.safeParse({
    flockId: emptyToNull(formData.get("flockId")),
    houseFlockId: emptyToNull(formData.get("houseFlockId")),
    deliveryDate: formData.get("deliveryDate"),
    feedType: emptyToNull(formData.get("feedType")),
    feedMill: emptyToNull(formData.get("feedMill")),
    ticketNumber: emptyToNull(formData.get("ticketNumber")),
    poundsDelivered: formData.get("poundsDelivered"),
    notes: emptyToNull(formData.get("notes")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid feed delivery" };
  if (!parsed.data.flockId && !parsed.data.houseFlockId) {
    return { error: "Select a flock or house allocation" };
  }

  let farmId: string | null = null;
  if (parsed.data.flockId) {
    const flock = await prisma.flock.findFirst({
      where: { id: parsed.data.flockId, farm: { userId: user.id! } },
    });
    if (!flock) return { error: "Access denied" };
    farmId = flock.farmId;
  } else if (parsed.data.houseFlockId) {
    const hf = await prisma.houseFlock.findFirst({
      where: { id: parsed.data.houseFlockId, flock: { farm: { userId: user.id! } } },
      include: { flock: true },
    });
    if (!hf) return { error: "Access denied" };
    farmId = hf.flock.farmId;
  }

  await prisma.feedDelivery.create({
    data: {
      flockId: parsed.data.flockId,
      houseFlockId: parsed.data.houseFlockId,
      deliveryDate: new Date(parsed.data.deliveryDate),
      feedType: parsed.data.feedType,
      feedMill: parsed.data.feedMill,
      ticketNumber: parsed.data.ticketNumber,
      poundsDelivered: parsed.data.poundsDelivered,
      tonsDelivered: poundsToTons(parsed.data.poundsDelivered),
      notes: parsed.data.notes,
    },
  });

  if (farmId) revalidatePath(`/farms/${farmId}`);
  revalidatePath("/feed");
  return { success: true };
}

export async function upsertPerformanceAction(formData: FormData) {
  const user = await requireUser();
  const parsed = performanceSchema.safeParse({
    houseFlockId: formData.get("houseFlockId"),
    marketAgeInDays: emptyToNull(formData.get("marketAgeInDays")),
    averageLiveWeight: emptyToNull(formData.get("averageLiveWeight")),
    totalLiveWeight: emptyToNull(formData.get("totalLiveWeight")),
    feedConversion: emptyToNull(formData.get("feedConversion")),
    adjustedFeedConversion: emptyToNull(formData.get("adjustedFeedConversion")),
    livabilityPercentage: emptyToNull(formData.get("livabilityPercentage")),
    mortalityPercentage: emptyToNull(formData.get("mortalityPercentage")),
    condemnationPercentage: emptyToNull(formData.get("condemnationPercentage")),
    settlementDate: emptyToNull(formData.get("settlementDate")),
    settlementNotes: emptyToNull(formData.get("settlementNotes")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid performance" };

  const hf = await prisma.houseFlock.findFirst({
    where: { id: parsed.data.houseFlockId, flock: { farm: { userId: user.id! } } },
    include: { flock: true },
  });
  if (!hf) return { error: "Access denied" };

  await prisma.flockPerformance.upsert({
    where: { houseFlockId: parsed.data.houseFlockId },
    create: {
      houseFlockId: parsed.data.houseFlockId,
      marketAgeInDays: parsed.data.marketAgeInDays,
      averageLiveWeight: parsed.data.averageLiveWeight,
      totalLiveWeight: parsed.data.totalLiveWeight,
      feedConversion: parsed.data.feedConversion,
      adjustedFeedConversion: parsed.data.adjustedFeedConversion,
      livabilityPercentage: parsed.data.livabilityPercentage,
      mortalityPercentage: parsed.data.mortalityPercentage,
      condemnationPercentage: parsed.data.condemnationPercentage,
      settlementDate: parsed.data.settlementDate ? new Date(parsed.data.settlementDate) : null,
      settlementNotes: parsed.data.settlementNotes,
    },
    update: {
      marketAgeInDays: parsed.data.marketAgeInDays,
      averageLiveWeight: parsed.data.averageLiveWeight,
      totalLiveWeight: parsed.data.totalLiveWeight,
      feedConversion: parsed.data.feedConversion,
      adjustedFeedConversion: parsed.data.adjustedFeedConversion,
      livabilityPercentage: parsed.data.livabilityPercentage,
      mortalityPercentage: parsed.data.mortalityPercentage,
      condemnationPercentage: parsed.data.condemnationPercentage,
      settlementDate: parsed.data.settlementDate ? new Date(parsed.data.settlementDate) : null,
      settlementNotes: parsed.data.settlementNotes,
    },
  });

  revalidatePath(`/farms/${hf.flock.farmId}`);
  revalidatePath(`/history/${hf.flock.farmId}`);
  return { success: true };
}

export async function createLitterEventAction(formData: FormData) {
  const user = await requireUser();
  const parsed = litterEventSchema.safeParse({
    farmId: formData.get("farmId"),
    houseId: emptyToNull(formData.get("houseId")),
    eventDate: formData.get("eventDate"),
    eventType: formData.get("eventType"),
    litterDepth: emptyToNull(formData.get("litterDepth")),
    contractor: emptyToNull(formData.get("contractor")),
    cost: emptyToNull(formData.get("cost")),
    notes: emptyToNull(formData.get("notes")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid litter event" };
  await assertFarmAccess(parsed.data.farmId, user.id!);

  await prisma.litterEvent.create({
    data: {
      farmId: parsed.data.farmId,
      houseId: parsed.data.houseId,
      eventDate: new Date(parsed.data.eventDate),
      eventType: parsed.data.eventType,
      litterDepth: parsed.data.litterDepth,
      contractor: parsed.data.contractor,
      cost: parsed.data.cost,
      notes: parsed.data.notes,
    },
  });
  revalidatePath(`/farms/${parsed.data.farmId}`);
  return { success: true };
}

export async function createVisitAction(formData: FormData) {
  const user = await requireUser();
  const parsed = farmVisitSchema.safeParse({
    farmId: formData.get("farmId"),
    flockId: emptyToNull(formData.get("flockId")),
    visitDate: formData.get("visitDate"),
    birdAgeInDays: emptyToNull(formData.get("birdAgeInDays")),
    visitType: formData.get("visitType") || "ROUTINE_SERVICE",
    generalBirdCondition: emptyToNull(formData.get("generalBirdCondition")),
    activityLevel: emptyToNull(formData.get("activityLevel")),
    uniformity: emptyToNull(formData.get("uniformity")),
    litterCondition: emptyToNull(formData.get("litterCondition")),
    waterConsumption: emptyToNull(formData.get("waterConsumption")),
    feedInventory: emptyToNull(formData.get("feedInventory")),
    temperature: emptyToNull(formData.get("temperature")),
    humidity: emptyToNull(formData.get("humidity")),
    staticPressure: emptyToNull(formData.get("staticPressure")),
    notes: emptyToNull(formData.get("notes")),
    followUpRequired: formData.get("followUpRequired") === "on",
    followUpDate: emptyToNull(formData.get("followUpDate")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid visit" };
  await assertFarmAccess(parsed.data.farmId, user.id!);

  await prisma.farmVisit.create({
    data: {
      farmId: parsed.data.farmId,
      flockId: parsed.data.flockId,
      visitDate: new Date(parsed.data.visitDate),
      birdAgeInDays: parsed.data.birdAgeInDays,
      visitType: parsed.data.visitType,
      generalBirdCondition: parsed.data.generalBirdCondition,
      activityLevel: parsed.data.activityLevel,
      uniformity: parsed.data.uniformity,
      litterCondition: parsed.data.litterCondition,
      waterConsumption: parsed.data.waterConsumption,
      feedInventory: parsed.data.feedInventory,
      temperature: parsed.data.temperature,
      humidity: parsed.data.humidity,
      staticPressure: parsed.data.staticPressure,
      notes: parsed.data.notes,
      followUpRequired: parsed.data.followUpRequired ?? false,
      followUpDate: parsed.data.followUpDate ? new Date(parsed.data.followUpDate) : null,
    },
  });
  revalidatePath(`/farms/${parsed.data.farmId}`);
  revalidatePath("/");
  return { success: true };
}

export async function createIssueAction(formData: FormData) {
  const user = await requireUser();
  const parsed = farmIssueSchema.safeParse({
    farmId: formData.get("farmId"),
    houseId: emptyToNull(formData.get("houseId")),
    flockId: emptyToNull(formData.get("flockId")),
    dateReported: formData.get("dateReported"),
    category: formData.get("category"),
    priority: formData.get("priority") || "MEDIUM",
    description: formData.get("description"),
    correctiveAction: emptyToNull(formData.get("correctiveAction")),
    assignedTo: emptyToNull(formData.get("assignedTo")),
    status: formData.get("status") || "OPEN",
    resolvedDate: emptyToNull(formData.get("resolvedDate")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid issue" };
  await assertFarmAccess(parsed.data.farmId, user.id!);

  await prisma.farmIssue.create({
    data: {
      farmId: parsed.data.farmId,
      houseId: parsed.data.houseId,
      flockId: parsed.data.flockId,
      dateReported: new Date(parsed.data.dateReported),
      category: parsed.data.category,
      priority: parsed.data.priority,
      description: parsed.data.description,
      correctiveAction: parsed.data.correctiveAction,
      assignedTo: parsed.data.assignedTo,
      status: parsed.data.status,
      resolvedDate: parsed.data.resolvedDate ? new Date(parsed.data.resolvedDate) : null,
    },
  });
  revalidatePath(`/farms/${parsed.data.farmId}`);
  revalidatePath("/");
  return { success: true };
}

export async function updateSettingsAction(formData: FormData) {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse({
    name: emptyToNull(formData.get("name")) ?? undefined,
    dailyMortalityWarningPct: formData.get("dailyMortalityWarningPct"),
    dailyMortalityCriticalPct: formData.get("dailyMortalityCriticalPct"),
    sevenDayMortalityWarningPct: formData.get("sevenDayMortalityWarningPct"),
    sevenDayMortalityCriticalPct: formData.get("sevenDayMortalityCriticalPct"),
    alertRisingThreeDays: formData.get("alertRisingThreeDays") === "on",
    missingMortalityAlertTime: formData.get("missingMortalityAlertTime") || "14:00",
    preferredUnits: formData.get("preferredUnits") || "IMPERIAL",
    defaultMarketAgeDays: formData.get("defaultMarketAgeDays"),
    notifyEmail: formData.get("notifyEmail") === "on",
    notifyInApp: formData.get("notifyInApp") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid settings" };

  if (parsed.data.name) {
    await prisma.user.update({ where: { id: user.id! }, data: { name: parsed.data.name } });
  }

  await prisma.userSettings.upsert({
    where: { userId: user.id! },
    create: {
      userId: user.id!,
      dailyMortalityWarningPct: parsed.data.dailyMortalityWarningPct,
      dailyMortalityCriticalPct: parsed.data.dailyMortalityCriticalPct,
      sevenDayMortalityWarningPct: parsed.data.sevenDayMortalityWarningPct,
      sevenDayMortalityCriticalPct: parsed.data.sevenDayMortalityCriticalPct,
      alertRisingThreeDays: parsed.data.alertRisingThreeDays,
      missingMortalityAlertTime: parsed.data.missingMortalityAlertTime,
      preferredUnits: parsed.data.preferredUnits,
      defaultMarketAgeDays: parsed.data.defaultMarketAgeDays,
      notifyEmail: parsed.data.notifyEmail,
      notifyInApp: parsed.data.notifyInApp,
    },
    update: {
      dailyMortalityWarningPct: parsed.data.dailyMortalityWarningPct,
      dailyMortalityCriticalPct: parsed.data.dailyMortalityCriticalPct,
      sevenDayMortalityWarningPct: parsed.data.sevenDayMortalityWarningPct,
      sevenDayMortalityCriticalPct: parsed.data.sevenDayMortalityCriticalPct,
      alertRisingThreeDays: parsed.data.alertRisingThreeDays,
      missingMortalityAlertTime: parsed.data.missingMortalityAlertTime,
      preferredUnits: parsed.data.preferredUnits,
      defaultMarketAgeDays: parsed.data.defaultMarketAgeDays,
      notifyEmail: parsed.data.notifyEmail,
      notifyInApp: parsed.data.notifyInApp,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/");
  return { success: true };
}
