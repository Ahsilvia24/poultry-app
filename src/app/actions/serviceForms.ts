"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, VisitType } from "@prisma/client";
import { assertFarmAccess, requireUser } from "@/lib/auth-helpers";
import { birdAgeFromPlacement } from "@/lib/mortality/calculations";
import { prisma } from "@/lib/prisma";
import type { AnyServiceForm, ServiceFormKind } from "@/lib/serviceForms/types";
import { dateKeyFromDb, parseDateKey } from "@/lib/visits/schedule";

function serviceFormVisitMeta(formKind: ServiceFormKind) {
  const visitType: VisitType =
    formKind === "service_report"
      ? "ROUTINE_SERVICE"
      : formKind === "placement"
        ? "PLACEMENT"
        : "PREBROOD";
  const visitLabel =
    formKind === "service_report"
      ? "Service report"
      : formKind === "placement"
        ? "Placement checklist"
        : "Prebrood checklist";
  return { visitType, visitLabel };
}

function isServiceFormKind(v: string): v is ServiceFormKind {
  return v === "service_report" || v === "placement" || v === "prebrood";
}

async function resolveActiveFlockId(farmId: string) {
  const flock = await prisma.flock.findFirst({
    where: { farmId, flockStatus: "ACTIVE", deletedAt: null },
    orderBy: { placementDate: "asc" },
    select: { id: true },
  });
  return flock?.id ?? null;
}

async function resolveVisitBirdAge(
  flockId: string | null,
  visitDateStr: string,
): Promise<number | null> {
  if (!flockId) return null;
  const flock = await prisma.flock.findFirst({
    where: { id: flockId, deletedAt: null },
    select: { placementDate: true },
  });
  if (!flock) return null;
  return birdAgeFromPlacement(flock.placementDate, parseDateKey(visitDateStr));
}

export async function updateServiceFormAction(input: {
  serviceFormId: string;
  farmId: string;
  formKind: ServiceFormKind;
  formDate: string;
  payload: AnyServiceForm;
  visitNotes?: string | null;
}) {
  const user = await requireUser();
  await assertFarmAccess(input.farmId, user.id!);

  if (!isServiceFormKind(input.formKind)) {
    return { error: "Invalid form kind" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.formDate)) {
    return { error: "Invalid form date" };
  }

  const existing = await prisma.serviceForm.findFirst({
    where: { id: input.serviceFormId, farmId: input.farmId },
  });
  if (!existing) return { error: "Service form not found" };

  await prisma.serviceForm.update({
    where: { id: existing.id },
    data: {
      formKind: input.formKind,
      formDate: parseDateKey(input.formDate),
      payload: input.payload as unknown as Prisma.InputJsonValue,
    },
  });

  if (existing.visitId) {
    const { visitLabel } = serviceFormVisitMeta(input.formKind);
    const notes = [visitLabel, input.visitNotes?.trim()].filter(Boolean).join("\n");
    const visit = await prisma.farmVisit.findFirst({
      where: { id: existing.visitId, farmId: input.farmId },
    });
    if (visit) {
      const birdAgeInDays = await resolveVisitBirdAge(
        visit.flockId,
        input.formDate,
      );
      await prisma.farmVisit.update({
        where: { id: visit.id },
        data: {
          visitDate: parseDateKey(input.formDate),
          birdAgeInDays,
          notes: notes || visitLabel,
        },
      });
    }
  }

  revalidatePath(`/farms/${input.farmId}`);
  revalidatePath(`/farms/${input.farmId}/service`);
  revalidatePath(`/farms/${input.farmId}/service/report`);
  revalidatePath(`/farms/${input.farmId}/service/placement`);
  revalidatePath(`/farms/${input.farmId}/service/prebrood`);

  return { success: true as const, id: existing.id, visitId: existing.visitId };
}

/** Persist a completed service checklist, log a visit, and optionally generator hours. */
export async function completeServiceFormAction(input: {
  farmId: string;
  formKind: ServiceFormKind;
  formDate: string;
  payload: AnyServiceForm;
  visitNotes?: string | null;
  generatorHours?: number | null;
  serviceFormId?: string | null;
  existingVisitId?: string | null;
}) {
  const user = await requireUser();
  await assertFarmAccess(input.farmId, user.id!);

  if (!isServiceFormKind(input.formKind)) {
    return { error: "Invalid form kind" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.formDate)) {
    return { error: "Invalid form date" };
  }

  if (input.serviceFormId) {
    return updateServiceFormAction({
      serviceFormId: input.serviceFormId,
      farmId: input.farmId,
      formKind: input.formKind,
      formDate: input.formDate,
      payload: input.payload,
      visitNotes: input.visitNotes,
    });
  }

  const { visitType, visitLabel } = serviceFormVisitMeta(input.formKind);
  const notes = [visitLabel, input.visitNotes?.trim()].filter(Boolean).join("\n");

  let visitId: string;
  let flockId: string | null = null;

  if (input.existingVisitId) {
    const visit = await prisma.farmVisit.findFirst({
      where: { id: input.existingVisitId, farmId: input.farmId },
    });
    if (!visit) return { error: "Visit not found" };
    visitId = visit.id;
    flockId = visit.flockId;
    const birdAgeInDays = await resolveVisitBirdAge(flockId, input.formDate);
    await prisma.farmVisit.update({
      where: { id: visitId },
      data: {
        visitDate: parseDateKey(input.formDate),
        birdAgeInDays,
        visitType,
        generalBirdCondition: visit.generalBirdCondition ?? "Healthy",
        notes: notes || visitLabel,
      },
    });
  } else {
    flockId = await resolveActiveFlockId(input.farmId);
    const birdAgeInDays = await resolveVisitBirdAge(flockId, input.formDate);
    const visit = await prisma.farmVisit.create({
      data: {
        farmId: input.farmId,
        flockId,
        visitDate: parseDateKey(input.formDate),
        birdAgeInDays,
        visitType,
        generalBirdCondition: "Healthy",
        notes: notes || visitLabel,
      },
    });
    visitId = visit.id;
  }

  if (input.generatorHours != null && Number.isFinite(input.generatorHours)) {
    const logDate = parseDateKey(input.formDate);
    const existingLog = await prisma.generatorLog.findFirst({
      where: { farmId: input.farmId, logDate },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    if (existingLog) {
      await prisma.generatorLog.update({
        where: { id: existingLog.id },
        data: { gen1Hours: input.generatorHours },
      });
    } else {
      await prisma.generatorLog.create({
        data: {
          farmId: input.farmId,
          logDate,
          gen1Hours: input.generatorHours,
        },
      });
    }
  }

  const created = await prisma.serviceForm.create({
    data: {
      farmId: input.farmId,
      flockId,
      formKind: input.formKind,
      formDate: parseDateKey(input.formDate),
      payload: input.payload as unknown as Prisma.InputJsonValue,
      visitId,
    },
  });

  revalidatePath(`/farms/${input.farmId}`);
  revalidatePath(`/farms/${input.farmId}/service`);
  revalidatePath(`/farms/${input.farmId}/service/report`);
  revalidatePath(`/farms/${input.farmId}/service/placement`);
  revalidatePath(`/farms/${input.farmId}/service/prebrood`);

  return { success: true as const, id: created.id, visitId };
}

export async function getServiceFormByIdAction(farmId: string, formId: string) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);
  const row = await prisma.serviceForm.findFirst({
    where: { id: formId, farmId },
  });
  if (!row) return null;
  return {
    id: row.id,
    farmId: row.farmId,
    flockId: row.flockId,
    formKind: row.formKind,
    formDate: dateKeyFromDb(row.formDate),
    payload: row.payload,
    visitId: row.visitId,
  };
}

export async function getServiceFormForVisitAction(farmId: string, visitId: string) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);
  const row = await prisma.serviceForm.findFirst({
    where: { visitId, farmId },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;
  return {
    id: row.id,
    farmId: row.farmId,
    flockId: row.flockId,
    formKind: row.formKind,
    formDate: dateKeyFromDb(row.formDate),
    payload: row.payload,
    visitId: row.visitId,
  };
}
