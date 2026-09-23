import { completionKey } from "@/lib/visits/schedule";
import type { OfflineFollowUpCompletion, OfflineSnapshot } from "@/lib/offline/types";

export function normalizeScheduleLabel(label: string) {
  return label === "Weight Projection" ? "Weight Proj." : label;
}

export function labelsMatch(a: string, b: string) {
  return normalizeScheduleLabel(a) === normalizeScheduleLabel(b);
}

export function completionRowKey(farmId: string, date: string, label: string) {
  return `${farmId}|${date}|${normalizeScheduleLabel(label)}`;
}

/** One checkbox per farm + visit + flock + day. */
export function rememberScheduleCheckKey(item: {
  farmId: string;
  label: string;
  date?: string;
  flockId?: string | null;
  flockNumber?: string | null;
}) {
  return `${item.farmId}|${normalizeScheduleLabel(item.label)}|${item.flockId ?? item.flockNumber ?? ""}|${item.date ?? ""}`;
}

/** Keep a check visible while a later snapshot still says it is open. */
export function applyIncomingScheduleChecks(
  prev: Record<string, boolean>,
  items: Array<{
    farmId: string;
    label: string;
    date?: string;
    flockId?: string | null;
    flockNumber?: string | null;
    completed: boolean;
  }>,
  userCleared: Set<string>,
): Record<string, boolean> {
  const next = { ...prev };
  for (const item of items) {
    const key = rememberScheduleCheckKey(item);
    if (item.completed && !userCleared.has(key)) next[key] = true;
    if (!item.completed && userCleared.has(key)) {
      next[key] = false;
      userCleared.delete(key);
    }
  }
  return next;
}

export type ScheduleBindItem = {
  dateKey: string;
  label: string;
  flockId?: string | null;
};

/** Merge stored checkoffs with completed flags still sitting on a frozen dashboard list. */
export function gatherFollowUpCompletions(
  stored: OfflineFollowUpCompletion[] | null | undefined,
  dashboardRows?: Array<{
    farmId: string;
    flockId?: string | null;
    date: string;
    label: string;
    completed: boolean;
  }>,
): OfflineFollowUpCompletion[] {
  const out: OfflineFollowUpCompletion[] = [];
  const seen = new Set<string>();
  const add = (row: OfflineFollowUpCompletion) => {
    const key = completionRowKey(row.farmId, row.date, row.label);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      farmId: row.farmId,
      flockId: row.flockId ?? null,
      date: row.date,
      label: normalizeScheduleLabel(row.label),
      completedAt: row.completedAt,
      status: row.status === "DISMISSED" ? "DISMISSED" : "COMPLETED",
    });
  };
  for (const row of stored ?? []) add(row);
  // A present list — even empty after uncheck — is the phone's answer.
  // Seeding from frozen/SSR flags is what brought farms back and blocked uncheck.
  if (stored != null) return out;
  for (const row of dashboardRows ?? []) {
    if (!row.completed) continue;
    add({
      farmId: row.farmId,
      flockId: row.flockId ?? null,
      date: row.date,
      label: row.label,
      completedAt: new Date().toISOString(),
    });
  }
  return out;
}

export function upsertFollowUpCompletion(
  stored: OfflineFollowUpCompletion[] | null | undefined,
  input: {
    farmId: string;
    flockId?: string | null;
    date: string;
    label: string;
    completed: boolean;
    completedAt?: string;
    dismissed?: boolean;
  },
): OfflineFollowUpCompletion[] {
  const label = normalizeScheduleLabel(input.label);
  const current = stored ?? [];
  const exactDate = (row: OfflineFollowUpCompletion) =>
    row.farmId === input.farmId && labelsMatch(row.label, label) && row.date === input.date;
  const sameFlockLabel = (row: OfflineFollowUpCompletion) =>
    row.farmId === input.farmId &&
    labelsMatch(row.label, label) &&
    Boolean(input.flockId && row.flockId && row.flockId === input.flockId);

  const keptExact = current.filter((row) => !exactDate(row));
  if (!input.completed && !input.dismissed) {
    if (current.some(exactDate)) return keptExact;
    // Date shifted one day: clear the one leftover. Two house dates keep theirs.
    const leftovers = keptExact.filter(sameFlockLabel);
    if (leftovers.length === 1) {
      return keptExact.filter((row) => row !== leftovers[0]);
    }
    return keptExact;
  }
  return [
    ...keptExact,
    {
      farmId: input.farmId,
      flockId: input.flockId ?? null,
      date: input.date,
      label,
      completedAt: input.completedAt ?? new Date().toISOString(),
      status: input.dismissed ? "DISMISSED" : "COMPLETED",
    },
  ];
}

/**
 * Map stored checkoffs onto the live schedule. Exact date+label first, then
 * the same flock + label, then a unique label on that farm (covers a 1-day
 * rebuild shift after flock edits).
 */
export function bindCompletionsToSchedule(
  items: ScheduleBindItem[],
  completions: OfflineFollowUpCompletion[],
  farmId: string,
): Map<string, { completedAt: Date; dismissed?: boolean }> {
  const farmRows = completions.filter((row) => row.farmId === farmId);
  const used = new Set<string>();
  const map = new Map<string, { completedAt: Date; dismissed?: boolean }>();

  const take = (row: OfflineFollowUpCompletion, dateKey: string, label: string) => {
    const id = completionRowKey(row.farmId, row.date, row.label);
    if (used.has(id)) return;
    used.add(id);
    map.set(completionKey(dateKey, normalizeScheduleLabel(label)), {
      completedAt: new Date(row.completedAt),
      dismissed: row.status === "DISMISSED",
    });
  };

  for (const item of items) {
    const exact = farmRows.find(
      (row) => row.date === item.dateKey && labelsMatch(row.label, item.label),
    );
    if (exact) take(exact, item.dateKey, item.label);
  }

  for (const item of items) {
    if (map.has(completionKey(item.dateKey, normalizeScheduleLabel(item.label)))) continue;
    if (!item.flockId) continue;
    const matches = farmRows.filter(
      (row) =>
        !used.has(completionRowKey(row.farmId, row.date, row.label)) &&
        row.flockId === item.flockId &&
        labelsMatch(row.label, item.label),
    );
    if (matches.length === 1) take(matches[0]!, item.dateKey, item.label);
  }

  for (const item of items) {
    if (map.has(completionKey(item.dateKey, normalizeScheduleLabel(item.label)))) continue;
    const open = farmRows.filter(
      (row) =>
        !used.has(completionRowKey(row.farmId, row.date, row.label)) &&
        labelsMatch(row.label, item.label),
    );
    const itemsWithLabel = items.filter((row) => labelsMatch(row.label, item.label));
    if (open.length === 1 && itemsWithLabel.length === 1) {
      take(open[0]!, item.dateKey, item.label);
    }
  }

  return map;
}

/** Keep local checkoffs when a remote snapshot lands. Seed flags only if none stored. */
export function seedAndMergeFollowUpCompletions(
  snapshot: OfflineSnapshot,
  previous?: OfflineSnapshot | null,
): OfflineSnapshot {
  const hasStored =
    previous?.followUpCompletions != null || snapshot.followUpCompletions != null;
  const stored = hasStored
    ? [...(previous?.followUpCompletions ?? []), ...(snapshot.followUpCompletions ?? [])]
    : undefined;
  return {
    ...snapshot,
    followUpCompletions: gatherFollowUpCompletions(
      stored,
      stored == null
        ? [
            ...(previous?.dashboard?.todaysSchedule ?? []),
            ...(previous?.dashboard?.upcomingSchedule ?? []),
            ...(snapshot.dashboard?.todaysSchedule ?? []),
            ...(snapshot.dashboard?.upcomingSchedule ?? []),
          ]
        : undefined,
    ),
  };
}
