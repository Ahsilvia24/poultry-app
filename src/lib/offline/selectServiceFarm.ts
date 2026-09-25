import { appToday, appTodayKey } from "@/lib/app-calendar";
import { resolveAppTimeZone } from "@/lib/app-time-zones";
import { lastLoggedGeneratorHours } from "@/lib/generator/format";
import { isManualLfoFarm } from "@/lib/lfo/manualFarm";
import {
  daysSincePlacement,
  summarizeForDate,
  weeklyMortalityByPlacement,
} from "@/lib/mortality/calculations";
import { asDate, asDateKey, localNoonFromKey } from "@/lib/offline/dates";
import { aliasIdCandidates, type IdAliases } from "@/lib/offline/remapIds";
import type { OfflineSnapshot } from "@/lib/offline/types";
import { pickPersonName } from "@/lib/person-name";
import { mondayOfWeek } from "@/lib/reports/field-log";
import type { ServiceFarmContext } from "@/lib/serviceForms/farmContext";
import { isServiceFormKind, type StoredServiceForm } from "@/lib/serviceForms/stored";
import type { AnyServiceForm, ServiceFormKind } from "@/lib/serviceForms/types";
import { isVisitPlaceFarm } from "@/lib/visits/visitPlace";

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

export type AllServiceFormRow = StoredServiceForm & { farmName: string };

export function defaultAllFormsRange(
  todayKey: string,
): { from: string; to: string } {
  const today = (todayKey ?? "").slice(0, 10);
  if (!today) return { from: "", to: "" };
  return { from: mondayOfWeek(today), to: today };
}

export function filterServiceFormsByDateRange<T extends { formDate?: string | null }>(
  rows: T[],
  from: string,
  to: string,
): T[] {
  const start = (from || "").slice(0, 10);
  const end = (to || "").slice(0, 10);
  const lo = start && end && start > end ? end : start;
  const hi = start && end && start > end ? start : end;
  return rows.filter((row) => {
    const key = (row.formDate ?? "").slice(0, 10);
    if (!key) return false;
    if (lo && key < lo) return false;
    if (hi && key > hi) return false;
    return true;
  });
}

export function selectAllServiceForms(snapshot: OfflineSnapshot): AllServiceFormRow[] {
  const farmNames = new Map(
    snapshot.farms
      .filter((farm) => !farm.deletedAt && !isVisitPlaceFarm(farm) && !isManualLfoFarm(farm))
      .map((farm) => [farm.id, farm.farmName]),
  );
  return (snapshot.serviceForms ?? [])
    .filter((row) => farmNames.has(row.farmId) && isServiceFormKind(row.formKind))
    .slice()
    .sort((a, b) => {
      const date = (b.formDate ?? "").localeCompare(a.formDate ?? "");
      if (date !== 0) return date;
      const farm = (farmNames.get(a.farmId) ?? "").localeCompare(farmNames.get(b.farmId) ?? "");
      if (farm !== 0) return farm;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .map((row) => ({
      id: row.id,
      farmId: row.farmId,
      farmName: farmNames.get(row.farmId) ?? "Farm",
      flockId: row.flockId,
      formKind: row.formKind as ServiceFormKind,
      formDate: row.formDate ?? "",
      payload: row.payload,
      visitId: row.visitId,
      createdAt: row.createdAt,
    }));
}

function toStored(row: NonNullable<OfflineSnapshot["serviceForms"]>[number]): StoredServiceForm | null {
  if (!isServiceFormKind(row.formKind)) return null;
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

export function selectStoredServiceForm(
  snapshot: OfflineSnapshot,
  farmId: string,
  opts: {
    formId?: string | null;
    visitId?: string | null;
    kind: ServiceFormKind;
    aliases?: IdAliases | null;
  },
): StoredServiceForm | null {
  const forms = snapshot.serviceForms ?? [];
  if (opts.formId) {
    const ids = aliasIdCandidates(opts.aliases, opts.formId);
    const row = forms.find((item) => item.farmId === farmId && ids.has(item.id));
    if (!row || row.formKind !== opts.kind) return null;
    return toStored(row);
  }
  if (!opts.visitId) return null;
  const visitIds = aliasIdCandidates(opts.aliases, opts.visitId);
  const row = forms
    .filter((item) => item.farmId === farmId && item.visitId && visitIds.has(item.visitId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  if (!row || row.formKind !== opts.kind) return null;
  return toStored(row);
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
      hfByHouseId.set(hf.houseId, { flock, hf });
    }
  }

  const detailHouses = houses.map((house) => {
    const matched = hfByHouseId.get(house.id) ?? null;
    const hf = matched?.hf ?? null;
    const flock = matched?.flock ?? null;
    const placeKey = asDateKey(hf?.placementDate ?? flock?.placementDate ?? null);
    const placement = placeKey ? localNoonFromKey(placeKey) : asDate(hf?.placementDate ?? flock?.placementDate ?? null);
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
      hasMortalityEntries: morts.length > 0,
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
    serviceTech: pickPersonName(snapshot.userName),
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
  query: {
    formId?: string | null;
    visitId?: string | null;
    fresh?: string | null;
    aliases?: IdAliases | null;
  },
) {
  const context = selectServiceFarmContext(snapshot, farmId);
  if (!context) return null;
  const existing = selectStoredServiceForm(snapshot, farmId, {
    kind,
    formId: query.formId,
    visitId: query.visitId,
    aliases: query.aliases,
  });
  const askedForSaved = Boolean(query.formId || query.visitId);
  const fresh = query.fresh === "1";
  const draft =
    !existing && !fresh && !askedForSaved ? selectServiceFormDraft<T>(snapshot, farmId, kind) : null;
  return {
    context,
    existing,
    draft,
    fresh,
    missingSaved: askedForSaved && !existing,
  };
}
