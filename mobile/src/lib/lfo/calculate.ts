import { formatDateTimeInAppZone, formatStampInAppZone, zonedDateTimeFromParts } from "../appCalendar";
import { normalizeHalfHourTime } from "../time-slots";

export const DEFAULT_LFO_CONSUMPTION_RATE = 0.45;
export const FEED_OFF_HOURS_BEFORE_UP = 5;
/** Catch is 5 hours after feed up (10 hours after feed off). */
export const FEED_UP_HOURS_BEFORE_CATCH = 5;

export type LfoFeedTiming = {
  feedUpHoursBeforeCatch: number;
  feedOffHoursBeforeCatch: number;
};

export const DEFAULT_LFO_FEED_TIMING: LfoFeedTiming = {
  feedUpHoursBeforeCatch: FEED_UP_HOURS_BEFORE_CATCH,
  feedOffHoursBeforeCatch: FEED_UP_HOURS_BEFORE_CATCH + FEED_OFF_HOURS_BEFORE_UP,
};

export function resolveLfoFeedTiming(
  feedUpHoursBeforeCatch?: number | null,
  feedOffHoursBeforeCatch?: number | null,
): LfoFeedTiming {
  const up =
    Number.isFinite(feedUpHoursBeforeCatch) && (feedUpHoursBeforeCatch as number) >= 1
      ? Math.round(feedUpHoursBeforeCatch as number)
      : DEFAULT_LFO_FEED_TIMING.feedUpHoursBeforeCatch;
  const offRaw =
    Number.isFinite(feedOffHoursBeforeCatch) && (feedOffHoursBeforeCatch as number) >= 1
      ? Math.round(feedOffHoursBeforeCatch as number)
      : DEFAULT_LFO_FEED_TIMING.feedOffHoursBeforeCatch;
  return {
    feedUpHoursBeforeCatch: up,
    feedOffHoursBeforeCatch: offRaw > up ? offRaw : up + FEED_OFF_HOURS_BEFORE_UP,
  };
}

export function lfoTimingFromSettings(
  settings?: {
    lfoFeedUpHoursBeforeCatch?: number | null;
    lfoFeedOffHoursBeforeCatch?: number | null;
  } | null,
): LfoFeedTiming {
  return resolveLfoFeedTiming(
    settings?.lfoFeedUpHoursBeforeCatch,
    settings?.lfoFeedOffHoursBeforeCatch,
  );
}

export function feedUpLabel(timing: LfoFeedTiming = DEFAULT_LFO_FEED_TIMING): string {
  return `Feed up (−${timing.feedUpHoursBeforeCatch})`;
}

export function feedOffLabel(timing: LfoFeedTiming = DEFAULT_LFO_FEED_TIMING): string {
  return `Feed off (−${timing.feedOffHoursBeforeCatch})`;
}

function hoursBeforeUp(timing: LfoFeedTiming = DEFAULT_LFO_FEED_TIMING): number {
  return timing.feedOffHoursBeforeCatch - timing.feedUpHoursBeforeCatch;
}

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
  /** Half-hour clock (HH:mm). Hours-until-off is measured from this, not wall clock. */
  orderTime?: string | null;
  /** Lbs feed per bird per day. */
  consumptionRate: number;
  now?: Date;
  houses: LfoHouseInventoryInput[];
  timing?: LfoFeedTiming;
  timeZone?: string | null;
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

function toDate(value: string | Date | null | undefined, timeZone?: string | null): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const wall = value.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (wall && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value.trim())) {
    return zonedDateTimeFromParts(wall[1]!, wall[2]!, timeZone);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function feedOffFromFeedUp(
  feedUpAt: Date,
  timing: LfoFeedTiming = DEFAULT_LFO_FEED_TIMING,
): Date {
  return new Date(feedUpAt.getTime() - hoursBeforeUp(timing) * 60 * 60 * 1000);
}

/** Settings-timezone `yyyy-MM-dd` + `HH:mm` → Date (default Central). */
export function combineDateAndTime(
  dateKey: string,
  timeHHmm: string,
  timeZone?: string | null,
): Date | null {
  const date = dateKey.trim();
  const time = timeHHmm.trim();
  if (!date || !time) return null;
  return zonedDateTimeFromParts(date, time, timeZone);
}

export function formatLocalDateTime(d: Date, timeZone?: string | null): string {
  return formatDateTimeInAppZone(d, timeZone);
}

/** Feed up is N hours before catch (default 5; catch 11:00 PM → feed up 6:00 PM). */
export function feedUpFromCatch(
  catchDateKey: string,
  catchTimeHHmm: string,
  timing: LfoFeedTiming = DEFAULT_LFO_FEED_TIMING,
  timeZone?: string | null,
): Date | null {
  const catchAt = combineDateAndTime(catchDateKey, catchTimeHHmm, timeZone);
  if (!catchAt) return null;
  return new Date(catchAt.getTime() - timing.feedUpHoursBeforeCatch * 60 * 60 * 1000);
}

/** Catch is N hours after feed up (default 5; 10 hours after feed off). */
export function catchFromFeedUp(
  feedUpAt: Date,
  timing: LfoFeedTiming = DEFAULT_LFO_FEED_TIMING,
): Date {
  return new Date(feedUpAt.getTime() + timing.feedUpHoursBeforeCatch * 60 * 60 * 1000);
}

/** Split a Settings-timezone `yyyy-MM-ddTHH:mm` (or Date) into date + :00/:30 time. */
export function splitLocalDateTime(
  value: string | Date | null | undefined,
  timeZone?: string | null,
): {
  date: string;
  time: string;
} {
  if (value == null || value === "") return { date: "", time: "" };
  const formatted = value instanceof Date ? formatLocalDateTime(value, timeZone) : value;
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
export function catchPartsFromFeedUpAt(
  feedUpAt: string | Date | null | undefined,
  timing: LfoFeedTiming = DEFAULT_LFO_FEED_TIMING,
  timeZone?: string | null,
): {
  date: string;
  time: string;
} {
  if (feedUpAt == null || feedUpAt === "") return { date: "", time: "" };
  const parts = splitLocalDateTime(feedUpAt, timeZone);
  const feedUp = combineDateAndTime(parts.date, parts.time, timeZone);
  if (!feedUp) return { date: "", time: "" };
  return splitLocalDateTime(catchFromFeedUp(feedUp, timing), timeZone);
}

export function feedUpAtFromCatch(
  catchDate: string,
  catchTime: string,
  timing: LfoFeedTiming = DEFAULT_LFO_FEED_TIMING,
  timeZone?: string | null,
): string | null {
  const feedUp = feedUpFromCatch(catchDate, catchTime, timing, timeZone);
  return feedUp ? formatLocalDateTime(feedUp, timeZone) : null;
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

/** Drop a leftover 500 so results land on thousands (16500 → 16000). */
export function snapAwayFrom500(lbs: number): number {
  if (!Number.isFinite(lbs) || lbs <= 0) return 0;
  return lbs % 1000 === 500 ? lbs - 500 : lbs;
}

/** Order (excess / LFO shortfall): round up to nearest 500, add 2000, never end in 500. */
export function roundOrderLbs(rawLbs: number): number {
  if (!Number.isFinite(rawLbs) || rawLbs <= 0) return 0;
  return snapAwayFrom500(roundUpToNearest500(rawLbs) + 2000);
}

/** Reclaim surplus: round up to nearest 500, never end in 500. */
export function roundReclaimLbs(rawLbs: number): number {
  return snapAwayFrom500(roundUpToNearest500(rawLbs));
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

/** Order date + half-hour time. Used as the LFO clock (not wall-clock now). */
export function lfoClockFromOrder(
  orderDate: string,
  orderTime?: string | null,
  timeZone?: string | null,
): Date | null {
  const time = normalizeHalfHourTime(orderTime);
  if (!time) return null;
  return combineDateAndTime(orderDate.slice(0, 10), time, timeZone);
}

export function formatLfoOrderClock(
  orderDate: string,
  orderTime?: string | null,
  timeZone?: string | null,
): string {
  const d = lfoClockFromOrder(orderDate, orderTime, timeZone);
  if (!d) return "";
  return formatStampInAppZone(d, timeZone, { year: true });
}

export function calculateLastFeedOrder(input: LfoCalculateInput): LfoCalculateResult {
  const now =
    input.now ?? lfoClockFromOrder(input.orderDate, input.orderTime, input.timeZone) ?? new Date();
  const rate = Number.isFinite(input.consumptionRate)
    ? input.consumptionRate
    : DEFAULT_LFO_CONSUMPTION_RATE;
  const timing = input.timing ?? DEFAULT_LFO_FEED_TIMING;

  const houses: LfoHouseCalculateResult[] = input.houses.map((h) => {
    const feedUpAt = toDate(h.feedUpAt, input.timeZone);
    const feedOffAt = feedUpAt ? feedOffFromFeedUp(feedUpAt, timing) : null;
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
