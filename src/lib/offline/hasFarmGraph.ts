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
