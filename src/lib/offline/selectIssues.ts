import { asDateRequired } from "@/lib/offline/dates";
import type { OfflineIssue, OfflineSnapshot } from "@/lib/offline/types";

export type IssueListRow = {
  id: string;
  dateReported: string;
  houseId: string | null;
  category: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  description: string;
  correctiveAction: string | null;
};

export type IssuesPageModel = {
  farmId: string;
  farmName: string;
  activeFlockId: string | null;
  houses: Array<{ id: string; houseNumber: number }>;
  issues: IssueListRow[];
};

function mapIssue(row: OfflineIssue): IssueListRow {
  return {
    id: row.id,
    dateReported: row.dateReported.slice(0, 10),
    houseId: row.houseId,
    category: row.category,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assignedTo,
    description: row.description,
    correctiveAction: row.correctiveAction,
  };
}

function farmHouses(snapshot: OfflineSnapshot, farmId: string) {
  return (snapshot.houses ?? [])
    .filter((house) => house.farmId === farmId && !house.deletedAt)
    .slice()
    .sort((a, b) => a.houseNumber - b.houseNumber)
    .map((house) => ({ id: house.id, houseNumber: house.houseNumber }));
}

function activeFlockId(snapshot: OfflineSnapshot, farmId: string) {
  return (
    (snapshot.flocks ?? [])
      .filter((flock) => flock.farmId === farmId && flock.flockStatus === "ACTIVE" && !flock.deletedAt)
      .slice()
      .sort(
        (a, b) =>
          asDateRequired(a.placementDate).getTime() - asDateRequired(b.placementDate).getTime(),
      )[0]?.id ?? null
  );
}

export function selectIssues(snapshot: OfflineSnapshot, farmId: string): IssuesPageModel | null {
  const farm = snapshot.farms.find((row) => row.id === farmId && !row.deletedAt);
  if (!farm) return null;
  const issues = (snapshot.issues ?? [])
    .filter((row) => row.farmId === farmId)
    .slice()
    .sort((a, b) => {
      const date = b.dateReported.slice(0, 10).localeCompare(a.dateReported.slice(0, 10));
      if (date !== 0) return date;
      return b.id.localeCompare(a.id);
    })
    .map(mapIssue);
  return {
    farmId: farm.id,
    farmName: farm.farmName,
    activeFlockId: activeFlockId(snapshot, farmId),
    houses: farmHouses(snapshot, farmId),
    issues,
  };
}

export function selectIssue(
  snapshot: OfflineSnapshot,
  farmId: string,
  issueId: string,
): IssueListRow | null {
  const row = (snapshot.issues ?? []).find((issue) => issue.id === issueId && issue.farmId === farmId);
  return row ? mapIssue(row) : null;
}
