import { formatStampInAppZone } from "../appCalendar";
import {
  calculateLastFeedOrder,
  catchPartsFromFeedUpAt,
  DEFAULT_LFO_FEED_TIMING,
  feedOffLabel,
  feedUpAtFromCatch,
  feedUpLabel,
  formatHouseLfoSummary,
  type LfoCalculateResult,
  type LfoFeedTiming,
  type LfoHouseCalculateResult,
} from "./calculate";
import { formatConsumptionRate } from "./consumptionRate";

export type LfoShareField = {
  label: string;
  value: string;
};

export type LfoShareSection = {
  title: string;
  rows: LfoShareField[];
};

export type LfoSharePayload = {
  farmName: string;
  orderDate: string;
  filename: string;
  title: string;
  subtitle: string;
  sections: LfoShareSection[];
  houseSummaryLines: string[];
};

export type LfoShareInventoryHouse = {
  houseId?: string;
  houseNumber: number;
  headCount: number;
  binAPounds: number;
  binBPounds: number;
  feedUpAt?: string | Date | null;
  catchDate?: string;
  catchTime?: string;
};

export type LfoShareInventory = {
  farmName: string;
  orderDate: string;
  orderTime?: string | null;
  consumptionRate: number;
  calculatedAt?: string | Date | null;
  notes?: string | null;
  houses: LfoShareInventoryHouse[];
  timing?: LfoFeedTiming;
  timeZone?: string | null;
};

function formatOrderDate(dateKey: string): string {
  const [y, m, d] = dateKey.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${m}-${d}-${y}`;
}

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatLbs(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatHours(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatLfoClock(hour24: number, minute: number): string {
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")}${hour24 < 12 ? "am" : "pm"}`;
}

/** "Sep 17, 2026 at 11:30am" */
function formatLfoDateAndTime(dateKey: string, time?: string | null): string {
  const [y, m, d] = (dateKey ?? "").slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return dateKey || "—";
  const datePart = `${SHORT_MONTHS[m - 1]} ${d}, ${y}`;
  const t = time?.trim();
  if (!t) return datePart;
  const [hh, mm] = t.split(":").map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return datePart;
  return `${datePart} at ${formatLfoClock(hh, mm)}`;
}

function formatLfoStamp(value: Date | string | null | undefined, timeZone?: string | null): string {
  if (value == null || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return formatStampInAppZone(d, timeZone, { year: true }).replace(
    /, (\d{1,2}:\d{2})\s*(AM|PM)/i,
    (_m, clock, ap) => ` at ${clock}${String(ap).toLowerCase()}`,
  );
}

function roundedOrderRow(result: LfoHouseCalculateResult): LfoShareField {
  if (result.orderLbs != null && result.orderLbs > 0) {
    const raw = result.rawOrderLbs;
    return {
      label: "Order (rounded)",
      value:
        raw != null && raw > 0
          ? `${formatLbs(raw)} lbs (${formatLbs(result.orderLbs)} lbs)`
          : `${formatLbs(result.orderLbs)} lbs`,
    };
  }
  if (result.reclaimLbs != null && result.reclaimLbs > 0) {
    const raw = result.rawReclaimLbs;
    return {
      label: "Reclaim (rounded)",
      value:
        raw != null && raw > 0
          ? `${formatLbs(raw)} lbs (${formatLbs(result.reclaimLbs)} lbs)`
          : `${formatLbs(result.reclaimLbs)} lbs`,
    };
  }
  return {
    label: "Order (rounded)",
    value: result.balanceLbs == null ? "—" : "Even — no order or reclaim",
  };
}

export function lfoShareFilename(farmName: string, orderDate: string): string {
  const farm = farmName.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "farm";
  return `LFO-${farm}-${formatOrderDate(orderDate)}.pdf`;
}

export function buildLfoSharePayload(
  inventory: LfoShareInventory,
  calc?: LfoCalculateResult,
): LfoSharePayload {
  const timing = inventory.timing ?? DEFAULT_LFO_FEED_TIMING;
  const timeZone = inventory.timeZone;
  const orderDate = inventory.orderDate.slice(0, 10);
  const houses = inventory.houses
    .filter((house) => Number(house.headCount) > 0)
    .map((house, index) => {
    let catchDate = house.catchDate?.trim() ?? "";
    let catchTime = house.catchTime?.trim() ?? "";
    if ((!catchDate || !catchTime) && house.feedUpAt) {
      const parts = catchPartsFromFeedUpAt(house.feedUpAt, timing, timeZone);
      catchDate = catchDate || parts.date;
      catchTime = catchTime || parts.time;
    }
    return {
      houseId: house.houseId ?? `house-${house.houseNumber}-${index}`,
      houseNumber: house.houseNumber,
      headCount: house.headCount,
      binAPounds: house.binAPounds,
      binBPounds: house.binBPounds,
      catchDate,
      catchTime,
      feedUpAt: house.feedUpAt ?? feedUpAtFromCatch(catchDate, catchTime, timing, timeZone),
    };
  });

  const result =
    calc ??
    calculateLastFeedOrder({
      orderDate,
      orderTime: inventory.orderTime,
      consumptionRate: inventory.consumptionRate,
      timing,
      timeZone,
      houses: houses.map((house) => {
        return {
          houseId: house.houseId,
          houseNumber: house.houseNumber,
          headCount: house.headCount,
          binAPounds: house.binAPounds,
          binBPounds: house.binBPounds,
          feedUpAt: house.feedUpAt,
        };
      }),
    });

  const notes = inventory.notes?.trim() || null;
  const houseSummaryLines = formatHouseLfoSummary(result.houses);

  const sections: LfoShareSection[] = [
    {
      title: "Order",
      rows: [
        { label: "Total Feed", value: `${formatLbs(result.totalOrderLbs)} lbs` },
        { label: "Reclaim", value: `${formatLbs(result.totalReclaimLbs)} lbs` },
        {
          label: "Consumption rate",
          value: `${formatConsumptionRate(inventory.consumptionRate)} lbs/bird/day`,
        },
        { label: "Hours measured from", value: formatLfoDateAndTime(orderDate, inventory.orderTime) },
        { label: "Head counts as of", value: formatLfoStamp(inventory.calculatedAt, timeZone) },
        ...(notes ? [{ label: "Notes", value: notes }] : []),
      ],
    },
  ];

  for (const house of houses) {
    const houseResult =
      result.houses.find((row) => row.houseNumber === house.houseNumber) ??
      result.houses.find((row) => row.houseId === house.houseId);
    sections.push({
      title: `House ${house.houseNumber}`,
      rows: [
        { label: "Head count", value: house.headCount.toLocaleString() },
        {
          label: "Bin A/B (lbs)",
          value: `${formatLbs(house.binAPounds)} / ${formatLbs(house.binBPounds)}`,
        },
        {
          label: "Catch",
          value:
            house.catchDate || house.catchTime
              ? formatLfoDateAndTime(house.catchDate, house.catchTime)
              : "—",
        },
        { label: feedUpLabel(timing), value: formatLfoStamp(houseResult?.feedUpAt ?? null, timeZone) },
        { label: feedOffLabel(timing), value: formatLfoStamp(houseResult?.feedOffAt ?? null, timeZone) },
        {
          label: "Hours until feed off",
          value: houseResult
            ? houseResult.hoursUntilFeedOff == null
              ? `@ ${formatLbs(houseResult.hourlyConsumptionLbs)} lbs/hr`
              : `${formatHours(houseResult.hoursUntilFeedOff)} @ ${formatLbs(houseResult.hourlyConsumptionLbs)} lbs/hr`
            : "—",
        },
        {
          label: "Feed used until off",
          value:
            houseResult?.feedConsumedUntilOffLbs == null
              ? "—"
              : `${formatLbs(houseResult.feedConsumedUntilOffLbs)} lbs`,
        },
        houseResult
          ? roundedOrderRow(houseResult)
          : { label: "Order (rounded)", value: "—" },
      ],
    });
  }

  if (houseSummaryLines.length > 0) {
    sections.push({
      title: "House summary",
      rows: houseSummaryLines.map((line) => ({ label: line, value: "" })),
    });
  }

  return {
    farmName: inventory.farmName,
    orderDate,
    filename: lfoShareFilename(inventory.farmName, orderDate),
    title: `Last Feed Order — ${inventory.farmName}`,
    subtitle: "",
    sections,
    houseSummaryLines,
  };
}
