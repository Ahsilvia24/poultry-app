import { completionRowKey, upsertFollowUpCompletion } from "@/lib/offline/followUpCompletions";
import { normalizeOwnerEmail } from "@/lib/offline/ownerEmail";
import type { OfflineSnapshot } from "@/lib/offline/types";

/**
 * A schedule check is painted in the tap, then the farm copy is written a
 * moment later. Leaving the page or closing the app before that write used to
 * drop the mark. This list is saved in the tap and applied every time Today
 * and Upcoming are built.
 */
const STORAGE_KEY = "poultrytech-schedule-checks";
const MAX_AGE_MS = 21 * 24 * 60 * 60 * 1000;

export type ScheduleCheckMark = {
  email: string;
  farmId: string;
  flockId?: string | null;
  date: string;
  label: string;
  completed: boolean;
  dismissed: boolean;
  completedAt: string;
};

let memory: ScheduleCheckMark[] | null = null;

function fresh(mark: ScheduleCheckMark) {
  const at = Date.parse(mark.completedAt);
  return Number.isFinite(at) && Date.now() - at < MAX_AGE_MS;
}

function sameMark(a: ScheduleCheckMark, b: ScheduleCheckMark) {
  return (
    normalizeOwnerEmail(a.email) === normalizeOwnerEmail(b.email) &&
    completionRowKey(a.farmId, a.date, a.label) === completionRowKey(b.farmId, b.date, b.label)
  );
}

export function mergeScheduleCheckMarks(existing: ScheduleCheckMark[], mark: ScheduleCheckMark) {
  return [...existing.filter((row) => fresh(row) && !sameMark(row, mark)), mark].filter(fresh);
}

function loadMarks(): ScheduleCheckMark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScheduleCheckMark[];
    return Array.isArray(parsed) ? parsed.filter(fresh) : [];
  } catch {
    return [];
  }
}

export function readScheduleCheckMarks(): ScheduleCheckMark[] {
  if (memory) return memory;
  if (typeof window === "undefined") return [];
  memory = loadMarks();
  return memory;
}

export function recordScheduleCheck(mark: ScheduleCheckMark) {
  memory = mergeScheduleCheckMarks(memory ?? loadMarks(), mark);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    /* Private mode can refuse storage. The in-memory list still covers this visit. */
  }
}

function sameDashboardRow(
  item: { farmId: string; date: string; label: string },
  mark: ScheduleCheckMark,
) {
  return (
    item.farmId === mark.farmId &&
    completionRowKey(item.farmId, item.date, item.label) ===
      completionRowKey(mark.farmId, mark.date, mark.label)
  );
}

/** Latest tap wins over a farm copy that was saved before the check. */
export function applyScheduleCheckMarks(
  snapshot: OfflineSnapshot,
  marks: ScheduleCheckMark[],
): OfflineSnapshot {
  const email = normalizeOwnerEmail(snapshot.userEmail ?? "");
  const mine = marks.filter((mark) => {
    const who = normalizeOwnerEmail(mark.email ?? "");
    return !who || !email || who === email;
  });
  if (mine.length === 0) return snapshot;

  let followUpCompletions = snapshot.followUpCompletions;
  let dashboard = snapshot.dashboard;
  for (const mark of mine) {
    followUpCompletions = upsertFollowUpCompletion(followUpCompletions, {
      farmId: mark.farmId,
      flockId: mark.flockId,
      date: mark.date,
      label: mark.label,
      completed: mark.completed || mark.dismissed,
      dismissed: mark.dismissed,
      completedAt: mark.completedAt,
    });
    if (!dashboard) continue;
    const lists = ["todaysSchedule", "upcomingSchedule"] as const;
    const nextDashboard = { ...dashboard };
    for (const key of lists) {
      const list = nextDashboard[key];
      if (!Array.isArray(list)) continue;
      nextDashboard[key] = (
        mark.dismissed
          ? list.filter((item) => !sameDashboardRow(item, mark))
          : list.map((item) =>
              sameDashboardRow(item, mark) ? { ...item, completed: mark.completed } : item,
            )
      ) as typeof list;
    }
    dashboard = nextDashboard;
  }
  return { ...snapshot, followUpCompletions, dashboard };
}
