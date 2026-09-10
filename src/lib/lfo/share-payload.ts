import {
  calculateLastFeedOrder,
  catchPartsFromFeedUpAt,
  feedUpAtFromCatch,
  formatHouseLfoSummary,
  type LfoCalculateResult,
  type LfoHouseCalculateResult,
} from "@/lib/lfo/calculate";
import { formatConsumptionRate } from "@/lib/lfo/consumptionRate";
import { halfHourTimeLabel } from "@/lib/time-slots";

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
};

function formatOrderDate(dateKey: string): string {
  const [y, m, d] = dateKey.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return dateKey;
  return `${m}-${d}-${y}`;
}

function formatLbs(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatHours(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

function formatFeedStamp(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAsOf(value: string | Date | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function dash(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : "—";
}

function rawRow(result: LfoHouseCalculateResult): LfoShareField | null {
  if (result.rawOrderLbs != null && result.rawOrderLbs > 0) {
    return { label: "LFO", value: `${formatLbs(result.rawOrderLbs)} lbs` };
  }
  if (result.rawReclaimLbs != null && result.rawReclaimLbs > 0) {
    return { label: "Reclaim", value: `${formatLbs(result.rawReclaimLbs)} lbs` };
  }
  return null;
}

function roundedRow(result: LfoHouseCalculateResult): LfoShareField {
  if (result.orderLbs != null && result.orderLbs > 0) {
    return { label: "LFO (rounded)", value: `Order ${formatLbs(result.orderLbs)} lbs` };
  }
  if (result.reclaimLbs != null && result.reclaimLbs > 0) {
    return { label: "Reclaim (rounded)", value: `Reclaim ${formatLbs(result.reclaimLbs)} lbs` };
  }
  return {
    label: "LFO / reclaim (rounded)",
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
  const orderDate = inventory.orderDate.slice(0, 10);
  const houses = inventory.houses
    .filter((house) => Number(house.headCount) > 0)
    .map((house, index) => {
    let catchDate = house.catchDate?.trim() ?? "";
    let catchTime = house.catchTime?.trim() ?? "";
    if ((!catchDate || !catchTime) && house.feedUpAt) {
      const parts = catchPartsFromFeedUpAt(house.feedUpAt);
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
      feedUpAt: house.feedUpAt ?? feedUpAtFromCatch(catchDate, catchTime),
    };
  });

  const result =
    calc ??
    calculateLastFeedOrder({
      orderDate,
      orderTime: inventory.orderTime,
      consumptionRate: inventory.consumptionRate,
      houses: houses.map((house) => ({
        houseId: house.houseId,
        houseNumber: house.houseNumber,
        headCount: house.headCount,
        binAPounds: house.binAPounds,
        binBPounds: house.binBPounds,
        feedUpAt: house.feedUpAt,
      })),
    });

  const orderTimeLabel = dash(halfHourTimeLabel(inventory.orderTime));
  const orderDateLabel = formatOrderDate(orderDate);
  const calculatedAtLabel = formatAsOf(inventory.calculatedAt);
  const notes = inventory.notes?.trim() || null;
  const houseSummaryLines = formatHouseLfoSummary(result.houses);

  const sections: LfoShareSection[] = [
    {
      title: "Order",
      rows: [
        { label: "Farm", value: inventory.farmName },
        {
          label: "Consumption rate",
          value: `${formatConsumptionRate(inventory.consumptionRate)} lbs/bird/day`,
        },
        { label: "Hours measured from", value: `${orderDateLabel}  ${orderTimeLabel}` },
        { label: "Head counts as of", value: calculatedAtLabel },
        ...(notes ? [{ label: "Notes", value: notes }] : []),
      ],
    },
  ];

  for (const house of houses) {
    const houseResult =
      result.houses.find((row) => row.houseNumber === house.houseNumber) ??
      result.houses.find((row) => row.houseId === house.houseId);
    const raw = houseResult ? rawRow(houseResult) : null;
    sections.push({
      title: `House ${house.houseNumber}`,
      rows: [
        {
          label: "Head count",
          value: `${house.headCount.toLocaleString()}${inventory.calculatedAt ? " at save" : ""}`,
        },
        { label: "Bin A (lbs)", value: formatLbs(house.binAPounds) },
        { label: "Bin B (lbs)", value: formatLbs(house.binBPounds) },
        { label: "Catch date", value: house.catchDate ? formatOrderDate(house.catchDate) : "—" },
        { label: "Catch time", value: dash(halfHourTimeLabel(house.catchTime)) },
        { label: "Feed up (−5)", value: formatFeedStamp(houseResult?.feedUpAt ?? null) },
        { label: "Feed off (−10)", value: formatFeedStamp(houseResult?.feedOffAt ?? null) },
        {
          label: "Hours until feed off",
          value:
            houseResult?.hoursUntilFeedOff == null
              ? "—"
              : formatHours(houseResult.hoursUntilFeedOff),
        },
        {
          label: "Hourly consumption",
          value: houseResult
            ? `${formatLbs(houseResult.hourlyConsumptionLbs)} lbs/hr`
            : "—",
        },
        {
          label: "Feed used until off",
          value:
            houseResult?.feedConsumedUntilOffLbs == null
              ? "—"
              : `${formatLbs(houseResult.feedConsumedUntilOffLbs)} lbs`,
        },
        ...(raw ? [raw] : []),
        houseResult
          ? roundedRow(houseResult)
          : { label: "LFO / reclaim (rounded)", value: "—" },
      ],
    });
  }

  sections.push({
    title: "Totals",
    rows: [
      { label: "Order", value: `${formatLbs(result.totalOrderLbs)} lbs` },
      { label: "Reclaim", value: `${formatLbs(result.totalReclaimLbs)} lbs` },
    ],
  });

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
