"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { saveMortalityHouseSeriesAction } from "@/app/actions/mortality";
import {
  birdAgeFromPlacement,
  flockWeekFromAge,
} from "@/lib/mortality/calculations";
import { formatNumber } from "@/lib/utils";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";
import { NumberKeypad } from "@/components/NumberKeypad";
import { useKeypadNav } from "@/components/KeypadNavContext";

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
  /** True once a saved record exists or the tech edits this day. */
  hasEntry: boolean;
};

function NeedsEntryIcon() {
  return (
    <span
      className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-yellow-400 text-sm font-black leading-none text-yellow-950"
      title="Mortality needs entry"
      aria-label="Mortality needs entry"
    >
      !
    </span>
  );
}

/** True once mortality (daily loss) has been entered for the day — including 0. */
function mortalityEntered(row: DayRow) {
  return row.dailyMortalityCount !== "";
}

/**
 * Past/today with no mortality total yet — Loss cell shows !.
 * Day 0 is usually left blank (entry starts on day 1), so it never prompts.
 * Culls are optional metadata and do not clear the !.
 */
function needsEntry(row: DayRow, asOfDateKey: string) {
  return row.age > 0 && row.mortalityDate <= asOfDateKey && !mortalityEntered(row);
}

/**
 * First past/today day still missing a mortality total after the last day
 * that has one. If none entered yet, the earliest day that needs entry.
 */
function firstUnfilledAfterLastFilled(rows: DayRow[], asOfDateKey: string): DayRow | null {
  let lastFilledAge = -1;
  for (const row of rows) {
    if (mortalityEntered(row)) lastFilledAge = Math.max(lastFilledAge, row.age);
  }
  const afterLast = rows.find((r) => r.age > lastFilledAge && needsEntry(r, asOfDateKey));
  if (afterLast) return afterLast;
  if (lastFilledAge < 0) {
    return rows.find((r) => needsEntry(r, asOfDateKey)) ?? null;
  }
  return null;
}

function focusMortalityAge(age: number, field: "culls" | "mortality" = "mortality") {
  const el = document.querySelector<HTMLElement>(`[data-mort-nav="${field}-${age}"]`);
  if (!el) return false;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.focus();
  return true;
}

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

function buildRows(
  placementDate: string,
  catchDate: string,
  house: MortalityHousePayload,
  asOfDateKey: string,
): DayRow[] {
  const placement = parseLocalDate(placementDate);
  const catchEnd = parseLocalDate(catchDate);
  const asOf = parseLocalDate(asOfDateKey);
  const maxAge = Math.max(
    birdAgeFromPlacement(placement, asOf),
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
      // Blank until entered — don't seed "0" or clearing one cell leaves a phantom zero
      dailyMortalityCount: existing ? String(existing.dailyMortalityCount) : "",
      cullCount: existing ? String(existing.cullCount) : "",
      hasEntry: Boolean(existing),
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
        // Loss = mortality total only (culls are not added)
        loss: mortality,
        ageStart: weekRows[0]!.age,
        ageEnd: weekRows[weekRows.length - 1]!.age,
      };
    });
}

export function MortalityEntryForm({
  farms,
  initialFarmId,
  initialHouseFlockId,
  asOfDateKey,
}: {
  farms: MortalityFarmPayload[];
  initialFarmId?: string;
  initialHouseFlockId?: string;
  /** yyyy-MM-dd from the server so SSR and hydrate agree on bird age / needs-entry. */
  asOfDateKey: string;
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
    // Don't auto-select a house when only a farm is chosen
    return "";
  });
  const jumpOnHouseLoadRef = useRef(Boolean(initialHouseFlockId));

  const house = useMemo(
    () => houses.find((h) => h.houseFlockId === houseFlockId) ?? null,
    [houses, houseFlockId],
  );

  const [rows, setRows] = useState<DayRow[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  /** Bumps to re-run house load/jump when the same house is re-selected. */
  const [jumpToken, setJumpToken] = useState(0);
  /** Bumps to retry focus after exclusive week expand (Enter / jump). */
  const [focusToken, setFocusToken] = useState(0);
  const [activeField, setActiveField] = useState<{
    kind: "culls" | "mortality";
    age: number;
  } | null>(null);
  const [replaceOnType, setReplaceOnType] = useState(false);
  const { setKeypadOpen } = useKeypadNav();
  const pendingJumpRef = useRef<{ age: number; field: "culls" | "mortality" } | null>(null);

  const rowsRef = useRef(rows);
  const flockRef = useRef(flock);
  const houseRef = useRef(house);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveGenRef = useRef(0);
  const dirtyRef = useRef(false);
  rowsRef.current = rows;
  flockRef.current = flock;
  houseRef.current = house;

  function setMortField(next: { kind: "culls" | "mortality"; age: number } | null) {
    setActiveField(next);
    setKeypadOpen(!!next);
  }

  useEffect(() => {
    return () => setKeypadOpen(false);
  }, [setKeypadOpen]);

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

    const entered = currentRows.filter((r) => r.hasEntry);
    const clearDates = currentRows.filter((r) => !r.hasEntry).map((r) => r.mortalityDate);
    if (entered.length === 0 && clearDates.length === 0) {
      setSaveStatus("idle");
      return;
    }

    const result = await saveMortalityHouseSeriesAction({
      flockId: currentFlock.id,
      houseFlockId: currentHouse.houseFlockId,
      mortalityCause: "UNKNOWN",
      comments: null,
      isDraft: false,
      entries: entered.map((r) => ({
        mortalityDate: r.mortalityDate,
        dailyMortalityCount: Number(r.dailyMortalityCount || 0),
        cullCount: Number(r.cullCount || 0),
      })),
      clearDates,
    });

    if (gen !== saveGenRef.current) return;

    if (result?.error) {
      setError(result.error);
      setSaveStatus("idle");
      return;
    }

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

  // Keep house selection valid when farm changes — clear invalid house, don't auto-pick
  useEffect(() => {
    if (!flock || houses.length === 0) {
      setHouseFlockId("");
      setRows([]);
      return;
    }
    if (houseFlockId && !houses.some((h) => h.houseFlockId === houseFlockId)) {
      setHouseFlockId("");
    }
  }, [farmId, flock?.id, houses, houseFlockId]);

  useEffect(() => {
    cancelScheduledSave();
    saveGenRef.current += 1;
    dirtyRef.current = false;
    setSaveStatus("idle");
    setError(null);
    pendingJumpRef.current = null;

    if (!flock || !house) {
      setRows([]);
      setExpandedWeeks(new Set());
      return;
    }

    const catchDate = resolveCatchDateKey(flock);
    const built = buildRows(flock.placementDate, catchDate, house, asOfDateKey);
    setRows(built);
    const shouldJump = jumpOnHouseLoadRef.current;
    jumpOnHouseLoadRef.current = true;
    const currentWeek = flockWeekFromAge(
      birdAgeFromPlacement(parseLocalDate(flock.placementDate), parseLocalDate(asOfDateKey)),
    );
    if (!shouldJump) {
      setExpandedWeeks(new Set([currentWeek]));
      return;
    }
    const jumpTo =
      firstUnfilledAfterLastFilled(built, asOfDateKey) ??
      built.find((r) => r.mortalityDate === asOfDateKey) ??
      null;
    const openWeek = jumpTo ? flockWeekFromAge(jumpTo.age) : currentWeek;
    // Exclusive accordion: only the jump target week stays open
    setExpandedWeeks(new Set([openWeek]));
    if (jumpTo) {
      pendingJumpRef.current = { age: jumpTo.age, field: "mortality" };
      setFocusToken((t) => t + 1);
    }
  }, [
    farmId,
    flock?.id,
    flock?.placementDate,
    flock?.projectedCatchDate,
    flock?.targetMarketAge,
    house?.houseFlockId,
    asOfDateKey,
    jumpToken,
  ]);

  useLayoutEffect(() => {
    const pending = pendingJumpRef.current;
    if (!pending) return;
    const { age, field } = pending;
    const tryFocus = () => focusMortalityAge(age, field);
    if (tryFocus()) {
      pendingJumpRef.current = null;
      return;
    }
    // Week panel may need one frame after exclusive expand
    const id = window.setTimeout(() => {
      if (tryFocus()) pendingJumpRef.current = null;
      else {
        window.setTimeout(() => {
          tryFocus();
          pendingJumpRef.current = null;
        }, 120);
      }
    }, 40);
    return () => window.clearTimeout(id);
  }, [rows, expandedWeeks, houseFlockId, focusToken]);

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
      const next = prev.map((r) => {
        if (r.age !== age) return r;
        const cullCount = patch.cullCount !== undefined ? patch.cullCount : r.cullCount;
        const dailyMortalityCount =
          patch.dailyMortalityCount !== undefined
            ? patch.dailyMortalityCount
            : r.dailyMortalityCount;
        const hasMort = dailyMortalityCount !== "";
        const hasCull = cullCount !== "";
        return {
          ...r,
          cullCount,
          dailyMortalityCount,
          hasEntry: hasMort || hasCull,
        };
      });
      rowsRef.current = next;
      return next;
    });
    setSaveStatus("idle");
    scheduleSave();
  }

  function focusAgeInColumn(field: "culls" | "mortality", age: number) {
    if (!rowsRef.current.some((r) => r.age === age)) return;
    const week = flockWeekFromAge(age);
    const row = rowsRef.current.find((r) => r.age === age);
    const value = field === "culls" ? row?.cullCount ?? "" : row?.dailyMortalityCount ?? "";
    setMortField({ kind: field, age });
    setReplaceOnType(value === "" || value === "0");
    setExpandedWeeks(new Set([week]));
    pendingJumpRef.current = { age, field };
    setFocusToken((t) => t + 1);
  }

  function focusNextInColumn(field: "culls" | "mortality", age: number) {
    focusAgeInColumn(field, age + 1);
  }

  function focusPrevInColumn(field: "culls" | "mortality", age: number) {
    focusAgeInColumn(field, age - 1);
  }

  function getActiveValue() {
    if (!activeField) return "";
    const row = rowsRef.current.find((r) => r.age === activeField.age);
    if (!row) return "";
    return activeField.kind === "culls" ? row.cullCount : row.dailyMortalityCount;
  }

  function setActiveValue(next: string) {
    if (!activeField) return;
    if (activeField.kind === "culls") updateRow(activeField.age, { cullCount: next });
    else updateRow(activeField.age, { dailyMortalityCount: next });
  }

  function onDigit(d: string) {
    if (!activeField || !/^[0-9]$/.test(d)) return;
    const current = getActiveValue();
    const next = replaceOnType ? d : current === "0" ? d : `${current}${d}`;
    setReplaceOnType(false);
    setActiveValue(next);
  }

  function onBackspace() {
    if (!activeField) return;
    const current = getActiveValue();
    if (current === "") {
      focusPrevInColumn(activeField.kind, activeField.age);
      return;
    }
    setReplaceOnType(false);
    setActiveValue(current.slice(0, -1));
  }

  function onEnter() {
    if (!activeField) return;
    flushSave();
    const nextAge = activeField.age + 1;
    if (rowsRef.current.some((r) => r.age === nextAge)) {
      focusNextInColumn(activeField.kind, activeField.age);
    } else {
      setMortField(null);
    }
  }

  function changeFarm(nextFarmId: string) {
    flushSave();
    setFarmId(nextFarmId);
    setSaveStatus("idle");
    setError(null);
    jumpOnHouseLoadRef.current = false;
    pendingJumpRef.current = null;
    setMortField(null);
    setHouseFlockId("");
    setRows([]);
    setExpandedWeeks(new Set());
    router.replace(`/mortality?farmId=${nextFarmId}`);
  }

  function changeHouse(nextHouseId: string) {
    flushSave();
    jumpOnHouseLoadRef.current = true;
    setSaveStatus("idle");
    setError(null);
    // Collapse immediately so only the jump week re-opens after load
    setExpandedWeeks(new Set());
    setMortField(null);
    if (nextHouseId === houseFlockId) {
      setJumpToken((t) => t + 1);
      return;
    }
    setHouseFlockId(nextHouseId);
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
                    "shrink-0 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap",
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
                    "shrink-0 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap",
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
                {format(parseLocalDate(flock.placementDate), "EEE M/d")}
              </span>
              {" · "}
              <span className="font-semibold text-stone-900">
                {birdAgeFromPlacement(
                  parseLocalDate(flock.placementDate),
                  parseLocalDate(asOfDateKey),
                )}
                d
              </span>
            </p>
            {saveStatus === "saving" ? (
              <span className="text-stone-500">Saving…</span>
            ) : saveStatus === "saved" ? (
              <span className="font-medium text-emerald-800">Saved</span>
            ) : null}
          </div>
        ) : flock ? (
          <p className="text-sm text-stone-500">Select a house to enter mortality.</p>
        ) : (
          <p className="text-sm text-amber-800">This farm has no active flock or houses.</p>
        )}
      </div>

      {house && rows.length > 0 ? (
        <div className={cn("space-y-2", activeField && "pb-72")}>
          {weekGroups.map((group) => {
            const open = expandedWeeks.has(group.week);
            return (
              <Card key={group.week} className="!p-0 overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    setMortField(null);
                    toggleWeek(group.week);
                  }}
                  className="flex min-h-11 w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-stone-50"
                  aria-expanded={open}
                >
                  <span className="w-4 shrink-0 text-stone-500" aria-hidden="true">
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
                    Loss <span className="font-semibold text-stone-900">{group.loss}</span>
                  </span>
                </button>

                {open ? (
                  <div className="border-t border-stone-100">
                    <div className="flex items-center bg-stone-100 px-2.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-stone-500">
                      <span className="min-w-0 flex-1">Age / Date</span>
                      <span className="w-16 text-center">Culls</span>
                      <span className="w-16 text-center">Mort</span>
                      <span className="w-[4.25rem] text-right">Loss</span>
                    </div>
                    {group.rows.map((row) => {
                      const loss = Number(row.dailyMortalityCount || 0);
                      const cullActive =
                        activeField?.kind === "culls" && activeField.age === row.age;
                      const mortActive =
                        activeField?.kind === "mortality" && activeField.age === row.age;
                      return (
                        <div
                          key={row.mortalityDate}
                          data-mort-row={row.age}
                          className="flex items-center gap-1 border-t border-stone-100 px-2.5 py-1.5"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold leading-tight text-stone-900">
                              {row.age === 0 ? "Day 0" : `Age ${row.age}`}
                            </p>
                            <p className="text-xs leading-tight text-stone-500">
                              {formatDayLabel(row.mortalityDate)}
                              {row.age === 0 ? " · placement" : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            aria-label={`Culls day ${row.age}`}
                            data-mort-nav={`culls-${row.age}`}
                            onClick={() => focusAgeInColumn("culls", row.age)}
                            className={cn(
                              "h-10 w-16 shrink-0 rounded-lg border bg-white text-center text-base font-semibold tabular-nums text-stone-900",
                              cullActive ? "border-2 border-emerald-700" : "border-stone-300",
                            )}
                          >
                            {row.cullCount}
                          </button>
                          <button
                            type="button"
                            aria-label={`Mortality day ${row.age}`}
                            data-mort-nav={`mortality-${row.age}`}
                            onClick={() => focusAgeInColumn("mortality", row.age)}
                            className={cn(
                              "h-10 w-16 shrink-0 rounded-lg border bg-white text-center text-base font-semibold tabular-nums text-stone-900",
                              mortActive ? "border-2 border-emerald-700" : "border-stone-300",
                            )}
                          >
                            {row.dailyMortalityCount}
                          </button>
                          <div className="flex w-[4.25rem] shrink-0 items-center justify-end pr-0.5">
                            {needsEntry(row, asOfDateKey) ? (
                              <NeedsEntryIcon />
                            ) : mortalityEntered(row) ? (
                              <span className="text-sm font-bold tabular-nums text-stone-900">
                                {loss}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}

      {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

      {activeField ? (
        <div className="fixed inset-x-0 bottom-0 z-50">
          <NumberKeypad
            onDigit={onDigit}
            onBackspace={onBackspace}
            onEnter={onEnter}
            extraAction={
              farmId && house
                ? {
                    label: `Back to House ${house.houseNumber}`,
                    onPress: () => {
                      flushSave();
                      setMortField(null);
                      router.push(`/farms/${farmId}`);
                    },
                  }
                : undefined
            }
          />
        </div>
      ) : null}
    </div>
  );
}
