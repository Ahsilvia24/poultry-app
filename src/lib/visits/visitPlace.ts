export const VISIT_PLACE_FARM_NUMBER = "__visit_place__";
export const ENTER_OTHER_FARM_VALUE = "__enter_other__";

export function isVisitPlaceFarm(farm: { farmNumber?: string | null } | null | undefined) {
  return farm?.farmNumber === VISIT_PLACE_FARM_NUMBER;
}

export function normalizeVisitPlaceName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function findVisitPlaceFarm<T extends { farmName: string; farmNumber?: string | null; deletedAt?: string | null }>(
  farms: T[],
  placeName: string,
): T | undefined {
  const needle = normalizeVisitPlaceName(placeName).toLowerCase();
  if (!needle) return undefined;
  return farms.find(
    (farm) =>
      !farm.deletedAt &&
      isVisitPlaceFarm(farm) &&
      farm.farmName.trim().toLowerCase() === needle,
  );
}

export function visitPlaceFarmFields(placeName: string): Record<string, string> {
  return {
    farmName: normalizeVisitPlaceName(placeName),
    growerName: "",
    farmNumber: VISIT_PLACE_FARM_NUMBER,
    numberOfHouses: "0",
    notes: "",
  };
}

export function visitPlaceFormHref(placeName: string) {
  const params = new URLSearchParams({
    from: "all-visits",
    place: normalizeVisitPlaceName(placeName),
  });
  return `/visits/other/new?${params.toString()}`;
}