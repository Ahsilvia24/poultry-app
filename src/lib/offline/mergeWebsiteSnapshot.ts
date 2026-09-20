import { farmCountInSnapshot } from "@/lib/offline/phoneBackup";
import type {
  OfflineFollowUpCompletion,
  OfflineServiceFormDraft,
  OfflineSnapshot,
} from "@/lib/offline/types";

function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const seen = new Set(local.map((row) => row.id));
  return [...local, ...remote.filter((row) => !seen.has(row.id))];
}

function draftKey(row: OfflineServiceFormDraft) {
  return `${row.farmId}:${row.formKind}`;
}

function mergeDrafts(
  local: OfflineServiceFormDraft[] | undefined,
  remote: OfflineServiceFormDraft[] | undefined,
) {
  const have = local ?? [];
  const extra = remote ?? [];
  const seen = new Set(have.map(draftKey));
  return [...have, ...extra.filter((row) => !seen.has(draftKey(row)))];
}

function completionKey(row: OfflineFollowUpCompletion) {
  return `${row.farmId}:${row.flockId ?? ""}:${row.date}:${row.label}`;
}

function mergeCompletions(
  local: OfflineFollowUpCompletion[] | undefined,
  remote: OfflineFollowUpCompletion[] | undefined,
) {
  const have = local ?? [];
  const extra = remote ?? [];
  const seen = new Set(have.map(completionKey));
  return [...have, ...extra.filter((row) => !seen.has(completionKey(row)))];
}

/** Keep phone farms. Add website farms that are not already on this phone. */
export function mergeWebsiteSnapshot(
  local: OfflineSnapshot,
  remote: OfflineSnapshot,
): OfflineSnapshot {
  return {
    ...local,
    pulledAt: new Date().toISOString(),
    settings: local.settings ?? remote.settings,
    farms: mergeById(local.farms, remote.farms),
    houses: mergeById(local.houses, remote.houses),
    flocks: mergeById(local.flocks, remote.flocks),
    houseFlocks: mergeById(local.houseFlocks, remote.houseFlocks),
    mortalities: mergeById(local.mortalities, remote.mortalities),
    visits: mergeById(local.visits, remote.visits),
    issues: mergeById(local.issues, remote.issues),
    litterEvents: mergeById(local.litterEvents, remote.litterEvents),
    feedDeliveries: mergeById(local.feedDeliveries, remote.feedDeliveries),
    lfos: mergeById(local.lfos, remote.lfos),
    lfoInventories: mergeById(local.lfoInventories, remote.lfoInventories),
    generatorLogs: mergeById(local.generatorLogs, remote.generatorLogs),
    serviceFormDrafts: mergeDrafts(local.serviceFormDrafts, remote.serviceFormDrafts),
    serviceForms: mergeById(local.serviceForms ?? [], remote.serviceForms ?? []),
    followUpCompletions: mergeCompletions(local.followUpCompletions, remote.followUpCompletions),
    dashboard: local.dashboard ?? remote.dashboard,
  };
}

export function addedWebsiteFarmCount(
  local: OfflineSnapshot | null | undefined,
  remote: OfflineSnapshot,
) {
  if (!local) return farmCountInSnapshot(remote);
  const have = new Set(local.farms.filter((farm) => !farm.deletedAt).map((farm) => farm.id));
  return remote.farms.filter((farm) => !farm.deletedAt && !have.has(farm.id)).length;
}
