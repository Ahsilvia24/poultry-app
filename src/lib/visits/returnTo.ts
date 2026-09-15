export const ALL_VISITS_FROM = "all-visits";

export function visitFormHref(farmId: string, visitId?: string, fromAllVisits = false) {
  const path = visitId ? `/farms/${farmId}/visits/${visitId}` : `/farms/${farmId}/visits/new`;
  return fromAllVisits ? `${path}?from=${ALL_VISITS_FROM}` : path;
}

export function isAllVisitsReturn(search: string) {
  const raw = search.startsWith("?") ? search.slice(1) : search;
  return new URLSearchParams(raw).get("from") === ALL_VISITS_FROM;
}