export const FARM_ORDERS = ["age_desc", "age_asc", "name_asc", "name_desc"] as const;

export type FarmOrder = (typeof FARM_ORDERS)[number];

/** Settings default when nothing has been saved. */
export const DEFAULT_FARM_ORDER: FarmOrder = "age_desc";

export const FARM_ORDER_OPTIONS: { key: FarmOrder; label: string }[] = [
  { key: "age_desc", label: "Age high to low" },
  { key: "age_asc", label: "Age low to high" },
  { key: "name_asc", label: "Name A to Z" },
  { key: "name_desc", label: "Name Z to A" },
];

export function parseFarmOrder(value: string | null | undefined): FarmOrder {
  return FARM_ORDERS.includes(value as FarmOrder) ? (value as FarmOrder) : DEFAULT_FARM_ORDER;
}

type FarmOrderable = {
  farmName: string;
  isActive?: boolean;
  flockAgesDays?: number[];
  flockAges?: number[];
  flockAgeDays?: number | null;
};

function agesOf(farm: FarmOrderable): number[] {
  if (farm.flockAgesDays?.length) return farm.flockAgesDays;
  if (farm.flockAges?.length) return farm.flockAges;
  if (farm.flockAgeDays != null) return [farm.flockAgeDays];
  return [];
}

export function compareFarmsByOrder(a: FarmOrderable, b: FarmOrderable, order: FarmOrder): number {
  const nameCmp = a.farmName.localeCompare(b.farmName, undefined, { sensitivity: "base" });
  if (order === "name_asc") return nameCmp;
  if (order === "name_desc") return -nameCmp;

  const aAges = agesOf(a);
  const bAges = agesOf(b);
  if (aAges.length === 0 || bAges.length === 0) {
    if (aAges.length === 0 && bAges.length === 0) return nameCmp;
    return aAges.length === 0 ? 1 : -1;
  }

  const cmp =
    order === "age_desc" ? Math.max(...bAges) - Math.max(...aAges) : Math.min(...aAges) - Math.min(...bAges);
  return cmp || nameCmp;
}

export function sortFarmsByOrder<T extends FarmOrderable>(farms: T[], order: FarmOrder): T[] {
  const active: T[] = [];
  const inactive: T[] = [];
  for (const farm of farms) {
    if (farm.isActive === false) inactive.push(farm);
    else active.push(farm);
  }
  active.sort((a, b) => compareFarmsByOrder(a, b, order));
  inactive.sort((a, b) => compareFarmsByOrder(a, b, order));
  return [...active, ...inactive];
}
