"use server";

import { revalidatePath } from "next/cache";
import type { Prisma, VisitType } from "@prisma/client";
import { assertFarmAccess, requireUser } from "@/lib/auth-helpers";
import { withPrebroodLoggedHours } from "@/lib/generator/format";
import { birdAgeFromPlacement } from "@/lib/mortality/calculations";
import { prisma } from "@/lib/prisma";
import { applyLiveHouseMetrics } from "@/lib/serviceForms/prefill";
import { loadServiceFarmContext } from "@/lib/serviceForms/farmContext";
import { isServiceFormKind } from "@/lib/serviceForms/stored";
import type { AnyServiceForm, ServiceFormKind } from "@/lib/serviceForms/types";
import { dateKeyFromDb, parseDateKey } from "@/lib/visits/schedule";

function visitTypeForKind(formKind: ServiceFormKind): VisitType {
  if (formKind === "placement") return "PLACEMENT";
  if (formKind === "prebrood") return "PREBROOD";
  return "ROUTINE_SERVICE";
}

function visitNotes(value?: string | null) {
  const notes = value?.trim() || "";
  return notes || null;
}

function asForm(payload: unknown): AnyServiceForm | null {
  if (!payload || typeof payload !== "object") return null;
  const kind = (payload as { kind?: string }).kind;
  if (!kind || !isServiceFormKind(kind)) return null;
  return payload as AnyServiceForm;
}

async function resolveVisitBirdAge(flockId: string | null | undefined, visitDateStr: string) {
  if (!flockId) return null;
  const flock = await prisma.flock.findFirst({
    where: { id: flockId, deletedAt: null },
    select: { placementDate: true },
  });
  if (!flock) return null;
  return birdAgeFromPlacement(flock.placementDate, parseDateKey(visitDateStr));
}

async function activeFlockId(farmId: string) {
  const flock = await prisma.flock.findFirst({
    where: { farmId, flockStatus: "ACTIVE", deletedAt: null },
    orderBy: { placementDate: "asc" },
    select: { id: true },
  });
  return flock?.id ?? null;
}

function revalidateService(farmId: string) {
  revalidatePath(`/farms/${farmId}`);
  revalidatePath(`/farms/${farmId}/service`);
  revalidatePath(`/farms/${farmId}/service/report`);
  revalidatePath(`/farms/${farmId}/service/placement`);
  revalidatePath(`/farms/${farmId}/service/prebrood`);
  revalidatePath("/");
  revalidatePath("/reports");
}

export async function saveServiceFormDraftAction(input: {
  farmId: string;
  formKind: ServiceFormKind;
  payload: unknown;
}) {
  const user = await requireUser();
  await assertFarmAccess(input.farmId, user.id!);
  if (!isServiceFormKind(input.formKind)) return { error: "Invalid checklist" };
  await prisma.serviceFormDraft.upsert({
    where: { farmId_formKind: { farmId: input.farmId, formKind: input.formKind } },
    create: {
      farmId: input.farmId,
      formKind: input.formKind,
      payload: input.payload as Prisma.InputJsonValue,
    },
    update: { payload: input.payload as Prisma.InputJsonValue },
  });
  return { success: true as const };
}

export async function deleteServiceFormDraftAction(farmId: string, formKind: ServiceFormKind) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);
  await prisma.serviceFormDraft.deleteMany({ where: { farmId, formKind } });
  revalidatePath(`/farms/${farmId}/service`);
  return { success: true as const };
}

export async function deleteServiceFormAction(farmId: string, formId: string) {
  const user = await requireUser();
  await assertFarmAccess(farmId, user.id!);
  const existing = await prisma.serviceForm.findFirst({
    where: { id: formId, farmId },
    select: { id: true, visitId: true },
  });
  if (!existing) return { error: "Checklist not found" };
  await prisma.serviceForm.delete({ where: { id: existing.id } });
  if (existing.visitId) {
    await prisma.farmVisit.deleteMany({ where: { id: existing.visitId, farmId } });
  }
  revalidateService(farmId);
  return { success: true as const };
}

async function syncLinkedVisit(input: {
  serviceFormId: string;
  farmId: string;
  formKind: ServiceFormKind;
  formDate: string;
  visitNotes?: string | null;
  linkedVisitId?: string | null;
}) {
  const notes = visitNotes(input.visitNotes);
  const visitDate = input.formDate.trim();
  if (!visitDate) throw new Error("Visit date is required");
  const visitType = visitTypeForKind(input.formKind);

  if (input.linkedVisitId) {
    const existing = await prisma.farmVisit.findFirst({
      where: { id: input.linkedVisitId, farmId: input.farmId },
    });
    if (existing) {
      await prisma.farmVisit.update({
        where: { id: existing.id },
        data: {
          visitDate: parseDateKey(visitDate),
          notes,
          birdAgeInDays: await resolveVisitBirdAge(existing.flockId, visitDate),
          loggedAt: new Date(),
        },
      });
      return existing.id;
    }
  }

  const flockId = await activeFlockId(input.farmId);
  const visit = await prisma.farmVisit.create({
    data: {
      farmId: input.farmId,
      flockId,
      visitDate: parseDateKey(visitDate),
      birdAgeInDays: await resolveVisitBirdAge(flockId, visitDate),
      visitType,
      generalBirdCondition: "Healthy",
      notes,
      loggedAt: new Date(),
    },
  });
  await prisma.serviceForm.update({
    where: { id: input.serviceFormId },
    data: { visitId: visit.id, flockId: flockId ?? undefined },
  });
  return visit.id;
}

export async function completeServiceFormAction(input: {
  farmId: string;
  form: AnyServiceForm;
  serviceFormId?: string | null;
  existingVisitId?: string | null;
}) {
  const user = await requireUser();
  await assertFarmAccess(input.farmId, user.id!);

  const context = await loadServiceFarmContext(input.farmId, user.id!);
  let form = asForm(input.form);
  if (!form) return { error: "Invalid checklist" };
  if (context) {
    form = applyLiveHouseMetrics(form, context.detail);
    if (form.kind === "prebrood") {
      form = withPrebroodLoggedHours(form, context.generatorHours);
    }
  }

  const formDate = form.date?.trim() || "";
  if (!formDate) return { error: "Visit date is required" };
  const notes = visitNotes(form.comments);
  const visitType = visitTypeForKind(form.kind);

  if (input.serviceFormId) {
    const existing = await prisma.serviceForm.findFirst({
      where: { id: input.serviceFormId, farmId: input.farmId },
    });
    if (!existing) return { error: "Service form not found" };
    await prisma.serviceForm.update({
      where: { id: existing.id },
      data: {
        formKind: form.kind,
        formDate: parseDateKey(formDate),
        payload: form as unknown as Prisma.InputJsonValue,
      },
    });
    const visitId = await syncLinkedVisit({
      serviceFormId: existing.id,
      farmId: input.farmId,
      formKind: form.kind,
      formDate,
      visitNotes: notes,
      linkedVisitId: existing.visitId,
    });
    await prisma.serviceFormDraft.deleteMany({
      where: { farmId: input.farmId, formKind: form.kind },
    });
    revalidateService(input.farmId);
    return { success: true as const, id: existing.id, visitId };
  }

  const liveVisit = input.existingVisitId
    ? await prisma.farmVisit.findFirst({
        where: { id: input.existingVisitId, farmId: input.farmId },
      })
    : null;

  let visitId: string;
  let flockId: string | null = null;
  if (liveVisit) {
    visitId = liveVisit.id;
    flockId = liveVisit.flockId;
    await prisma.farmVisit.update({
      where: { id: liveVisit.id },
      data: {
        visitDate: parseDateKey(formDate),
        visitType,
        notes,
        generalBirdCondition: liveVisit.generalBirdCondition ?? "Healthy",
        birdAgeInDays: await resolveVisitBirdAge(flockId, formDate),
        loggedAt: new Date(),
      },
    });
  } else {
    flockId = await activeFlockId(input.farmId);
    const visit = await prisma.farmVisit.create({
      data: {
        farmId: input.farmId,
        flockId,
        visitDate: parseDateKey(formDate),
        birdAgeInDays: await resolveVisitBirdAge(flockId, formDate),
        visitType,
        generalBirdCondition: "Healthy",
        notes,
        loggedAt: new Date(),
      },
    });
    visitId = visit.id;
  }

  const created = await prisma.serviceForm.create({
    data: {
      farmId: input.farmId,
      flockId,
      formKind: form.kind,
      formDate: parseDateKey(formDate),
      payload: form as unknown as Prisma.InputJsonValue,
      visitId,
    },
  });
  await prisma.serviceFormDraft.deleteMany({
    where: { farmId: input.farmId, formKind: form.kind },
  });
  revalidateService(input.farmId);
  return { success: true as const, id: created.id, visitId, formDate: dateKeyFromDb(created.formDate) };
}
