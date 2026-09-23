import type { OfflineSnapshot } from "@/lib/offline/types";

/** v2 replica has the farm graph. v1 snapshots only had farm/flock lists. */
export function snapshotHasFarmGraph(
  snapshot: OfflineSnapshot | null | undefined,
): snapshot is OfflineSnapshot {
  return Boolean(
    snapshot &&
      Array.isArray(snapshot.houses) &&
      Array.isArray(snapshot.flocks) &&
      Array.isArray(snapshot.houseFlocks),
  );
}

function listLength(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

/**
 * True when this phone has no saved farm work yet.
 * A v2 replica with deleted farms is not blank — delete-all must not re-seed.
 */
export function phoneReplicaIsBlank(snapshot: OfflineSnapshot | null | undefined) {
  if (!snapshot) return true;
  if (listLength(snapshot.farms) > 0) return false;
  if (!snapshotHasFarmGraph(snapshot)) return true;
  return (
    listLength(snapshot.houses) === 0 &&
    listLength(snapshot.flocks) === 0 &&
    listLength(snapshot.houseFlocks) === 0 &&
    listLength(snapshot.mortalities) === 0 &&
    listLength(snapshot.visits) === 0 &&
    listLength(snapshot.issues) === 0 &&
    listLength(snapshot.litterEvents) === 0 &&
    listLength(snapshot.feedDeliveries) === 0 &&
    listLength(snapshot.lfos) === 0 &&
    listLength(snapshot.lfoInventories) === 0 &&
    listLength(snapshot.generatorLogs) === 0 &&
    listLength(snapshot.serviceFormDrafts) === 0 &&
    listLength(snapshot.serviceForms) === 0 &&
    listLength(snapshot.followUpCompletions) === 0 &&
    !snapshot.settings &&
    !snapshot.dashboard
  );
}

export function replicaPath(href: string): { pathname: string; search: string } {
  const url = new URL(href, "https://poultrytech.local");
  return { pathname: url.pathname, search: url.search };
}

/** Keep an in-app href until path and query both land, so `?formId=` is not dropped offline. */
export function replicaHrefsMatch(left: string, right: string) {
  const a = replicaPath(left);
  const b = replicaPath(right);
  return a.pathname === b.pathname && a.search === b.search;
}

export function isReplicaHref(href: string): boolean {
  const { pathname } = replicaPath(href);
  if (
    pathname === "/" ||
    pathname === "/farms" ||
    pathname === "/farms/new" ||
    pathname === "/settings" ||
    pathname === "/lfo" ||
    pathname === "/lfo/new" ||
    pathname === "/tools" ||
    pathname === "/reports" ||
    pathname === "/history" ||
    pathname === "/visits" ||
    pathname === "/visits/other/new" ||
    pathname === "/service/forms" ||
    pathname === "/mortality"
  ) {
    return true;
  }
  if (pathname.startsWith("/lfo/new/")) return true;
  if (/^\/history\/[^/]+$/.test(pathname)) return true;
  const lfoEdit = /^\/lfo\/([^/]+)$/.exec(pathname);
  if (lfoEdit && lfoEdit[1] !== "new") return true;
  const farm = /^\/farms\/([^/]+)(?:\/service(?:\/(report|placement|prebrood))?)?$/.exec(
    pathname,
  );
  if (farm && farm[1] !== "new") return true;
  const farmLogs =
    /^\/farms\/([^/]+)\/(visits|generators|issues|litter|feed)(?:\/([^/]+))?$/.exec(pathname);
  return Boolean(farmLogs && farmLogs[1] !== "new");
}
