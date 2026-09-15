import { format } from "date-fns";
import { asDateRequired } from "@/lib/offline/dates";
import type { OfflineSnapshot, OfflineVisit } from "@/lib/offline/types";
import {
  FIELD_LOG_WEEKDAYS,
  formatFieldLogDayHeader,
  type FieldLogVisit,
} from "@/lib/reports/field-log";

export type VisitListRow = {
  id: string;
  farmId: string;
  farmName: string;
  visitDate: string;
  visitType: string;
  birdAgeInDays: number | null;
  generalBirdCondition: string | null;
  followUpRequired: boolean;
  followUpDate: string | null;
  notes: string | null;
  loggedAt: string;
};

export type VisitsPageModel = {
  farmId: string;
  farmName: string;
  activeFlockId: string | null;
  activePlacementDate: string | null;
  visits: VisitListRow[];
};

function farmNameById(snapshot: OfflineSnapshot) {
  return new Map(
    (snapshot.farms ?? []).filter((farm) => !farm.deletedAt).map((farm) => [farm.id, farm.farmName]),
  );
}

function visitLoggedAt(row: OfflineVisit) {
  return row.loggedAt ?? `${row.visitDate.slice(0, 10)}T12:00:00.000Z`;
}

function mapVisit(row: OfflineVisit, farmName: string): VisitListRow {
  return {
    id: row.id,
    farmId: row.farmId,
    farmName,
    visitDate: row.visitDate.slice(0, 10),
    visitType: row.visitType,
    birdAgeInDays: row.birdAgeInDays,
    generalBirdCondition: row.generalBirdCondition,
    followUpRequired: row.followUpRequired,
    followUpDate: row.followUpDate ? row.followUpDate.slice(0, 10) : null,
    notes: row.notes,
    loggedAt: visitLoggedAt(row),
  };
}

/** Same replica visits the Field Log grid builds from. */
export function replicaVisitsForFieldLog(snapshot: OfflineSnapshot): FieldLogVisit[] {
  const names = farmNameById(snapshot);
  return (snapshot.visits ?? []).map((visit) => ({
    id: visit.id,
    farmName: names.get(visit.farmId) ?? "Farm",
    visitType: visit.visitType,
    visitDate: visit.visitDate.slice(0, 10),
    loggedAt: visitLoggedAt(visit),
    notes: visit.notes,
  }));
}

export type AllVisitsDay = {
  dateKey: string;
  label: string;
  visits: VisitListRow[];
};

export type AllVisitsPageModel = {
  days: AllVisitsDay[];
};

function weekdayLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
  return FIELD_LOG_WEEKDAYS[(dt.getUTCDay() + 6) % 7];
}

export function selectAllVisits(snapshot: OfflineSnapshot): AllVisitsPageModel {
  const names = farmNameById(snapshot);
  const byDate = new Map<string, VisitListRow[]>();
  for (const row of snapshot.visits ?? []) {
    const mapped = mapVisit(row, names.get(row.farmId) ?? "Farm");
    const list = byDate.get(mapped.visitDate) ?? [];
    list.push(mapped);
    byDate.set(mapped.visitDate, list);
  }
  const days = [...byDate.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([dateKey, visits]) => ({
      dateKey,
      label: `${weekdayLabel(dateKey)} · ${formatFieldLogDayHeader(dateKey)}`,
      visits: visits
        .slice()
        .sort((a, b) => a.loggedAt.localeCompare(b.loggedAt) || a.id.localeCompare(b.id)),
    }));
  return { days };
}

function activeFlockForFarm(snapshot: OfflineSnapshot, farmId: string) {
  return (
    (snapshot.flocks ?? [])
      .filter((flock) => flock.farmId === farmId && flock.flockStatus === "ACTIVE" && !flock.deletedAt)
      .slice()
      .sort(
        (a, b) =>
          asDateRequired(a.placementDate).getTime() - asDateRequired(b.placementDate).getTime(),
      )[0] ?? null
  );
}

export function selectVisits(snapshot: OfflineSnapshot, farmId: string): VisitsPageModel | null {
  const farm = snapshot.farms.find((row) => row.id === farmId && !row.deletedAt);
  if (!farm) return null;
  const activeFlock = activeFlockForFarm(snapshot, farmId);
  const visits = (snapshot.visits ?? [])
    .filter((row) => row.farmId === farmId)
    .slice()
    .sort((a, b) => {
      const date = b.visitDate.slice(0, 10).localeCompare(a.visitDate.slice(0, 10));
      if (date !== 0) return date;
      return b.id.localeCompare(a.id);
    })
    .map((row) => mapVisit(row, farm.farmName));
  return {
    farmId: farm.id,
    farmName: farm.farmName,
    activeFlockId: activeFlock?.id ?? null,
    activePlacementDate: activeFlock
      ? format(asDateRequired(activeFlock.placementDate), "yyyy-MM-dd")
      : null,
    visits,
  };
}

export function selectVisit(
  snapshot: OfflineSnapshot,
  farmId: string,
  visitId: string,
): VisitListRow | null {
  const row = (snapshot.visits ?? []).find((visit) => visit.id === visitId && visit.farmId === farmId);
  if (!row) return null;
  const farm = snapshot.farms.find((item) => item.id === farmId);
  return mapVisit(row, farm?.farmName ?? "Farm");
}
