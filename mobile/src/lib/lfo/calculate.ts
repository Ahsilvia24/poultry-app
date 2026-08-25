export const DEFAULT_LFO_CONSUMPTION_RATE = 0.45;
export const FEED_OFF_HOURS_BEFORE_UP = 5;
/** Catch is 5 hours after feed up (10 hours after feed off). */
export const FEED_UP_HOURS_BEFORE_CATCH = 5;

export type LfoHouseInventoryInput = {
  houseId: string;
  houseNumber: number;
  binAPounds: number;
  binBPounds: number;
  /** ISO datetime string or Date; null if not set. */
  feedUpAt: string | Date | null;
  headCount: number;
};

export type LfoCalculateInput = {
  orderDate: string;
  /** Lbs feed per bird per day. */
  consumptionRate: number;
  now?: Date;
  houses: LfoHouseInventoryInput[];
};

export type LfoHouseCalculateResult = {
  houseId: string;
  houseNumber: number;
  headCount: number;
  inventoryPounds: number;
  feedUpAt: Date | null;
  feedOffAt: Date | null;
  hoursUntilFeedOff: number | null;
  hourlyConsumptionLbs: number;
  feedConsumedUntilOffLbs: number | null;
  balanceLbs: number | null;
  /** Unrounded order shortfall (|balance| when short). */
  rawOrderLbs: number | null;
  /** Unrounded reclaim surplus (balance when surplus). */
  rawReclaimLbs: number | null;
  orderLbs: number | null;
  reclaimLbs: number | null;
};

export type LfoCalculateResult = {
  ready: true;
  consumptionRate: number;
  houses: LfoHouseCalculateResult[];
  totalHourlyConsumptionLbs: number;
  totalFeedConsumedUntilOffLbs: number;
  totalOrderLbs: number;
  totalReclaimLbs: number;
};

function toDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function feedOffFromFeedUp(feedUpAt: Date): Date {
  return new Date(feedUpAt.getTime() - FEED_OFF_HOURS_BEFORE_UP * 60 * 60 * 1000);
}

/** Local `yyyy-MM-dd` + `HH:mm` → Date. */
export function combineDateAndTime(dateKey: string, timeHHmm: string): Date | null {
  const date = dateKey.trim();
  const time = timeHHmm.trim();
  if (!date || !time) return null;
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  if (!y || !m || !d || !Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function formatLocalDateTime(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

/** Feed up is 5 hours before catch (e.g. catch 11:00 PM → feed up 6:00 PM). */
export function feedUpFromCatch(catchDateKey: string, catchTimeHHmm: string): Date | null {
  const catchAt = combineDateAndTime(catchDateKey, catchTimeHHmm);
  if (!catchAt) return null;
  return new Date(catchAt.getTime() - FEED_UP_HOURS_BEFORE_CATCH * 60 * 60 * 1000);
}

/** Catch is 5 hours after feed up (10 hours after feed off). */
export function catchFromFeedUp(feedUpAt: Date): Date {
  return new Date(feedUpAt.getTime() + FEED_UP_HOURS_BEFORE_CATCH * 60 * 60 * 1000);
}

/** Split a local `yyyy-MM-ddTHH:mm` (or Date) into date + :00/:30 time. */
export function splitLocalDateTime(value: string | Date | null | undefined): {
  date: string;
  time: string;
} {
  if (value == null || value === "") return { date: "", time: "" };
  const formatted = value instanceof Date ? formatLocalDateTime(value) : value;
  const [date = "", timePart = ""] = formatted.split("T");
  const raw = timePart.slice(0, 5);
  if (!raw) return { date, time: "" };
  const [hStr, mStr] = raw.split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return { date, time: "" };
  const total = h * 60 + m;
  const snapped = Math.round(total / 30) * 30;
  const sh = Math.floor((snapped % (24 * 60)) / 60);
  const sm = snapped % 60;
  return {
    date,
    time: `${String(sh).padStart(2, "0")}:${String(sm).padStart(2, "0")}`,
  };
}

/** Stored feed-up datetime → catch date/time for the LFO form. */
export function catchPartsFromFeedUpAt(feedUpAt: string | Date | null | undefined): {
  date: string;
  time: string;
} {
  if (feedUpAt == null || feedUpAt === "") return { date: "", time: "" };
  const parts = splitLocalDateTime(feedUpAt);
  const feedUp = combineDateAndTime(parts.date, parts.time);
  if (!feedUp) return { date: "", time: "" };
  return splitLocalDateTime(catchFromFeedUp(feedUp));
}

export function feedUpAtFromCatch(catchDate: string, catchTime: string): string | null {
  const feedUp = feedUpFromCatch(catchDate, catchTime);
  return feedUp ? formatLocalDateTime(feedUp) : null;
}

export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (60 * 60 * 1000);
}

export function hourlyConsumptionLbs(headCount: number, consumptionRate: number): number {
  return (Math.max(0, headCount) * consumptionRate) / 24;
}

/** Round up to the next multiple of 500 (14001 → 14500; 14000 stays 14000). */
export function roundUpToNearest500(lbs: number): number {
  if (!Number.isFinite(lbs) || lbs <= 0) return 0;
  return Math.ceil(lbs / 500) * 500;
}

/** Order (excess / LFO shortfall): round up to nearest 500, then add 2000. */
export function roundOrderLbs(rawLbs: number): number {
  if (!Number.isFinite(rawLbs) || rawLbs <= 0) return 0;
  return roundUpToNearest500(rawLbs) + 2000;
}

/** Reclaim surplus: round up to nearest 500 only. */
export function roundReclaimLbs(rawLbs: number): number {
  return roundUpToNearest500(rawLbs);
}

/**
 * Last feed order calculation from bin inventory, feed-up times, and head count.
 *   balance < 0 → order = roundUp500(|balance|) + 2000
 *   balance > 0 → reclaim = roundUp500(balance)
 */
/** Per-house summary lines: "H1-4000 lbs.", "H2-5000 Rec." (one per house). */
export function formatHouseLfoSummary(
  houses: Array<{
    houseNumber: number;
    orderLbs: number | null;
    reclaimLbs: number | null;
    feedUpAt?: Date | string | null;
  }>,
): string[] {
  const parts: string[] = [];
  const sorted = [...houses].sort((a, b) => a.houseNumber - b.houseNumber);
  for (const h of sorted) {
    if (h.feedUpAt == null || h.feedUpAt === "") continue;
    const order = h.orderLbs ?? 0;
    const reclaim = h.reclaimLbs ?? 0;
    if (order > 0) {
      parts.push(`H${h.houseNumber}-${Math.round(order)} lbs.`);
    } else if (reclaim > 0) {
      parts.push(`H${h.houseNumber}-${Math.round(reclaim)} Rec.`);
    }
  }
  return parts;
}

export function calculateLastFeedOrder(input: LfoCalculateInput): LfoCalculateResult {
  const now = input.now ?? new Date();
  const rate = Number.isFinite(input.consumptionRate)
    ? input.consumptionRate
    : DEFAULT_LFO_CONSUMPTION_RATE;

  const houses: LfoHouseCalculateResult[] = input.houses.map((h) => {
    const feedUpAt = toDate(h.feedUpAt);
    const feedOffAt = feedUpAt ? feedOffFromFeedUp(feedUpAt) : null;
    const hoursUntilFeedOff =
      feedOffAt == null ? null : Math.max(0, hoursBetween(now, feedOffAt));
    const hourly = hourlyConsumptionLbs(h.headCount, rate);
    const inventoryPounds = h.binAPounds + h.binBPounds;
    const feedConsumedUntilOffLbs =
      hoursUntilFeedOff == null ? null : hoursUntilFeedOff * hourly;
    const balanceLbs =
      feedConsumedUntilOffLbs == null ? null : inventoryPounds - feedConsumedUntilOffLbs;
    const rawOrder = balanceLbs == null ? null : balanceLbs < 0 ? Math.abs(balanceLbs) : 0;
    const rawReclaim = balanceLbs == null ? null : balanceLbs > 0 ? balanceLbs : 0;
    const orderLbs = rawOrder == null ? null : roundOrderLbs(rawOrder);
    const reclaimLbs = rawReclaim == null ? null : roundReclaimLbs(rawReclaim);

    return {
      houseId: h.houseId,
      houseNumber: h.houseNumber,
      headCount: h.headCount,
      inventoryPounds,
      feedUpAt,
      feedOffAt,
      hoursUntilFeedOff,
      hourlyConsumptionLbs: hourly,
      feedConsumedUntilOffLbs,
      balanceLbs,
      rawOrderLbs: rawOrder,
      rawReclaimLbs: rawReclaim,
      orderLbs,
      reclaimLbs,
    };
  });

  return {
    ready: true,
    consumptionRate: rate,
    houses,
    totalHourlyConsumptionLbs: houses.reduce((s, h) => s + h.hourlyConsumptionLbs, 0),
    totalFeedConsumedUntilOffLbs: houses.reduce(
      (s, h) => s + (h.feedConsumedUntilOffLbs ?? 0),
      0,
    ),
    totalOrderLbs: houses.reduce((s, h) => s + (h.orderLbs ?? 0), 0),
    totalReclaimLbs: houses.reduce((s, h) => s + (h.reclaimLbs ?? 0), 0),
  };
}
