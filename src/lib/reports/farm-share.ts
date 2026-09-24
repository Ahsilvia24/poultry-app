import { resolveAppTimeZone } from "@/lib/app-time-zones";
import type { PdfBlock } from "@/lib/exports/pdf";
import { sortFarmsByOrder } from "@/lib/farm-order";
import {
  combineDateAndTime,
  feedOffFromFeedUp,
  feedUpFromCatch,
  lfoTimingFromSettings,
  type LfoFeedTiming,
} from "@/lib/lfo/calculate";
import { asDateKey } from "@/lib/offline/dates";
import { reportFarms, type ReportFarmOption } from "@/lib/offline/selectReports";
import type { OfflineSnapshot } from "@/lib/offline/types";

export const FARM_SHARE_FIELDS = [
  { key: "feedOff", label: "Feed Off" },
  { key: "feedUp", label: "Feed Up" },
  { key: "catchTimes", label: "Catch Times" },
] as const;

export type FarmShareFieldKey = (typeof FARM_SHARE_FIELDS)[number]["key"];

export const ALL_FARM_SHARE_FIELDS: FarmShareFieldKey[] = FARM_SHARE_FIELDS.map(
  (field) => field.key,
);

export type FarmShareHouse = {
  houseNumber: number;
  catchDate: string | null;
  catchTime: string | null;
  catchAt: Date | null;
  feedUpAt: Date | null;
  feedOffAt: Date | null;
};

export type FarmShareModel = {
  farmId: string;
  farmName: string;
  timeZone: string;
  timing: LfoFeedTiming;
  houses: FarmShareHouse[];
};

/** Older birds first — this picker ignores Settings farm order. */
export function shareFarms(snapshot: OfflineSnapshot): ReportFarmOption[] {
  return sortFarmsByOrder(reportFarms(snapshot), "age_desc");
}

export function firstShareFarmId(snapshot: OfflineSnapshot): string {
  return shareFarms(snapshot)[0]?.id ?? "";
}

export function parseShareFields(raw?: string | null): FarmShareFieldKey[] {
  if (raw == null || !raw.trim()) return [];
  const allowed = new Set<string>(ALL_FARM_SHARE_FIELDS);
  const requested = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => allowed.has(part)) as FarmShareFieldKey[];
  return ALL_FARM_SHARE_FIELDS.filter((key) => requested.includes(key));
}

export function encodeShareFields(fields: Iterable<FarmShareFieldKey>): string {
  const selected = new Set(fields);
  return ALL_FARM_SHARE_FIELDS.filter((key) => selected.has(key)).join(",");
}

export function toggleShareField(
  fields: FarmShareFieldKey[],
  key: FarmShareFieldKey,
  checked: boolean,
): FarmShareFieldKey[] {
  const next = new Set(fields);
  if (checked) next.add(key);
  else next.delete(key);
  return ALL_FARM_SHARE_FIELDS.filter((item) => next.has(item));
}

export function formatFarmShareStamp(
  value: Date | null,
  timeZone?: string | null,
): string {
  if (!value) return "—";
  return value.toLocaleString("en-US", {
    timeZone: resolveAppTimeZone(timeZone),
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function activeFlockIds(snapshot: OfflineSnapshot, farmId: string): Set<string> {
  return new Set(
    (snapshot.flocks ?? [])
      .filter((flock) => flock.farmId === farmId && flock.flockStatus === "ACTIVE" && !flock.deletedAt)
      .map((flock) => flock.id),
  );
}

export function selectFarmShare(snapshot: OfflineSnapshot, farmId: string): FarmShareModel | null {
  const farm = (snapshot.farms ?? []).find((row) => row.id === farmId && !row.deletedAt);
  if (!farm) return null;
  const timeZone = resolveAppTimeZone(snapshot.settings?.appTimeZone);
  const timing = lfoTimingFromSettings(snapshot.settings);
  const flockIds = activeFlockIds(snapshot, farmId);
  const flocks = (snapshot.flocks ?? []).filter((flock) => flockIds.has(flock.id));
  const houses = (snapshot.houses ?? [])
    .filter((house) => house.farmId === farmId && !house.deletedAt)
    .slice()
    .sort((a, b) => a.houseNumber - b.houseNumber)
    .map((house) => {
      const hf = (snapshot.houseFlocks ?? []).find(
        (row) => row.houseId === house.id && flockIds.has(row.flockId),
      );
      const flock = hf ? flocks.find((row) => row.id === hf.flockId) : flocks[0];
      const catchDate =
        asDateKey(hf?.catchDate) ??
        asDateKey(flock?.actualCatchDate) ??
        asDateKey(flock?.projectedCatchDate);
      const catchTime = hf?.catchTime?.trim() || null;
      const catchAt =
        catchDate && catchTime ? combineDateAndTime(catchDate, catchTime, timeZone) : null;
      const feedUpAt =
        catchDate && catchTime ? feedUpFromCatch(catchDate, catchTime, timing, timeZone) : null;
      const feedOffAt = feedUpAt ? feedOffFromFeedUp(feedUpAt, timing) : null;
      return {
        houseNumber: house.houseNumber,
        catchDate,
        catchTime,
        catchAt,
        feedUpAt,
        feedOffAt,
      };
    });
  return {
    farmId: farm.id,
    farmName: farm.farmName,
    timeZone,
    timing,
    houses,
  };
}

function houseLabel(houseNumber: number) {
  return `H${houseNumber}`;
}

function stampOf(house: FarmShareHouse, field: FarmShareFieldKey): Date | null {
  if (field === "feedOff") return house.feedOffAt;
  if (field === "feedUp") return house.feedUpAt;
  return house.catchAt;
}

export function farmShareSectionTitle(
  field: FarmShareFieldKey,
  timing: LfoFeedTiming,
): string {
  if (field === "feedOff") return `Feed Off (−${timing.feedOffHoursBeforeCatch})`;
  if (field === "feedUp") return `Feed Up (−${timing.feedUpHoursBeforeCatch})`;
  return "Catch Times";
}

/** Helvetica cannot draw Unicode minus — it shows up as `"`. */
export function farmSharePdfTitle(text: string): string {
  return text.replace(/\u2212/g, "-").replace(/[\u2013\u2014]/g, "-");
}

export function farmSharePdfBlocks(
  model: FarmShareModel,
  fields: Iterable<FarmShareFieldKey>,
): PdfBlock[] {
  const selected = new Set(fields);
  const blocks: PdfBlock[] = [];
  for (const field of ALL_FARM_SHARE_FIELDS) {
    if (!selected.has(field)) continue;
    blocks.push({
      type: "lines",
      title: farmSharePdfTitle(farmShareSectionTitle(field, model.timing)),
      lines: model.houses.map(
        (house) =>
          `${houseLabel(house.houseNumber)}  ${formatFarmShareStamp(stampOf(house, field), model.timeZone)}`,
      ),
    });
  }
  return blocks;
}

export function farmShareFilename(farmName: string): string {
  const name =
    farmName
      .trim()
      .replace(/\s+/g, " ")
      .replace(/[\\/:*?"<>|]+/g, "")
      .trim() || "Farm";
  return `${name} Info.pdf`;
}

export function farmShareCheckboxLabel(
  field: FarmShareFieldKey,
  timing: LfoFeedTiming,
): string {
  return farmShareSectionTitle(field, timing);
}
