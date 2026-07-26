"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { saveMortalityHouseSeriesAction } from "@/app/actions/mortality";
import {
  birdAgeFromPlacement,
  calcPercentage,
  calcTotalDailyLoss,
  flockWeekFromAge,
  resolveMortalityStatus,
} from "@/lib/mortality/calculations";
import { formatNumber, formatPct } from "@/lib/utils";
import type { ThresholdSettings } from "@/types";
import { Card, Input, StatusBadge } from "@/components/ui";
import { cn } from "@/lib/utils";

export type MortalityHousePayload = {
  houseFlockId: string;
  houseNumber: number;
  placedBirdCount: number;
  existingEntries: Array<{
    mortalityDate: string;
    dailyMortalityCount: number;
    cullCount: number;
    mortalityCause: string;
    comments: string | null;
    isDraft: boolean;
  }>;
};

export type MortalityFarmPayload = {
  id: string;
  farmName: string;
  activeFlock: {
    id: string;
    flockNumber: string;
    placementDate: string;
    projectedCatchDate: string | null;
    targetMarketAge: number | null;
    houses: MortalityHousePayload[];
  } | null;
};

type DayRow = {
  age: number;
  mortalityDate: string;
  dailyMortalityCount: string;
  cullCount: string;
};

type WeekGroup = {
  week: number;
  rows: DayRow[];
  culls: number;
  mortality: number;
  loss: number;
  ageStart: number;
  ageEnd: number;
};

const SAVE_DEBOUNCE_MS = 500;

function formatDayLabel(mortalityDate: string) {
  const [y, m, d] = mortalityDate.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  // Sun Mon Tue Wed Thu Fri Sat
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()] ?? "";
  return `${weekday} ${format(date, "M")}·${format(date, "d")}`;
}

function parseLocalDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

function todayDate() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

function buildRows(
  placementDate: string,
  catchDate: string,
  house: MortalityHousePayload,
): DayRow[] {
  const placement = parseLocalDate(placementDate);
  const catchEnd = parseLocalDate(catchDate);
  const maxAge = Math.max(
    birdAgeFromPlacement(placement, todayDate()),
    birdAgeFromPlacement(placement, catchEnd),
  );
  const byDate = new Map(house.existingEntries.map((e) => [e.mortalityDate, e]));

  const rows: DayRow[] = [];
  for (let age = 0; age <= maxAge; age++) {
    const mortalityDate = format(addDays(placement, age), "yyyy-MM-dd");
    const existing = byDate.get(mortalityDate);
    rows.push({
      age,
      mortalityDate,
      dailyMortalityCount: existing ? String(existing.dailyMortalityCount) : "0",
      cullCount: existing ? String(existing.cullCount) : "0",
    });
  }
  return rows;
}

function resolveCatchDateKey(flock: {
  placementDate: string;
  projectedCatchDate: string | null;
  targetMarketAge: number | null;
}): string {
  if (flock.projectedCatchDate) return flock.projectedCatchDate;
  const placement = parseLocalDate(flock.placementDate);
  const age =
    flock.targetMarketAge != null && flock.targetMarketAge > 0
      ? flock.targetMarketAge
      : 52;
  return format(addDays(placement, age), "yyyy-MM-dd");
}

function groupRowsByWeek(rows: DayRow[]): WeekGroup[] {
  const byWeek = new Map<number, DayRow[]>();
  for (const row of rows) {
    const week = flockWeekFromAge(row.age);
    const list = byWeek.get(week) ?? [];
    list.push(row);
    byWeek.set(week, list);
  }

  return Array.from(byWeek.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([week, weekRows]) => {
      let culls = 0;
      let mortality = 0;
      for (const r of weekRows) {
        culls += Number(r.cullCount || 0);
        mortality += Number(r.dailyMortalityCount || 0);
      }
      return {
        week,
        rows: weekRows,
        culls,
        mortality,
        loss: culls + mortality,
        ageStart: weekRows[0]!.age,
        ageEnd: weekRows[weekRows.length - 1]!.age,
      };
    });
}

function buildHouseWarning(
  house: MortalityHousePayload,
  rows: DayRow[],
  thresholds: ThresholdSettings,
) {
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1]!;
  const loss = calcTotalDailyLoss(
    Number(last.dailyMortalityCount || 0),
    Number(last.cullCount || 0),
  );
  const dailyPct = calcPercentage(loss, house.placedBirdCount);
  const priorSeven = rows
    .slice(-7)
    .reduce(
      (s, r) =>
        s + calcTotalDailyLoss(Number(r.dailyMortalityCount || 0), Number(r.cullCount || 0)),
      0,
    );
  const sevenDayPct = calcPercentage(priorSeven, house.placedBirdCount);
  const status = resolveMortalityStatus({ dailyPct, sevenDayPct }, thresholds);
  return { status, dailyPct, sevenDayPct };
}

export function MortalityEntryForm({
  farms,
  initialFarmId,
  initialHouseFlockId,
  thresholds,
}: {
  farms: MortalityFarmPayload[];
  initialFarmId?: string;
  initialHouseFlockId?: string;
  thresholds: ThresholdSettings;
}) {
  const router = useRouter();
  const [farmId, setFarmId] = useState(
    initialFarmId && farms.some((f) => f.id === initialFarmId)
      ? initialFarmId
      : farms.find((f) => f.activeFlock)?.id ?? farms[0]?.id ?? "",
  );

  const farm = useMemo(() => farms.find((f) => f.id === farmId) ?? null, [farms, farmId]);
  const flock = farm?.activeFlock ?? null;
  const houses = flock?.houses ?? [];

  const [houseFlockId, setHouseFlockId] = useState(() => {
    if (initialHouseFlockId && houses.some((h) => h.houseFlockId === initialHouseFlockId)) {
      return initialHouseFlockId;
    }
    return houses[0]?.houseFlockId ?? "";
  });

  const house = useMemo(
    () => houses.find((h) => h.houseFlockId === houseFlockId) ?? null,
    [houses, houseFlockId],
  );

  const [rows, setRows] = useState<DayRow[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [summary, setSummary] = useState<{
    totalMortality: number;
    totalCulls: number;
    totalLoss: number;
    status: string;
    dailyPct: number;
    sevenDayPct: number;
  } | null>(null);

  const rowsRef = useRef(rows);
  const flockRef = useRef(flock);
  const houseRef = useRef(house);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveGenRef = useRef(0);
  const dirtyRef = useRef(false);
  rowsRef.current = rows;
  flockRef.current = flock;
  houseRef.current = house;

  function cancelScheduledSave() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }

  async function performSave() {
    const currentFlock = flockRef.current;
    const currentHouse = houseRef.current;
    const currentRows = rowsRef.current;
    if (!currentFlock || !currentHouse || currentRows.length === 0) return;

    const gen = ++saveGenRef.current;
    dirtyRef.current = false;
    setSaveStatus("saving");
    setError(null);

    const result = await saveMortalityHouseSeriesAction({
      flockId: currentFlock.id,
      houseFlockId: currentHouse.houseFlockId,
      mortalityCause: "UNKNOWN",
      comments: null,
      isDraft: false,
      entries: currentRows.map((r) => ({
        mortalityDate: r.mortalityDate,
        dailyMortalityCount: Number(r.dailyMortalityCount || 0),
        cullCount: Number(r.cullCount || 0),
      })),
    });

    if (gen !== saveGenRef.current) return;

    if (result?.error) {
      setError(result.error);
      setSaveStatus("idle");
      return;
    }

    const totalMortality = currentRows.reduce((s, r) => s + Number(r.dailyMortalityCount || 0), 0);
    const totalCulls = currentRows.reduce((s, r) => s + Number(r.cullCount || 0), 0);
    const warning = buildHouseWarning(currentHouse, currentRows, thresholds);
    setSummary({
      totalMortality,
      totalCulls,
      totalLoss: totalMortality + totalCulls,
      status: warning?.status ?? "Normal",
      dailyPct: warning?.dailyPct ?? 0,
      sevenDayPct: warning?.sevenDayPct ?? 0,
    });
    setSaveStatus("saved");
  }

  function scheduleSave() {
    dirtyRef.current = true;
    cancelScheduledSave();
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      void performSave();
    }, SAVE_DEBOUNCE_MS);
  }

  function flushSave() {
    if (!dirtyRef.current && !saveTimerRef.current) return;
    cancelScheduledSave();
    void performSave();
  }

  // Keep house selection valid when farm changes
  useEffect(() => {
    if (!flock || houses.length === 0) {
      setHouseFlockId("");
      setRows([]);
      return;
    }
    if (!houses.some((h) => h.houseFlockId === houseFlockId)) {
      setHouseFlockId(houses[0]!.houseFlockId);
    }
  }, [farmId, flock?.id, houses, houseFlockId]);

  useEffect(() => {
    cancelScheduledSave();
    saveGenRef.current += 1;
    dirtyRef.current = false;
    setSaveStatus("idle");
    setError(null);
    setSummary(null);

    if (!flock || !house) {
      setRows([]);
      return;
    }

    const catchDate = resolveCatchDateKey(flock);
    const built = buildRows(flock.placementDate, catchDate, house);
    setRows(built);
    const totalMortality = built.reduce((s, r) => s + Number(r.dailyMortalityCount || 0), 0);
    const totalCulls = built.reduce((s, r) => s + Number(r.cullCount || 0), 0);
    const warning = buildHouseWarning(house, built, thresholds);
    setSummary({
      totalMortality,
      totalCulls,
      totalLoss: totalMortality + totalCulls,
      status: warning?.status ?? "Normal",
      dailyPct: warning?.dailyPct ?? 0,
      sevenDayPct: warning?.sevenDayPct ?? 0,
    });
    const currentWeek = flockWeekFromAge(
      birdAgeFromPlacement(parseLocalDate(flock.placementDate), todayDate()),
    );
    setExpandedWeeks(new Set([currentWeek]));
  }, [farmId, flock?.id, flock?.placementDate, flock?.projectedCatchDate, flock?.targetMarketAge, house?.houseFlockId]);
  useEffect(() => {
    return () => cancelScheduledSave();
  }, []);

  const weekGroups = useMemo(() => groupRowsByWeek(rows), [rows]);

  function toggleWeek(week: number) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      if (next.has(week)) next.delete(week);
      else next.add(week);
      return next;
    });
  }

  function updateRow(age: number, patch: Partial<Pick<DayRow, "dailyMortalityCount" | "cullCount">>) {
    setRows((prev) => {
      const next = prev.map((r) => (r.age === age ? { ...r, ...patch } : r));
      rowsRef.current = next;
      return next;
    });
    setSaveStatus("idle");
    scheduleSave();
  }

  function focusNextInColumn(field: "culls" | "mortality", age: number) {
    const nextAge = age + 1;
    if (!rowsRef.current.some((r) => r.age === nextAge)) return;

    const week = flockWeekFromAge(nextAge);
    setExpandedWeeks((prev) => {
      if (prev.has(week)) return prev;
      const next = new Set(prev);
      next.add(week);
      return next;
    });

    const focus = () => {
      const el = document.querySelector<HTMLInputElement>(
        `[data-mort-nav="${field}-${nextAge}"]`,
      );
      if (!el) return false;
      el.focus();
      el.select();
      return true;
    };

    requestAnimationFrame(() => {
      if (!focus()) window.setTimeout(focus, 50);
    });
  }

  function onColumnEnter(
    e: KeyboardEvent<HTMLInputElement>,
    field: "culls" | "mortality",
    age: number,
  ) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    flushSave();
    focusNextInColumn(field, age);
  }

  function changeFarm(nextFarmId: string) {
    cancelScheduledSave();
    saveGenRef.current += 1;
    dirtyRef.current = false;
    setFarmId(nextFarmId);
    setSaveStatus("idle");
    setError(null);
    setSummary(null);
    const nextFarm = farms.find((f) => f.id === nextFarmId);
    const firstHouse = nextFarm?.activeFlock?.houses[0]?.houseFlockId ?? "";
    setHouseFlockId(firstHouse);
    const qs = firstHouse
      ? `/mortality?farmId=${nextFarmId}&houseFlockId=${firstHouse}`
      : `/mortality?farmId=${nextFarmId}`;
    router.replace(qs);
  }

  function changeHouse(nextHouseId: string) {
    cancelScheduledSave();
    saveGenRef.current += 1;
    dirtyRef.current = false;
    setHouseFlockId(nextHouseId);
    setSaveStatus("idle");
    setError(null);
    setSummary(null);
    router.replace(`/mortality?farmId=${farmId}&houseFlockId=${nextHouseId}`);
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
          <div className="flex w-max flex-nowrap gap-2">
            {farms.map((f) => {
              const active = f.id === farmId;
              const disabled = !f.activeFlock;
              return (
                <button
                  key={f.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => changeFarm(f.id)}
                  className={cn(
                    "shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold whitespace-nowrap",
                    active
                      ? "bg-emerald-700 text-white"
                      : "bg-stone-200 text-stone-800 hover:bg-stone-300",
                    disabled && "cursor-not-allowed opacity-50 hover:bg-stone-200",
                  )}
                >
                  {f.farmName}
                </button>
              );
            })}
          </div>
        </div>

        {houses.length > 0 ? (
          <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
            <div className="flex w-max flex-nowrap gap-2">
              {houses.map((h) => (
                <button
                  key={h.houseFlockId}
                  type="button"
                  onClick={() => changeHouse(h.houseFlockId)}
                  className={cn(
                    "shrink-0 rounded-lg px-4 py-2.5 text-sm font-semibold whitespace-nowrap",
                    h.houseFlockId === houseFlockId
                      ? "bg-emerald-700 text-white"
                      : "bg-stone-200 text-stone-800 hover:bg-stone-300",
                  )}
                >
                  House {h.houseNumber}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {flock && house ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-600">
            <p>
              House <span className="font-semibold">{house.houseNumber}</span> · Placed{" "}
              {formatNumber(house.placedBirdCount)} ·{" "}
              <span className="font-semibold text-stone-900">
                {birdAgeFromPlacement(parseLocalDate(flock.placementDate), todayDate())}d
              </span>
            </p>
            {saveStatus === "saving" ? (
              <span className="text-stone-500">Saving…</span>
            ) : saveStatus === "saved" ? (
              <span className="font-medium text-emerald-800">Saved</span>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-amber-800">This farm has no active flock or houses.</p>
        )}
      </div>

      {house && rows.length > 0 ? (
        <div className="space-y-2">
          {weekGroups.map((group) => {
            const open = expandedWeeks.has(group.week);
            return (
              <Card key={group.week} className="!p-0 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleWeek(group.week)}
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left hover:bg-stone-50"
                  aria-expanded={open}
                >
                  <span className="w-5 shrink-0 text-stone-500" aria-hidden="true">
                    {open ? "▾" : "▸"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-bold text-stone-900">Week {group.week}</span>
                    <span className="ml-2 text-sm text-stone-500">
                      Ages {group.ageStart}–{group.ageEnd}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm text-stone-600">
                    Culls <span className="font-semibold text-stone-900">{group.culls}</span>
                    <span className="mx-1.5 text-stone-300">·</span>
                    Mort <span className="font-semibold text-stone-900">{group.mortality}</span>
                    <span className="mx-1.5 text-stone-300">·</span>
                    Total <span className="font-semibold text-stone-900">{group.loss}</span>
                  </span>
                </button>

                {open ? (
                  <div className="border-t border-stone-100">
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-stone-200 bg-stone-50 text-left">
                            <th className="sticky left-0 z-10 bg-stone-50 px-3 py-2 font-semibold text-stone-600">
                              Age
                            </th>
                            <th className="px-3 py-2 font-semibold text-stone-600">Date</th>
                            <th className="px-3 py-2 font-semibold text-stone-600">Culls</th>
                            <th className="px-3 py-2 font-semibold text-stone-600">Mortality</th>
                            <th className="px-3 py-2 font-semibold text-stone-600">Loss</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row) => {
                            const loss = calcTotalDailyLoss(
                              Number(row.dailyMortalityCount || 0),
                              Number(row.cullCount || 0),
                            );
                            return (
                              <tr key={row.mortalityDate} className="border-b border-stone-100">
                                <td className="sticky left-0 z-10 bg-white px-3 py-2 font-semibold text-stone-900">
                                  {row.age}
                                </td>
                                <td className="whitespace-nowrap px-3 py-2 text-stone-600">
                                  {formatDayLabel(row.mortalityDate)}
                                </td>
                                <td className="px-2 py-1.5">
                                  <Input
                                    aria-label={`Culls day ${row.age}`}
                                    data-mort-nav={`culls-${row.age}`}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    enterKeyHint="next"
                                    autoComplete="off"
                                    className="min-h-11 px-3"
                                    placeholder="0"
                                    value={row.cullCount === "0" ? "" : row.cullCount}
                                    onFocus={(e) => e.target.select()}
                                    onBlur={() => flushSave()}
                                    onKeyDown={(e) => onColumnEnter(e, "culls", row.age)}
                                    onChange={(e) => {
                                      const digits = e.target.value.replace(/\D/g, "");
                                      updateRow(row.age, {
                                        cullCount: digits === "" ? "0" : digits,
                                      });
                                    }}
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <Input
                                    aria-label={`Mortality day ${row.age}`}
                                    data-mort-nav={`mortality-${row.age}`}
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    enterKeyHint="next"
                                    autoComplete="off"
                                    className="min-h-11 px-3"
                                    placeholder="0"
                                    value={row.dailyMortalityCount === "0" ? "" : row.dailyMortalityCount}
                                    onFocus={(e) => e.target.select()}
                                    onBlur={() => flushSave()}
                                    onKeyDown={(e) => onColumnEnter(e, "mortality", row.age)}
                                    onChange={(e) => {
                                      const digits = e.target.value.replace(/\D/g, "");
                                      updateRow(row.age, {
                                        dailyMortalityCount: digits === "" ? "0" : digits,
                                      });
                                    }}
                                  />
                                </td>
                                <td className="px-3 py-2 font-semibold text-stone-800">{loss}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      {summary ? (
        <Card className="border-emerald-200 bg-emerald-50/40">
          <h3 className="font-bold text-stone-900">Saved</h3>
          <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-stone-500">Culls</p>
              <p className="text-xl font-bold">{summary.totalCulls}</p>
            </div>
            <div>
              <p className="text-stone-500">Mortality</p>
              <p className="text-xl font-bold">{summary.totalMortality}</p>
            </div>
            <div>
              <p className="text-stone-500">Total loss</p>
              <p className="text-xl font-bold">{summary.totalLoss}</p>
            </div>
          </div>
          {summary.status !== "Normal" ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-amber-900">Threshold warning</span>
              <StatusBadge status={summary.status} />
              <span>
                Latest day {formatPct(summary.dailyPct)} · 7-day {formatPct(summary.sevenDayPct)}
              </span>
            </div>
          ) : (
            <p className="mt-3 text-sm text-stone-600">No threshold warnings for latest day.</p>
          )}
        </Card>
      ) : null}
    </div>
  );
}
