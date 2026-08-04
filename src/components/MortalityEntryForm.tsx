"use client";

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";
import { useRouter } from "next/navigation";
import { addDays, format } from "date-fns";
import { saveMortalityHouseSeriesAction } from "@/app/actions/mortality";
import {
  birdAgeFromPlacement,
  flockWeekFromAge,
  openWeeksForAge,
} from "@/lib/mortality/calculations";
import { formatNumber } from "@/lib/utils";
import { Card, Input } from "@/components/ui";
import { cn } from "@/lib/utils";

type ActiveField = { field: "culls" | "mortality"; age: number };

function WebMortalityKeypad({
  onDigit,
  onBackspace,
  onEnter,
  onBackToHouse,
  backToHouseLabel,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  onBackToHouse?: () => void;
  backToHouseLabel?: string;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;

  function guard(e: SyntheticEvent) {
    // Keep the focused input from blurring before the key action runs.
    e.preventDefault();
  }

  const keyBase =
    "flex min-h-12 flex-1 items-center justify-center rounded-[10px] text-xl font-bold shadow-sm";

  return (
    <div
      className="fixed inset-x-0 z-50 border-t border-stone-300 bg-stone-200 px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
      style={{ bottom: "calc(3.75rem + env(safe-area-inset-bottom, 0px))" }}
      onMouseDown={guard}
      onPointerDown={guard}
      onTouchStart={guard}
    >
      <div className="mx-auto flex max-w-md flex-col gap-2">
        {onBackToHouse && backToHouseLabel ? (
          <button
            type="button"
            className="flex min-h-12 w-full items-center justify-center rounded-[10px] bg-emerald-800 px-3 text-base font-extrabold text-white active:bg-emerald-900"
            onMouseDown={guard}
            onPointerDown={guard}
            onClick={onBackToHouse}
          >
            {backToHouseLabel}
          </button>
        ) : null}
        {[0, 1, 2].map((row) => (
          <div key={row} className="flex gap-2">
            {keys.slice(row * 3, row * 3 + 3).map((d) => (
              <button
                key={d}
                type="button"
                className={cn(keyBase, "bg-white text-stone-900 active:bg-stone-100")}
                onMouseDown={guard}
                onPointerDown={guard}
                onClick={() => onDigit(d)}
              >
                {d}
              </button>
            ))}
          </div>
        ))}
        <div className="flex gap-2">
          <button
            type="button"
            className={cn(keyBase, "bg-stone-300 text-stone-900 active:bg-stone-400")}
            onMouseDown={guard}
            onPointerDown={guard}
            onClick={onBackspace}
            aria-label="Backspace"
          >
            ⌫
          </button>
          <button
            type="button"
            className={cn(keyBase, "bg-white text-stone-900 active:bg-stone-100")}
            onMouseDown={guard}
            onPointerDown={guard}
            onClick={() => onDigit("0")}
          >
            0
          </button>
          <button
            type="button"
            className={cn(keyBase, "bg-emerald-800 text-white active:bg-emerald-900")}
            onMouseDown={guard}
            onPointerDown={guard}
            onClick={onEnter}
          >
            Enter
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const el = document.querySelector<HTMLInputElement>(`[data-mort-nav="${field}-${age}"]`);
  if (!el) return false;
  // Center the active cell so days/weeks below stay visible while typing.
  el.scrollIntoView({ block: "center", behavior: "smooth", inline: "nearest" });
  el.focus();
  el.select();
  return true;
}

function maxWeekFromRows(list: Array<{ age: number }>) {
  let max = 1;
  for (const row of list) {
    max = Math.max(max, flockWeekFromAge(row.age));
  }
  return max;
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

function isDigitKey(key: string) {
  return key.length === 1 && key >= "0" && key <= "9";
}

function onMortNumberKeyDown(
  e: KeyboardEvent<HTMLInputElement>,
  field: "culls" | "mortality",
  age: number,
  onEnter: (
    e: KeyboardEvent<HTMLInputElement>,
    field: "culls" | "mortality",
    age: number,
  ) => void,
) {
  const allow =
    isDigitKey(e.key) ||
    e.key === "Backspace" ||
    e.key === "Delete" ||
    e.key === "Tab" ||
    e.key === "Enter" ||
    e.key === "Escape" ||
    e.key === "ArrowLeft" ||
    e.key === "ArrowRight" ||
    e.key === "ArrowUp" ||
    e.key === "ArrowDown" ||
    e.key === "Home" ||
    e.key === "End" ||
    ((e.metaKey || e.ctrlKey) &&
      (e.key === "a" || e.key === "c" || e.key === "v" || e.key === "x"));
  if (!allow) {
    e.preventDefault();
    return;
  }
  onEnter(e, field, age);
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
  const [activeField, setActiveField] = useState<ActiveField | null>(null);
  /** Phone / touch web: use the in-app keypad (with Enter) instead of the OS keyboard. */
  const [preferCustomKeypad, setPreferCustomKeypad] = useState(false);
  /** Bumps to re-run house load/jump when the same house is re-selected. */
  const [jumpToken, setJumpToken] = useState(0);
  /** Bumps to retry focus after exclusive week expand (Enter / jump). */
  const [focusToken, setFocusToken] = useState(0);
  const pendingJumpRef = useRef<{ age: number; field: "culls" | "mortality" } | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px), (pointer: coarse)");
    const sync = () => setPreferCustomKeypad(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
    const currentAge = birdAgeFromPlacement(
      parseLocalDate(flock.placementDate),
      parseLocalDate(asOfDateKey),
    );
    const maxWeek = maxWeekFromRows(built);
    if (!shouldJump) {
      setExpandedWeeks(new Set(openWeeksForAge(currentAge, maxWeek)));
      return;
    }
    const jumpTo =
      firstUnfilledAfterLastFilled(built, asOfDateKey) ??
      built.find((r) => r.mortalityDate === asOfDateKey) ??
      null;
    const ageForWeeks = jumpTo?.age ?? currentAge;
    // Keep the active week open and prefetch the next week near day 5–6.
    setExpandedWeeks(new Set(openWeeksForAge(ageForWeeks, maxWeek)));
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

  function expandWeeksForAge(age: number) {
    setExpandedWeeks(new Set(openWeeksForAge(age, maxWeekFromRows(rowsRef.current))));
  }

  function focusNextInColumn(field: "culls" | "mortality", age: number) {
    const nextAge = age + 1;
    if (!rowsRef.current.some((r) => r.age === nextAge)) {
      setActiveField(null);
      return;
    }

    // Open the destination week, and prefetch the following week near day 5–6.
    expandWeeksForAge(nextAge);
    pendingJumpRef.current = { age: nextAge, field };
    setFocusToken((t) => t + 1);
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

  function activeRowValue() {
    if (!activeField) return "";
    const row = rowsRef.current.find((r) => r.age === activeField.age);
    if (!row) return "";
    return activeField.field === "culls" ? row.cullCount : row.dailyMortalityCount;
  }

  function onKeypadDigit(d: string) {
    if (!activeField || !/^[0-9]$/.test(d)) return;
    const next = digitsOnly(`${activeRowValue()}${d}`);
    if (activeField.field === "culls") {
      updateRow(activeField.age, { cullCount: next });
    } else {
      updateRow(activeField.age, { dailyMortalityCount: next });
    }
  }

  function onKeypadBackspace() {
    if (!activeField) return;
    const current = activeRowValue();
    const next = current.slice(0, -1);
    if (activeField.field === "culls") {
      updateRow(activeField.age, { cullCount: next });
    } else {
      updateRow(activeField.age, { dailyMortalityCount: next });
    }
  }

  function onKeypadEnter() {
    if (!activeField) return;
    flushSave();
    focusNextInColumn(activeField.field, activeField.age);
  }

  function onKeypadBackToHouse() {
    if (!farmId || !house) return;
    flushSave();
    setActiveField(null);
    router.push(`/farms/${farmId}`);
  }

  function focusEntryField(
    field: "culls" | "mortality",
    age: number,
    target: HTMLInputElement,
  ) {
    setActiveField({ field, age });
    expandWeeksForAge(age);
    target.select();
    requestAnimationFrame(() => focusMortalityAge(age, field));
  }

  function changeFarm(nextFarmId: string) {
    flushSave();
    setFarmId(nextFarmId);
    setSaveStatus("idle");
    setError(null);
    jumpOnHouseLoadRef.current = false;
    pendingJumpRef.current = null;
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
    if (nextHouseId === houseFlockId) {
      setJumpToken((t) => t + 1);
      return;
    }
    setHouseFlockId(nextHouseId);
    router.replace(`/mortality?farmId=${farmId}&houseFlockId=${nextHouseId}`);
  }

  const showKeypad = preferCustomKeypad && activeField != null;

  return (
    <div className={cn("space-y-4", showKeypad && "pb-80")}>
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
        <div className="space-y-0">
          {weekGroups.map((group) => {
            const open = expandedWeeks.has(group.week);
            return (
              <Card key={group.week} className="!p-0 overflow-hidden rounded-xl">
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
                    Loss <span className="font-semibold text-stone-900">{group.loss}</span>
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
                            <th className="px-3 py-2 text-right font-semibold text-stone-600">
                              Loss
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row) => {
                            const loss = Number(row.dailyMortalityCount || 0);
                            return (
                              <tr
                                key={row.mortalityDate}
                                data-mort-row={row.age}
                                className="border-b border-stone-100"
                              >
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
                                    inputMode={preferCustomKeypad ? "none" : "numeric"}
                                    readOnly={preferCustomKeypad}
                                    pattern="[0-9]*"
                                    enterKeyHint="next"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className={cn(
                                      "min-h-11 px-3",
                                      activeField?.field === "culls" &&
                                        activeField.age === row.age &&
                                        "border-emerald-700 ring-2 ring-emerald-200",
                                    )}
                                    placeholder=""
                                    value={row.cullCount}
                                    onFocus={(e) => focusEntryField("culls", row.age, e.target)}
                                    onBlur={() => {
                                      flushSave();
                                      // Delay so keypad taps can run before we hide it.
                                      window.setTimeout(() => {
                                        const next = document.activeElement as HTMLElement | null;
                                        if (!next?.dataset?.mortNav) setActiveField(null);
                                      }, 0);
                                    }}
                                    onKeyDown={(e) =>
                                      onMortNumberKeyDown(e, "culls", row.age, onColumnEnter)
                                    }
                                    onPaste={(e) => {
                                      e.preventDefault();
                                      const digits = digitsOnly(
                                        e.clipboardData.getData("text") || "",
                                      );
                                      updateRow(row.age, { cullCount: digits });
                                    }}
                                    onChange={(e) => {
                                      if (preferCustomKeypad) return;
                                      updateRow(row.age, {
                                        cullCount: digitsOnly(e.target.value),
                                      });
                                    }}
                                  />
                                </td>
                                <td className="px-2 py-1.5">
                                  <Input
                                    aria-label={`Mortality day ${row.age}`}
                                    data-mort-nav={`mortality-${row.age}`}
                                    type="text"
                                    inputMode={preferCustomKeypad ? "none" : "numeric"}
                                    readOnly={preferCustomKeypad}
                                    pattern="[0-9]*"
                                    enterKeyHint="next"
                                    autoComplete="off"
                                    autoCorrect="off"
                                    spellCheck={false}
                                    className={cn(
                                      "min-h-11 px-3",
                                      activeField?.field === "mortality" &&
                                        activeField.age === row.age &&
                                        "border-emerald-700 ring-2 ring-emerald-200",
                                    )}
                                    placeholder=""
                                    value={row.dailyMortalityCount}
                                    onFocus={(e) =>
                                      focusEntryField("mortality", row.age, e.target)
                                    }
                                    onBlur={() => {
                                      flushSave();
                                      window.setTimeout(() => {
                                        const next = document.activeElement as HTMLElement | null;
                                        if (!next?.dataset?.mortNav) setActiveField(null);
                                      }, 0);
                                    }}
                                    onKeyDown={(e) =>
                                      onMortNumberKeyDown(e, "mortality", row.age, onColumnEnter)
                                    }
                                    onPaste={(e) => {
                                      e.preventDefault();
                                      const digits = digitsOnly(
                                        e.clipboardData.getData("text") || "",
                                      );
                                      updateRow(row.age, { dailyMortalityCount: digits });
                                    }}
                                    onChange={(e) => {
                                      if (preferCustomKeypad) return;
                                      updateRow(row.age, {
                                        dailyMortalityCount: digitsOnly(e.target.value),
                                      });
                                    }}
                                  />
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-stone-800">
                                  {needsEntry(row, asOfDateKey) ? (
                                    <NeedsEntryIcon />
                                  ) : mortalityEntered(row) ? (
                                    loss
                                  ) : null}
                                </td>
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

      {showKeypad ? (
        <WebMortalityKeypad
          onDigit={onKeypadDigit}
          onBackspace={onKeypadBackspace}
          onEnter={onKeypadEnter}
          backToHouseLabel={
            house ? `Back to House ${house.houseNumber}` : undefined
          }
          onBackToHouse={farmId && house ? onKeypadBackToHouse : undefined}
        />
      ) : null}
    </div>
  );
}
