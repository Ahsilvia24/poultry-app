function normalizeFlockNumber(value: string): string {
  return value.trim().toUpperCase();
}

export type FlockScheduleInput = {
  id: string;
  flockNumber: string;
  placementDate: string;
  catchDate: string;
  houses: Array<{
    placementDate?: string | null;
    catchDate?: string | null;
  }>;
};

export type FarmScheduleGroup = {
  flockId: string;
  flockNumber: string;
  placementDate: string;
  catchDate: string;
};

/**
 * Houses that share a flock ID are one flock, even if they were saved as
 * separate flock rows. Schedule groups key on flock ID + place/catch dates,
 * not the internal flock record id.
 */
export function scheduleGroupsForFarm(flocks: FlockScheduleInput[]): FarmScheduleGroup[] {
  const groups = new Map<string, FarmScheduleGroup>();
  const numbersWithHouses = new Set<string>();

  for (const flock of flocks) {
    const numberKey = normalizeFlockNumber(flock.flockNumber);
    if (flock.houses.length === 0) continue;
    numbersWithHouses.add(numberKey);
    for (const house of flock.houses) {
      const placementDate = house.placementDate?.trim() || flock.placementDate;
      const catchDate = house.catchDate?.trim() || flock.catchDate;
      const key = `${numberKey}|${placementDate}|${catchDate}`;
      if (!groups.has(key)) {
        groups.set(key, {
          flockId: flock.id,
          flockNumber: flock.flockNumber.trim() || flock.flockNumber,
          placementDate,
          catchDate,
        });
      }
    }
  }

  for (const flock of flocks) {
    if (flock.houses.length > 0) continue;
    const numberKey = normalizeFlockNumber(flock.flockNumber);
    if (numbersWithHouses.has(numberKey)) continue;
    const key = `${numberKey}|${flock.placementDate}|${flock.catchDate}`;
    if (!groups.has(key)) {
      groups.set(key, {
        flockId: flock.id,
        flockNumber: flock.flockNumber.trim() || flock.flockNumber,
        placementDate: flock.placementDate,
        catchDate: flock.catchDate,
      });
      numbersWithHouses.add(numberKey);
    }
  }

  return [...groups.values()];
}

export type ScheduleRowIdentity = {
  farmId: string;
  flockNumber?: string | null;
  date: string;
  label: string;
};

/** One visit row per farm + flock ID + day + label. */
export function dedupeScheduleRows<T extends ScheduleRowIdentity>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    const key = [
      row.farmId,
      normalizeFlockNumber(row.flockNumber ?? ""),
      row.date,
      row.label,
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

export type MergeDuplicateFlockPlan = {
  keepId: string;
  absorbIds: string[];
};

/**
 * When two ACTIVE flocks on a farm share an ID, keep the one with more houses
 * and absorb the rest.
 */
export function planMergeDuplicateFlocks(
  flocks: Array<{
    id: string;
    flockNumber: string;
    houseCount: number;
    placementDate: string;
  }>,
): MergeDuplicateFlockPlan[] {
  const byNumber = new Map<string, typeof flocks>();
  for (const flock of flocks) {
    const key = normalizeFlockNumber(flock.flockNumber);
    if (!key) continue;
    const list = byNumber.get(key) ?? [];
    list.push(flock);
    byNumber.set(key, list);
  }
  const plans: MergeDuplicateFlockPlan[] = [];
  for (const list of byNumber.values()) {
    if (list.length < 2) continue;
    const ranked = [...list].sort(
      (a, b) =>
        b.houseCount - a.houseCount ||
        a.placementDate.localeCompare(b.placementDate) ||
        a.id.localeCompare(b.id),
    );
    plans.push({
      keepId: ranked[0]!.id,
      absorbIds: ranked.slice(1).map((f) => f.id),
    });
  }
  return plans;
}
