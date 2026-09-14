import { completionKey } from "@/lib/visits/schedule";
import type { OfflineFollowUpCompletion } from "@/lib/offline/types";

export function normalizeScheduleLabel(label: string) {
  return label === "Weight Projection" ? "Weight Proj." : label;
}

export function labelsMatch(a: string, b: string) {
  return normalizeScheduleLabel(a) === normalizeScheduleLabel(b);
}

export function completionRowKey(farmId: string, date: string, label: string) {
  return `${farmId}|${date}|${normalizeScheduleLabel(label)}`;
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
    });
  };
  for (const row of stored ?? []) add(row);
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
  },
): OfflineFollowUpCompletion[] {
  const label = normalizeScheduleLabel(input.label);
  const current = stored ?? [];
  const sameVisit = (row: OfflineFollowUpCompletion) => {
    if (row.farmId !== input.farmId || !labelsMatch(row.label, label)) return false;
    if (row.date === input.date) return true;
    if (input.flockId && row.flockId && row.flockId === input.flockId) return true;
    return false;
  };
  const kept = current.filter((row) => !sameVisit(row));
  if (!input.completed) return kept;
  return [
    ...kept,
    {
      farmId: input.farmId,
      flockId: input.flockId ?? null,
      date: input.date,
      label,
      completedAt: input.completedAt ?? new Date().toISOString(),
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
): Map<string, { completedAt: Date }> {
  const farmRows = completions.filter((row) => row.farmId === farmId);
  const used = new Set<string>();
  const map = new Map<string, { completedAt: Date }>();

  const take = (row: OfflineFollowUpCompletion, dateKey: string, label: string) => {
    const id = completionRowKey(row.farmId, row.date, row.label);
    if (used.has(id)) return;
    used.add(id);
    map.set(completionKey(dateKey, normalizeScheduleLabel(label)), {
      completedAt: new Date(row.completedAt),
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
