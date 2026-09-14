import { format } from "date-fns";
import { asDateRequired } from "@/lib/offline/dates";
import type { OfflineSnapshot, OfflineVisit } from "@/lib/offline/types";

export type VisitListRow = {
  id: string;
  visitDate: string;
  visitType: string;
  birdAgeInDays: number | null;
  generalBirdCondition: string | null;
  followUpRequired: boolean;
  followUpDate: string | null;
  notes: string | null;
};

export type VisitsPageModel = {
  farmId: string;
  farmName: string;
  activeFlockId: string | null;
  activePlacementDate: string | null;
  visits: VisitListRow[];
};

function mapVisit(row: OfflineVisit): VisitListRow {
  return {
    id: row.id,
    visitDate: row.visitDate.slice(0, 10),
    visitType: row.visitType,
    birdAgeInDays: row.birdAgeInDays,
    generalBirdCondition: row.generalBirdCondition,
    followUpRequired: row.followUpRequired,
    followUpDate: row.followUpDate ? row.followUpDate.slice(0, 10) : null,
    notes: row.notes,
  };
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
    .map(mapVisit);
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
  return row ? mapVisit(row) : null;
}
