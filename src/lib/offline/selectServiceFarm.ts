import { appToday, appTodayKey } from "@/lib/app-calendar";
import { resolveAppTimeZone } from "@/lib/app-time-zones";
import { lastLoggedGeneratorHours } from "@/lib/generator/format";
import {
  daysSincePlacement,
  summarizeForDate,
  weeklyMortalityByPlacement,
} from "@/lib/mortality/calculations";
import { asDate } from "@/lib/offline/dates";
import type { OfflineSnapshot } from "@/lib/offline/types";
import type { ServiceFarmContext } from "@/lib/serviceForms/farmContext";
import { isServiceFormKind, type StoredServiceForm } from "@/lib/serviceForms/stored";
import type { AnyServiceForm, ServiceFormKind } from "@/lib/serviceForms/types";

export function selectServiceFarmPicker(snapshot: OfflineSnapshot, farmId: string) {
  const farm = snapshot.farms.find((row) => row.id === farmId && !row.deletedAt);
  if (!farm) return null;
  const draftKinds = (snapshot.serviceFormDrafts ?? [])
    .filter((row) => row.farmId === farmId)
    .map((row) => row.formKind)
    .filter(isServiceFormKind);
  const completed = (snapshot.serviceForms ?? [])
    .filter((row) => row.farmId === farmId && isServiceFormKind(row.formKind))
    .slice()
    .sort((a, b) => {
      const date = (b.formDate ?? "").localeCompare(a.formDate ?? "");
      if (date !== 0) return date;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .map(
      (row): StoredServiceForm => ({
        id: row.id,
        farmId: row.farmId,
        flockId: row.flockId,
        formKind: row.formKind as ServiceFormKind,
        formDate: row.formDate ?? "",
        payload: row.payload,
        visitId: row.visitId,
        createdAt: row.createdAt,
      }),
    );
  return { farmId, draftKinds, completed };
}

export function selectStoredServiceForm(
  snapshot: OfflineSnapshot,
  farmId: string,
  opts: { formId?: string | null; visitId?: string | null; kind: ServiceFormKind },
): StoredServiceForm | null {
  const forms = snapshot.serviceForms ?? [];
  if (opts.formId) {
    const row = forms.find((item) => item.id === opts.formId && item.farmId === farmId);
    if (!row || !isServiceFormKind(row.formKind) || row.formKind !== opts.kind) return null;
    return {
      id: row.id,
      farmId: row.farmId,
      flockId: row.flockId,
      formKind: row.formKind,
      formDate: row.formDate ?? "",
      payload: row.payload,
      visitId: row.visitId,
      createdAt: row.createdAt,
    };
  }
  if (!opts.visitId) return null;
  const row = forms
    .filter((item) => item.farmId === farmId && item.visitId === opts.visitId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!row || !isServiceFormKind(row.formKind) || row.formKind !== opts.kind) return null;
  return {
    id: row.id,
    farmId: row.farmId,
    flockId: row.flockId,
    formKind: row.formKind,
    formDate: row.formDate ?? "",
    payload: row.payload,
    visitId: row.visitId,
    createdAt: row.createdAt,
  };
}

export function selectServiceFormDraft<T extends AnyServiceForm>(
  snapshot: OfflineSnapshot,
  farmId: string,
  kind: ServiceFormKind,
): T | null {
  const row = (snapshot.serviceFormDrafts ?? []).find(
    (item) => item.farmId === farmId && item.formKind === kind,
  );
  const payload = row?.payload;
  if (!payload || typeof payload !== "object") return null;
  if ((payload as { kind?: string }).kind !== kind) return null;
  return payload as T;
}

export function selectServiceFarmContext(
  snapshot: OfflineSnapshot,
  farmId: string,
): ServiceFarmContext | null {
  const farm = snapshot.farms.find((row) => row.id === farmId && !row.deletedAt);
  if (!farm) return null;

  const timeZone = resolveAppTimeZone(snapshot.settings?.appTimeZone);
  const today = appToday(undefined, timeZone);
  const todayKey = appTodayKey(undefined, timeZone);
  const houses = (snapshot.houses ?? [])
    .filter((house) => house.farmId === farmId && !house.deletedAt)
    .slice()
    .sort((a, b) => a.houseNumber - b.houseNumber);
  const activeFlocks = (snapshot.flocks ?? [])
    .filter(
      (flock) =>
        flock.farmId === farmId && flock.flockStatus !== "COMPLETED" && !flock.deletedAt,
    )
    .slice()
    .sort((a, b) => a.placementDate.localeCompare(b.placementDate));
  const activeFlock = activeFlocks[0] ?? null;

  const hfByHouseId = new Map<
    string,
    { flock: (typeof activeFlocks)[number]; hf: (typeof snapshot.houseFlocks)[number] }
  >();
  for (const flock of activeFlocks) {
    for (const hf of snapshot.houseFlocks ?? []) {
      if (hf.flockId !== flock.id) continue;
      if (!hfByHouseId.has(hf.houseId)) hfByHouseId.set(hf.houseId, { flock, hf });
    }
  }

  const detailHouses = houses.map((house) => {
    const matched = hfByHouseId.get(house.id) ?? null;
    const hf = matched?.hf ?? null;
    const flock = matched?.flock ?? null;
    const placement = asDate(hf?.placementDate ?? flock?.placementDate ?? null);
    const morts = hf
      ? (snapshot.mortalities ?? []).filter((row) => row.houseFlockId === hf.id && !row.isDraft)
      : [];
    const metrics = hf ? summarizeForDate(hf.placedBirdCount, morts, today) : null;
    const weeklyMortality = hf && placement ? weeklyMortalityByPlacement(placement, morts, today) : [];
    const loggedToday = house.loggedTemp && house.loggedTempAt === todayKey ? house.loggedTemp : null;
    return {
      houseNumber: house.houseNumber,
      ageDays: placement ? daysSincePlacement(placement, today, timeZone) : null,
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

  const generatorHours = lastLoggedGeneratorHours(
    (snapshot.generatorLogs ?? [])
      .filter((row) => row.farmId === farmId)
      .slice()
      .sort((a, b) => b.logDate.localeCompare(a.logDate)),
  );

  return {
    farmId: farm.id,
    farmName: farm.farmName,
    farmNumber: farm.farmNumber?.trim() ?? "",
    flockNumber: activeFlocks.map((flock) => flock.flockNumber).filter(Boolean).join(" · "),
    firstFlockNumber: activeFlock?.flockNumber ?? "",
    serviceTech: snapshot.userName?.trim() ?? "",
    detail: {
      farm: { farmName: farm.farmName },
      activeFlock: activeFlock ? { flockNumber: activeFlock.flockNumber } : null,
      houses: detailHouses,
    },
    generatorHours,
  };
}

export function selectServiceFormPage<T extends AnyServiceForm>(
  snapshot: OfflineSnapshot,
  farmId: string,
  kind: ServiceFormKind,
  query: { formId?: string | null; visitId?: string | null; fresh?: string | null },
) {
  const context = selectServiceFarmContext(snapshot, farmId);
  if (!context) return null;
  const existing = selectStoredServiceForm(snapshot, farmId, {
    kind,
    formId: query.formId,
    visitId: query.visitId,
  });
  const fresh = query.fresh === "1";
  const draft = !existing && !fresh ? selectServiceFormDraft<T>(snapshot, farmId, kind) : null;
  return { context, existing, draft, fresh };
}
