import { prisma } from "@/lib/prisma";
import {
  lastLoggedGeneratorHours,
  type GeneratorHours,
} from "@/lib/generator/format";
import {
  daysSincePlacement,
  summarizeForDate,
  weeklyMortalityByPlacement,
} from "@/lib/mortality/calculations";
import { appToday, appTodayKey } from "@/lib/app-calendar";
import { getUserTimeZone } from "@/lib/user-time-zone";
import { dateKeyFromDb } from "@/lib/visits/schedule";
import type { FarmDetailLike } from "./prefill";
import { isServiceFormKind, type StoredServiceForm } from "./stored";
import type { ServiceFormKind } from "./types";

function todayKey(timeZone?: string) {
  return appTodayKey(undefined, timeZone);
}

export type ServiceFarmContext = {
  farmId: string;
  farmName: string;
  farmNumber: string;
  flockNumber: string;
  firstFlockNumber: string;
  serviceTech: string;
  detail: FarmDetailLike;
  generatorHours: GeneratorHours;
};

function mapStored(row: {
  id: string;
  farmId: string;
  flockId: string | null;
  formKind: string;
  formDate: Date;
  payload: unknown;
  visitId: string | null;
  createdAt: Date;
}): StoredServiceForm | null {
  if (!isServiceFormKind(row.formKind)) return null;
  return {
    id: row.id,
    farmId: row.farmId,
    flockId: row.flockId,
    formKind: row.formKind,
    formDate: dateKeyFromDb(row.formDate),
    payload: row.payload,
    visitId: row.visitId,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function loadServiceFarmContext(
  farmId: string,
  userId: string,
): Promise<ServiceFarmContext | null> {
  const timeZone = await getUserTimeZone(userId);
  const today = appToday(undefined, timeZone);
  const farm = await prisma.farm.findFirst({
    where: { id: farmId, userId, deletedAt: null },
    include: {
      user: { select: { name: true } },
      houses: { where: { deletedAt: null }, orderBy: { houseNumber: "asc" } },
      flocks: {
        where: { deletedAt: null, flockStatus: "ACTIVE" },
        orderBy: { placementDate: "asc" },
        include: {
          houseFlocks: {
            include: {
              mortalities: { where: { isDraft: false }, orderBy: { mortalityDate: "asc" } },
            },
          },
        },
      },
      generatorLogs: { orderBy: [{ logDate: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!farm) return null;

  const activeFlocks = farm.flocks;
  const activeFlock = activeFlocks[0] ?? null;
  const hfByHouseId = new Map<
    string,
    { flock: (typeof activeFlocks)[number]; hf: (typeof activeFlocks)[number]["houseFlocks"][number] }
  >();
  for (const flock of activeFlocks) {
    for (const hf of flock.houseFlocks) {
      if (!hfByHouseId.has(hf.houseId)) hfByHouseId.set(hf.houseId, { flock, hf });
    }
  }

  const houses = farm.houses.map((house) => {
    const matched = hfByHouseId.get(house.id) ?? null;
    const hf = matched?.hf ?? null;
    const flock = matched?.flock ?? null;
    const placementDate = hf?.placementDate ?? flock?.placementDate ?? null;
    const metrics = hf ? summarizeForDate(hf.placedBirdCount, hf.mortalities, today) : null;
    const weeklyMortality =
      hf && placementDate
        ? weeklyMortalityByPlacement(placementDate, hf.mortalities, today)
        : [];
    const loggedToday =
      house.loggedTemp && house.loggedTempAt === todayKey(timeZone) ? house.loggedTemp : null;
    return {
      houseNumber: house.houseNumber,
      ageDays: placementDate ? daysSincePlacement(placementDate, today, timeZone) : null,
      placedBirdCount: hf?.placedBirdCount ?? null,
      cumulativeMortality: metrics?.cumulative ?? 0,
      weeklyMortality,
      squareFootage: house.squareFootage,
      totalFanCFM: house.totalFanCFM,
      totalPowerCFM: house.totalPowerCFM,
      numberOfFans: house.numberOfFans,
      loggedTemp: loggedToday,
    };
  });

  const flockNumber = activeFlocks.map((f) => f.flockNumber).filter(Boolean).join(" · ");
  const firstFlockNumber = activeFlock?.flockNumber ?? "";

  return {
    farmId: farm.id,
    farmName: farm.farmName,
    farmNumber: farm.farmNumber?.trim() ?? "",
    flockNumber,
    firstFlockNumber,
    serviceTech: farm.user.name?.trim() ?? "",
    detail: {
      farm: { farmName: farm.farmName },
      activeFlock: activeFlock ? { flockNumber: activeFlock.flockNumber } : null,
      houses,
    },
    generatorHours: lastLoggedGeneratorHours(farm.generatorLogs),
  };
}

export async function listStoredServiceForms(
  farmId: string,
  userId?: string,
): Promise<StoredServiceForm[]> {
  const rows = await prisma.serviceForm.findMany({
    where: {
      farmId,
      ...(userId ? { farm: { userId, deletedAt: null } } : {}),
    },
    orderBy: [{ formDate: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(mapStored).filter((row): row is StoredServiceForm => row != null);
}

export async function listServiceFormDraftKinds(
  farmId: string,
  userId?: string,
): Promise<ServiceFormKind[]> {
  const rows = await prisma.serviceFormDraft.findMany({
    where: {
      farmId,
      ...(userId ? { farm: { userId, deletedAt: null } } : {}),
    },
    select: { formKind: true },
  });
  return rows.map((r) => r.formKind).filter(isServiceFormKind);
}

export async function getStoredServiceForm(
  farmId: string,
  opts: { formId?: string | null; visitId?: string | null; kind: ServiceFormKind },
): Promise<StoredServiceForm | null> {
  if (opts.formId) {
    const row = await prisma.serviceForm.findFirst({
      where: { id: opts.formId, farmId },
    });
    const mapped = row ? mapStored(row) : null;
    return mapped?.formKind === opts.kind ? mapped : null;
  }
  if (!opts.visitId) return null;
  const visit = await prisma.farmVisit.findFirst({
    where: { id: opts.visitId, farmId },
    select: { id: true },
  });
  if (!visit) return null;
  const row = await prisma.serviceForm.findFirst({
    where: { farmId, visitId: opts.visitId },
    orderBy: { createdAt: "desc" },
  });
  const mapped = row ? mapStored(row) : null;
  return mapped?.formKind === opts.kind ? mapped : null;
}

export async function getServiceFormDraftPayload(
  farmId: string,
  formKind: ServiceFormKind,
): Promise<unknown | null> {
  const row = await prisma.serviceFormDraft.findUnique({
    where: { farmId_formKind: { farmId, formKind } },
  });
  return row?.payload ?? null;
}
