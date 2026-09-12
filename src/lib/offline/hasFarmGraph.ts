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

export function isReplicaHref(href: string): boolean {
  const { pathname } = replicaPath(href);
  if (
    pathname === "/farms" ||
    pathname === "/farms/new" ||
    pathname === "/settings" ||
    pathname === "/lfo" ||
    pathname === "/lfo/new" ||
    pathname === "/tools" ||
    pathname === "/reports" ||
    pathname === "/mortality"
  ) {
    return true;
  }
  if (pathname.startsWith("/lfo/new/")) return true;
  const farm = /^\/farms\/([^/]+)(?:\/service(?:\/(report|placement|prebrood))?)?$/.exec(
    pathname,
  );
  return Boolean(farm && farm[1] !== "new");
}
