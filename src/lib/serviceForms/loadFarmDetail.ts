import { format } from "date-fns";
import {
  daysSincePlacement,
  summarizeForDate,
  weeklyMortalityByPlacement,
} from "@/lib/mortality/calculations";
import { prisma } from "@/lib/prisma";
import { dateKeyFromDb } from "@/lib/visits/schedule";
import type { ServiceFarmDetail } from "./prefill";

/** Load farm + house prefill shape for Service Farm checklists. */
export async function loadServiceFarmDetail(
  farmId: string,
  userId: string,
): Promise<ServiceFarmDetail | null> {
  const today = new Date();
  const todayKey = format(today, "yyyy-MM-dd");

  const farm = await prisma.farm.findFirst({
    where: { id: farmId, userId, deletedAt: null },
    include: {
      houses: { where: { deletedAt: null }, orderBy: { houseNumber: "asc" } },
      flocks: {
        where: { deletedAt: null, flockStatus: "ACTIVE" },
        orderBy: { placementDate: "asc" },
        include: {
          houseFlocks: {
            include: {
              mortalities: {
                where: { isDraft: false },
                orderBy: { mortalityDate: "asc" },
              },
            },
          },
        },
      },
    },
  });
  if (!farm) return null;

  // Midnight reset: drop yesterday's house temps (matches farm detail page).
  const staleTempIds = farm.houses
    .filter((h) => {
      if (!h.loggedTemp?.trim()) return false;
      if (!h.loggedTempAt) return true;
      return dateKeyFromDb(h.loggedTempAt) !== todayKey;
    })
    .map((h) => h.id);
  if (staleTempIds.length > 0) {
    await prisma.house.updateMany({
      where: { id: { in: staleTempIds }, farmId },
      data: { loggedTemp: null, loggedTempAt: null },
    });
    for (const h of farm.houses) {
      if (staleTempIds.includes(h.id)) {
        h.loggedTemp = null;
        h.loggedTempAt = null;
      }
    }
  }

  const activeFlocks = farm.flocks;
  const hfByHouseId = new Map<
    string,
    {
      flock: (typeof activeFlocks)[number];
      hf: (typeof activeFlocks)[number]["houseFlocks"][number];
    }
  >();
  for (const flock of activeFlocks) {
    for (const hf of flock.houseFlocks) {
      if (!hfByHouseId.has(hf.houseId)) {
        hfByHouseId.set(hf.houseId, { flock, hf });
      }
    }
  }

  const houses = farm.houses.map((house) => {
    const matched = hfByHouseId.get(house.id) ?? null;
    const hf = matched?.hf ?? null;
    const houseFlock = matched?.flock ?? null;
    const placementDate = hf?.placementDate ?? houseFlock?.placementDate ?? null;
    const metrics = hf
      ? summarizeForDate(hf.placedBirdCount, hf.mortalities, today)
      : null;
    const weeklyMortality =
      hf && placementDate
        ? weeklyMortalityByPlacement(placementDate, hf.mortalities, today)
        : [];

    return {
      houseNumber: house.houseNumber,
      ageDays: placementDate ? daysSincePlacement(placementDate, today) : null,
      placedBirdCount: hf?.placedBirdCount ?? null,
      cumulativeMortality: metrics?.cumulative ?? 0,
      weeklyMortality,
      totalFanCFM: house.totalFanCFM,
      numberOfFans: house.numberOfFans,
      loggedTemp: house.loggedTemp,
    };
  });

  const activeFlock = activeFlocks[0] ?? null;

  return {
    farm: {
      farmName: farm.farmName,
      farmNumber: farm.farmNumber,
    },
    activeFlock: activeFlock
      ? { flockNumber: activeFlock.flockNumber }
      : null,
    activeFlocks: activeFlocks.map((f) => ({ flockNumber: f.flockNumber })),
    houses,
  };
}

export type StoredServiceForm = {
  id: string;
  farmId: string;
  flockId: string | null;
  formKind: string;
  formDate: string;
  payload: unknown;
  visitId: string | null;
};

export async function getServiceFormById(
  farmId: string,
  formId: string,
): Promise<StoredServiceForm | null> {
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

export async function getServiceFormForVisit(
  farmId: string,
  visitId: string,
): Promise<StoredServiceForm | null> {
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
