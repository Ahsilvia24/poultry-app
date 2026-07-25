export const DEFAULT_LFO_CONSUMPTION_RATE = 0.45;
export const FEED_OFF_HOURS_BEFORE_UP = 6;

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
  /** Hours from now until feed off (0 if past or unset). */
  hoursUntilFeedOff: number | null;
  /** (headCount × consumptionRate) / 24 */
  hourlyConsumptionLbs: number;
  /** hoursUntilFeedOff × hourlyConsumptionLbs */
  feedConsumedUntilOffLbs: number | null;
  /**
   * inventory − feed used until off.
   * Positive = reclaim (feed left); negative = LFO shortfall (order abs).
   */
  balanceLbs: number | null;
  /** Amount to order when short (abs of negative balance). */
  orderLbs: number | null;
  /** Feed left to reclaim when surplus. */
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

export function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (60 * 60 * 1000);
}

export function hourlyConsumptionLbs(headCount: number, consumptionRate: number): number {
  return (Math.max(0, headCount) * consumptionRate) / 24;
}

/**
 * Last feed order calculation from bin inventory, feed-up times, and head count.
 *
 * feedOff = feedUp − 6h
 * hoursConsumed = max(0, now → feedOff)
 * hourlyRate = (headCount × consumptionRate) / 24
 * feedConsumed = hoursConsumed × hourlyRate
 * balance = inventory − feedConsumed
 *   balance < 0 → order (LFO) = |balance|
 *   balance > 0 → reclaim = balance
 */
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
    const orderLbs = balanceLbs == null ? null : balanceLbs < 0 ? Math.abs(balanceLbs) : 0;
    const reclaimLbs = balanceLbs == null ? null : balanceLbs > 0 ? balanceLbs : 0;

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
