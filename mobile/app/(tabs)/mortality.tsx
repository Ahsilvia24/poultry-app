import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInput as TextInputType,
  type ScrollView as ScrollViewType,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getMortalityForm,
  getHouseMortalitySeries,
  saveHouseMortalitySeries,
} from "../../src/repos/data";
import {
  birdAgeFromPlacement,
  flockWeekFromAge,
  openWeeksForAge,
} from "../../src/lib/mortality";
import { addDaysKey, todayKey } from "../../src/lib/ids";
import {
  getFarmNavContext,
  setFarmNavContext,
} from "../../src/lib/farmNavContext";
import { useTabScrollToTop } from "../../src/lib/tabScroll";
import { colors, styles } from "../../src/theme";
import {
  Card,
  Chip,
  PageHeader,
  formatNumber,
} from "../../src/components/ui";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SAVE_DEBOUNCE_MS = 500;

function formatDayLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  return `${WEEKDAYS[date.getDay()]} ${m}/${d}`;
}

type DayRow = {
  age: number;
  mortalityDate: string;
  cullCount: string;
  dailyMortalityCount: string;
  /** True once a saved record exists or the tech edits this day. */
  hasEntry: boolean;
};

function NeedsEntryIcon() {
  return (
    <View
      accessibilityLabel="Mortality needs entry"
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: "#facc15",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ fontWeight: "900", fontSize: 13, color: "#713f12", lineHeight: 16 }}>!</Text>
    </View>
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
function needsEntry(row: DayRow, today: string) {
  return row.age > 0 && row.mortalityDate <= today && !mortalityEntered(row);
}

/**
 * First past/today day still missing a mortality total after the last day
 * that has one. If none entered yet, the earliest day that needs entry.
 */
function firstUnfilledAfterLastFilled(rows: DayRow[], today: string): DayRow | null {
  let lastFilledAge = -1;
  for (const row of rows) {
    if (mortalityEntered(row)) lastFilledAge = Math.max(lastFilledAge, row.age);
  }
  const afterLast = rows.find((r) => r.age > lastFilledAge && needsEntry(r, today));
  if (afterLast) return afterLast;
  if (lastFilledAge < 0) {
    return rows.find((r) => needsEntry(r, today)) ?? null;
  }
  return null;
}

type FieldKind = "culls" | "mort";

type ActiveField = {
  kind: FieldKind;
  age: number;
};

function ChipScroller({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginBottom: 10 }}
      contentContainerStyle={{ flexDirection: "row", alignItems: "center", paddingRight: 8 }}
    >
      {children}
    </ScrollView>
  );
}

function fieldKey(kind: FieldKind, age: number) {
  return `${kind}-${age}`;
}

function MortalityKeypad({
  onDigit,
  onBackspace,
  onEnter,
  onBackToHouse,
  backToHouseLabel,
  containerRef,
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  onBackToHouse?: () => void;
  backToHouseLabel?: string;
  containerRef?: RefObject<View | null>;
}) {
  const insets = useSafeAreaInsets();
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
  return (
    <View
      ref={containerRef}
      collapsable={false}
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: "#e7e5e4",
        paddingHorizontal: 8,
        paddingTop: 8,
        // Tabs are hidden while the keypad is open — keep home-indicator padding here
        paddingBottom: Math.max(insets.bottom, 8),
        gap: 8,
      }}
    >
      {onBackToHouse ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={backToHouseLabel ?? "Back to house"}
          onPress={onBackToHouse}
          style={({ pressed }) => ({
            minHeight: 48,
            borderRadius: 10,
            backgroundColor: colors.accentDark,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 12,
            opacity: pressed ? 0.88 : 1,
          })}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>
            {backToHouseLabel ?? "Back to house"}
          </Text>
        </Pressable>
      ) : null}
      {[0, 1, 2].map((row) => (
        <View key={row} style={{ flexDirection: "row", gap: 8 }}>
          {keys.slice(row * 3, row * 3 + 3).map((d) => (
            <Pressable
              key={d}
              onPress={() => onDigit(d)}
              style={keypadKey}
            >
              <Text style={keypadKeyText}>{d}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable onPress={onBackspace} style={[keypadKey, keypadActionKey]}>
          <Text style={keypadKeyText}>⌫</Text>
        </Pressable>
        <Pressable onPress={() => onDigit("0")} style={keypadKey}>
          <Text style={keypadKeyText}>0</Text>
        </Pressable>
        <Pressable onPress={onEnter} style={[keypadKey, keypadEnterKey]}>
          <Text style={[keypadKeyText, { color: "#fff" }]}>Enter</Text>
        </Pressable>
      </View>
    </View>
  );
}

function paramValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function MortalityScreen() {
  const navigation = useNavigation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    farmId?: string | string[];
    houseFlockId?: string | string[];
    /** Changes on every Enter mortality tap so same-house re-entry still jumps. */
    jump?: string | string[];
  }>();
  const farmIdParam = paramValue(params.farmId);
  const houseFlockIdParam = paramValue(params.houseFlockId);
  const jumpParam = paramValue(params.jump);
  const [farmId, setFarmId] = useState(farmIdParam);
  const [houseFlockId, setHouseFlockId] = useState(houseFlockIdParam);
  const [payload, setPayload] = useState<ReturnType<typeof getMortalityForm> | null>(null);
  const [rows, setRows] = useState<DayRow[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [activeField, setActiveField] = useState<ActiveField | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>();
  const inputRefs = useRef(new Map<string, TextInputType>());
  const rowRefs = useRef(new Map<number, View>());
  const scrollRef = useRef<ScrollViewType>(null);
  const scrollHostRef = useRef<View>(null);
  const keypadRef = useRef<View>(null);
  const scrollOffsetRef = useRef(0);
  useTabScrollToTop("mortality", scrollRef);
  const rowsRef = useRef(rows);
  const houseFlockIdRef = useRef(houseFlockId);
  const farmIdRef = useRef(farmId);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveGenRef = useRef(0);
  const jumpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  rowsRef.current = rows;
  houseFlockIdRef.current = houseFlockId;
  farmIdRef.current = farmId;

  /** Persist using refs so we can flush before houseId changes (avoid writing the wrong house). */
  function persistRowsForCurrentHouse() {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const id = houseFlockIdRef.current;
    if (!id) return;
    const snapshot = rowsRef.current;
    if (!snapshot.length) return;
    try {
      saveHouseMortalitySeries({
        houseFlockId: id,
        entries: snapshot
          .filter((r) => r.hasEntry)
          .map((r) => ({
            mortalityDate: r.mortalityDate,
            dailyMortalityCount: Number(r.dailyMortalityCount || 0),
            cullCount: Number(r.cullCount || 0),
          })),
        clearDates: snapshot.filter((r) => !r.hasEntry).map((r) => r.mortalityDate),
      });
    } catch {
      // Best-effort when switching context / unmounting
    }
  }

  // Hide bottom tabs while the custom keypad is open
  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: activeField ? { display: "none" } : undefined,
    });
  }, [activeField, navigation]);

  function clearJumpTimer() {
    if (jumpTimerRef.current) {
      clearTimeout(jumpTimerRef.current);
      jumpTimerRef.current = null;
    }
  }

  function resetKeypad() {
    setActiveField(null);
    setSelection(undefined);
    for (const input of inputRefs.current.values()) {
      input.blur();
    }
  }

  function maxWeekFromRows(list: DayRow[]) {
    let max = 1;
    for (const row of list) {
      max = Math.max(max, flockWeekFromAge(row.age));
    }
    return max;
  }

  function expandWeeksForAge(age: number) {
    const maxWeek = maxWeekFromRows(rowsRef.current);
    // Merge — never auto-collapse weeks already open (avoids jump on week change).
    setExpandedWeeks((prev) => {
      const next = new Set(prev);
      for (const w of openWeeksForAge(age, maxWeek)) {
        next.add(w);
      }
      return next;
    });
  }

  function scrollRowIntoView(age: number, animated = true) {
    const row = rowRefs.current.get(age);
    const scroll = scrollRef.current;
    const host = scrollHostRef.current;
    if (!row || !scroll || !host) return false;

    // Back-to-House + digit pad is taller than the old 260 estimate.
    const FALLBACK_KEYPAD_H = 340;

    const place = (keypadHeight: number) => {
      row.measureInWindow((_rx: number, rowY: number, _rw: number, rowH: number) => {
        host.measureInWindow((_sx: number, scrollY: number, _sw: number, hostH: number) => {
          const keypadH = Math.max(keypadHeight, 1);
          const visibleH = Math.max(120, hostH - keypadH);
          const rowCenter = rowY + rowH / 2;
          // Keep the active row in the upper third of the area above the keypad.
          const targetCenter = scrollY + visibleH * 0.28;
          let delta = rowCenter - targetCenter;
          // Hard guarantee: row bottom must sit above the keypad.
          const keypadTop = scrollY + hostH - keypadH;
          const rowBottom = rowY + rowH;
          const minClearance = 12;
          if (rowBottom > keypadTop - minClearance) {
            delta = Math.max(delta, rowBottom - (keypadTop - minClearance));
          }
          scroll.scrollTo({
            y: Math.max(0, scrollOffsetRef.current + delta),
            animated,
          });
        });
      });
    };

    const keypad = keypadRef.current;
    if (keypad) {
      keypad.measureInWindow((_kx, _ky, _kw, keypadH) =>
        place(keypadH || FALLBACK_KEYPAD_H),
      );
    } else {
      place(FALLBACK_KEYPAD_H);
    }
    return true;
  }

  function pinRowAboveKeypad(age: number) {
    scrollRowIntoView(age, false);
    requestAnimationFrame(() => scrollRowIntoView(age, false));
    for (const ms of [50, 120, 220, 400]) {
      setTimeout(() => scrollRowIntoView(age, false), ms);
    }
  }

  function jumpToFirstUnfilled(nextRows: DayRow[]) {
    clearJumpTimer();
    const today = todayKey();
    const jumpTo =
      firstUnfilledAfterLastFilled(nextRows, today) ??
      nextRows.find((r) => r.mortalityDate === today) ??
      null;
    const todayAge = nextRows.find((r) => r.mortalityDate === today)?.age;
    const fallbackAge =
      todayAge ??
      nextRows[0]?.age ??
      0;
    const ageForWeeks = jumpTo?.age ?? fallbackAge;
    setExpandedWeeks(new Set(openWeeksForAge(ageForWeeks, maxWeekFromRows(nextRows))));
    if (!jumpTo) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      return;
    }
    const age = jumpTo.age;
    const attempt = (triesLeft: number) => {
      jumpTimerRef.current = setTimeout(() => {
        const input = inputRefs.current.get(fieldKey("mort", age));
        if (input) {
          // Mount keypad first, then focus + pin row above it after layout.
          setActiveField({ kind: "mort", age });
          setSelection({ start: 0, end: 0 });
          input.focus();
          pinRowAboveKeypad(age);
          return;
        }
        scrollRowIntoView(age, false);
        if (triesLeft > 0) attempt(triesLeft - 1);
      }, triesLeft >= 6 ? 50 : 100);
    };
    // Extra retries: re-entering the same house remounts week rows after focus.
    attempt(8);
  }

  const selectedFarm = useMemo(
    () => payload?.farms.find((f) => f.id === farmId) ?? payload?.farms[0] ?? null,
    [payload, farmId],
  );

  const houses = selectedFarm?.activeFlock?.houses ?? [];
  const selectedHouse = houses.find((h) => h.houseFlockId === houseFlockId) ?? null;
  const flockAgeDays = selectedHouse?.placementDate
    ? birdAgeFromPlacement(selectedHouse.placementDate, todayKey())
    : selectedFarm?.activeFlock
      ? birdAgeFromPlacement(selectedFarm.activeFlock.placementDate, todayKey())
      : null;

  const jumpOnLoadRef = useRef(true);

  const loadFarms = useCallback(() => {
    // Flush edits for the house currently on screen before farm/house selection changes.
    persistRowsForCurrentHouse();
    setLoading(true);
    setError(null);
    try {
      const data = getMortalityForm(todayKey(), undefined);
      setPayload(data);
      const ctx = getFarmNavContext();
      // Prefer route params, then last-viewed farm from farm detail / house tile.
      const preferred = farmIdParam || ctx.farmId || farmIdRef.current;
      const farm = data.farms.find((f) => f.id === preferred) ?? data.farms[0] ?? null;
      const nextId = farm?.id ?? "";
      const houses = farm?.activeFlock?.houses ?? [];
      const isValid = (id: string) => houses.some((h) => h.houseFlockId === id);

      setFarmId(nextId);

      let nextHouse = "";
      if (houseFlockIdParam && isValid(houseFlockIdParam)) {
        jumpOnLoadRef.current = true;
        nextHouse = houseFlockIdParam;
      } else if (farmIdParam && !houseFlockIdParam) {
        // Farm-level entry: pick a house explicitly
        jumpOnLoadRef.current = false;
        nextHouse = "";
      } else if (
        ctx.houseFlockId &&
        ctx.farmId === nextId &&
        isValid(ctx.houseFlockId)
      ) {
        jumpOnLoadRef.current = true;
        nextHouse = ctx.houseFlockId;
      } else {
        // Do not auto-select a house
        jumpOnLoadRef.current = false;
        nextHouse = isValid(houseFlockIdRef.current) ? houseFlockIdRef.current : "";
      }
      setHouseFlockId(nextHouse);
      // Sync immediately so Farms-tab return works before the useEffect runs.
      if (nextId) {
        setFarmNavContext({
          farmId: nextId,
          houseFlockId: nextHouse || null,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [farmIdParam, houseFlockIdParam]);

  const loadGrid = useCallback((opts?: { jump?: boolean; houseFlockId?: string }) => {
    const shouldJump = opts?.jump ?? jumpOnLoadRef.current;
    jumpOnLoadRef.current = true;
    const id = opts?.houseFlockId || houseFlockIdRef.current || houseFlockId;
    if (!id) {
      setRows([]);
      setExpandedWeeks(new Set());
      return;
    }
    try {
      const series = getHouseMortalitySeries(id);
      const catchEnd = series.projectedCatchDate ?? todayKey();
      const maxAge = Math.max(
        birdAgeFromPlacement(series.placementDate, todayKey()),
        birdAgeFromPlacement(series.placementDate, catchEnd),
      );
      const byDate = new Map(series.records.map((r) => [r.mortality_date, r]));
      const next: DayRow[] = [];
      for (let age = 0; age <= maxAge; age++) {
        const mortalityDate = addDaysKey(series.placementDate, age);
        const existing = byDate.get(mortalityDate);
        next.push({
          age,
          mortalityDate,
          // Keep boxes blank until entered; show "0" only after a confirmed entry
          cullCount: existing ? String(existing.cull_count) : "",
          dailyMortalityCount: existing ? String(existing.daily_mortality_count) : "",
          hasEntry: Boolean(existing),
        });
      }
      setRows(next);
      if (shouldJump) jumpToFirstUnfilled(next);
      else {
        clearJumpTimer();
        resetKeypad();
        const today = todayKey();
        const todayAge = next.find((r) => r.mortalityDate === today)?.age;
        const ageForWeeks = todayAge ?? next[0]?.age ?? 0;
        setExpandedWeeks(new Set(openWeeksForAge(ageForWeeks, maxWeekFromRows(next))));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load grid");
    }
  }, [houseFlockId]);

  const loadGridRef = useRef(loadGrid);
  loadGridRef.current = loadGrid;

  useEffect(() => {
    loadFarms();
  }, [loadFarms]);

  // Landing from farm detail / tab focus: always jump to the entry box when a
  // house is selected — including re-entering the same house (houseFlockId
  // unchanged, so the loadGrid effect alone would not re-run).
  // Important: do NOT depend on loadGrid — its identity changes when the user
  // taps a house chip, which would re-run loadFarms() and clear the selection
  // when sticky farmId params are present without houseFlockId.
  useFocusEffect(
    useCallback(() => {
      resetKeypad();
      loadFarms();
      const houseId = houseFlockIdParam || houseFlockIdRef.current;
      let jumpTimer: ReturnType<typeof setTimeout> | undefined;
      if (houseId) {
        jumpOnLoadRef.current = true;
        jumpTimer = setTimeout(() => {
          loadGridRef.current({ jump: true, houseFlockId: houseId });
        }, 60);
      }
      return () => {
        if (jumpTimer) clearTimeout(jumpTimer);
        clearJumpTimer();
        persistRowsForCurrentHouse();
        setActiveField(null);
        setSelection(undefined);
        navigation.setOptions({ tabBarStyle: undefined });
      };
    }, [farmIdParam, houseFlockIdParam, jumpParam, loadFarms, navigation]),
  );

  useEffect(() => {
    loadGrid();
    setSaveStatus("idle");
    saveGenRef.current += 1;
    return () => clearJumpTimer();
  }, [loadGrid]);

  // Keep Farms-tab return target in sync with the selection on this screen.
  useEffect(() => {
    if (!farmId) return;
    setFarmNavContext({
      farmId,
      houseFlockId: houseFlockId || null,
    });
  }, [farmId, houseFlockId]);

  useEffect(() => {
    return () => {
      persistRowsForCurrentHouse();
    };
  }, []);

  const weekGroups = useMemo(() => {
    const map = new Map<number, DayRow[]>();
    for (const row of rows) {
      const week = flockWeekFromAge(row.age);
      const list = map.get(week) ?? [];
      list.push(row);
      map.set(week, list);
    }
    return Array.from(map.entries())
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
          loss: mortality,
          ageStart: weekRows[0]?.age ?? 0,
          ageEnd: weekRows[weekRows.length - 1]?.age ?? 0,
        };
      });
  }, [rows]);

  function getFieldValue(kind: FieldKind, age: number) {
    const row = rowsRef.current.find((r) => r.age === age);
    if (!row) return "";
    return kind === "culls" ? row.cullCount : row.dailyMortalityCount;
  }

  function flushSave(houseFlockIdOverride?: string) {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const id = houseFlockIdOverride || houseFlockIdRef.current;
    if (!id) return false;
    const gen = ++saveGenRef.current;
    const snapshot = rowsRef.current;
    setSaveStatus("saving");
    setError(null);
    try {
      // Persist entered days (0 is valid); remove days the tech cleared
      saveHouseMortalitySeries({
        houseFlockId: id,
        entries: snapshot
          .filter((r) => r.hasEntry)
          .map((r) => ({
            mortalityDate: r.mortalityDate,
            dailyMortalityCount: Number(r.dailyMortalityCount || 0),
            cullCount: Number(r.cullCount || 0),
          })),
        clearDates: snapshot.filter((r) => !r.hasEntry).map((r) => r.mortalityDate),
      });
      if (gen === saveGenRef.current) setSaveStatus("saved");
      return true;
    } catch (e) {
      if (gen === saveGenRef.current) {
        setSaveStatus("idle");
        setError(e instanceof Error ? e.message : "Save failed");
      }
      return false;
    }
  }

  function scheduleSave() {
    setSaveStatus("idle");
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      flushSave();
    }, SAVE_DEBOUNCE_MS);
  }

  function setFieldValue(kind: FieldKind, age: number, value: string) {
    // Integers only — strip everything that isn't 0-9
    const digits = value.replace(/[^0-9]/g, "");
    setRows((prev) => {
      const next = prev.map((r) => {
        if (r.age !== age) return r;
        const cullCount = kind === "culls" ? digits : r.cullCount;
        const dailyMortalityCount = kind === "mort" ? digits : r.dailyMortalityCount;
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
    scheduleSave();
  }

  function focusField(kind: FieldKind, age: number) {
    // Keep current week open, and prefetch the next week near day 5–6.
    expandWeeksForAge(age);
    const key = fieldKey(kind, age);
    const attempt = (triesLeft: number) => {
      requestAnimationFrame(() => {
        const input = inputRefs.current.get(key);
        if (input) {
          input.focus();
          pinRowAboveKeypad(age);
          return;
        }
        if (triesLeft > 0) {
          setTimeout(() => attempt(triesLeft - 1), 50);
        }
      });
    };
    attempt(4);
  }

  function onFieldFocus(kind: FieldKind, age: number, value: string) {
    expandWeeksForAge(age);
    setActiveField({ kind, age });
    if (value && Number(value) !== 0) {
      const len = value.length;
      // Place caret at the far right for existing non-zero values
      setSelection({ start: len, end: len });
    } else {
      setSelection({ start: 0, end: value.length });
    }
    // Wait for next-week expand + keypad layout, then pin row above keypad.
    pinRowAboveKeypad(age);
  }

  function onDigit(d: string) {
    if (!activeField) return;
    if (!/^[0-9]$/.test(d)) return;
    const current = getFieldValue(activeField.kind, activeField.age);
    const start = selection?.start ?? current.length;
    const end = selection?.end ?? current.length;
    const next = `${current.slice(0, start)}${d}${current.slice(end)}`.replace(/[^0-9]/g, "");
    setFieldValue(activeField.kind, activeField.age, next);
    const caret = Math.min(start + 1, next.length);
    setSelection({ start: caret, end: caret });
  }

  function onBackspace() {
    if (!activeField) return;
    const current = getFieldValue(activeField.kind, activeField.age);
    const start = selection?.start ?? current.length;
    const end = selection?.end ?? current.length;
    let next: string;
    let caret: number;
    if (start !== end) {
      next = `${current.slice(0, start)}${current.slice(end)}`;
      caret = start;
    } else if (start > 0) {
      next = `${current.slice(0, start - 1)}${current.slice(start)}`;
      caret = start - 1;
    } else {
      return;
    }
    setFieldValue(activeField.kind, activeField.age, next);
    setSelection({ start: caret, end: caret });
  }

  function onEnter() {
    if (!activeField) return;
    flushSave();
    const { kind, age } = activeField;
    const nextAge = age + 1;
    if (rowsRef.current.some((r) => r.age === nextAge)) {
      focusField(kind, nextAge);
    } else {
      setActiveField(null);
      inputRefs.current.get(fieldKey(kind, age))?.blur();
    }
  }

  if (loading && !payload) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View ref={scrollHostRef} style={{ flex: 1 }} collapsable={false}>
        <ScrollView
          ref={scrollRef}
          style={styles.screen}
          contentContainerStyle={[styles.content, { paddingBottom: activeField ? 8 : 40 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScrollBeginDrag={resetKeypad}
          onScroll={(e) => {
            scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
        >
          <Pressable onPress={resetKeypad}>
          <PageHeader
            title="Mortality entry"
          />

          <ChipScroller>
            {payload?.farms.map((f) => (
              <Chip
                key={f.id}
                label={f.farmName}
                active={farmId === f.id}
                onPress={() => {
                  persistRowsForCurrentHouse();
                  clearJumpTimer();
                  jumpOnLoadRef.current = false;
                  setFarmId(f.id);
                  setHouseFlockId("");
                  setFarmNavContext({ farmId: f.id, houseFlockId: null });
                  setRows([]);
                  setExpandedWeeks(new Set());
                  setSaveStatus("idle");
                  resetKeypad();
                }}
              />
            ))}
          </ChipScroller>

          {selectedFarm?.activeFlock ? (
            <ChipScroller>
              {houses.map((h) => (
                <Chip
                  key={h.houseFlockId}
                  label={`House ${h.houseNumber}`}
                  active={houseFlockId === h.houseFlockId}
                  onPress={() => {
                    persistRowsForCurrentHouse();
                    jumpOnLoadRef.current = true;
                    setExpandedWeeks(new Set());
                    resetKeypad();
                    setSaveStatus("idle");
                    if (farmId) {
                      setFarmNavContext({
                        farmId,
                        houseFlockId: h.houseFlockId,
                      });
                    }
                    if (h.houseFlockId === houseFlockId) {
                      loadGrid({ jump: true });
                      return;
                    }
                    setHouseFlockId(h.houseFlockId);
                  }}
                />
              ))}
            </ChipScroller>
          ) : null}

          {selectedHouse && selectedFarm?.activeFlock ? (
            <Text style={{ color: colors.muted, marginBottom: 10, fontSize: 14 }}>
              House <Text style={{ fontWeight: "700", color: colors.text }}>{selectedHouse.houseNumber}</Text>
              {" · Placed "}
              {formatNumber(selectedHouse.placedBirdCount)}
              {" · Day 0 "}
              <Text style={{ fontWeight: "700", color: colors.text }}>
                {formatDayLabel(
                  selectedHouse.placementDate ?? selectedFarm.activeFlock.placementDate,
                )}
              </Text>
              {" · "}
              <Text style={{ fontWeight: "700", color: colors.text }}>
                {flockAgeDays != null ? `${flockAgeDays}d` : "—"}
              </Text>
              {saveStatus === "saving" ? (
                <Text style={{ color: colors.muted }}>{"  "}Saving…</Text>
              ) : saveStatus === "saved" ? (
                <Text style={{ fontWeight: "700", color: colors.accentDark }}>{"  "}Saved</Text>
              ) : null}
            </Text>
          ) : null}

          {error ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text> : null}

          {!selectedFarm?.activeFlock ? (
            <Card>
              <Text>Add an active farm with a flock to enter mortality.</Text>
            </Card>
          ) : !houseFlockId ? (
            <Card>
              <Text style={styles.muted}>Select a house to enter mortality.</Text>
            </Card>
          ) : (
            <>
              {weekGroups.map((group) => {
                const open = expandedWeeks.has(group.week);
                return (
                  <Card key={group.week} style={{ padding: 0, overflow: "hidden", marginBottom: 0 }}>
                    <Pressable
                      onPress={() =>
                        setExpandedWeeks((prev) => {
                          const next = new Set(prev);
                          if (next.has(group.week)) next.delete(group.week);
                          else next.add(group.week);
                          return next;
                        })
                      }
                      style={{ padding: 14 }}
                    >
                      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ fontWeight: "800" }}>
                          {open ? "▾" : "▸"} Week {group.week}
                        </Text>
                        <Text style={styles.muted}>
                          Ages {group.ageStart}–{group.ageEnd}
                        </Text>
                      </View>
                      <Text style={[styles.muted, { marginTop: 4 }]}>
                        Culls {group.culls} · Loss {group.loss}
                      </Text>
                    </Pressable>

                    {open ? (
                      <View>
                        <View
                          style={{
                            flexDirection: "row",
                            paddingHorizontal: 10,
                            paddingVertical: 8,
                            backgroundColor: "#f5f5f4",
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                            alignItems: "center",
                          }}
                        >
                          <Text style={[headerCell, { flex: 1.1 }]}>Age / Date</Text>
                          <Text style={[headerCell, { width: 64, textAlign: "center" }]}>Culls</Text>
                          <Text style={[headerCell, { width: 64, textAlign: "center" }]}>Mort</Text>
                          <Text style={[headerCell, { width: 68, textAlign: "right" }]}>Loss</Text>
                        </View>
                        {group.rows.map((row) => {
                          const loss = Number(row.dailyMortalityCount || 0);
                          const cullActive =
                            activeField?.kind === "culls" && activeField.age === row.age;
                          const mortActive =
                            activeField?.kind === "mort" && activeField.age === row.age;
                          const showNeedsEntry = needsEntry(row, todayKey());
                          return (
                            <View
                              key={row.mortalityDate}
                              ref={(r) => {
                                if (r) rowRefs.current.set(row.age, r);
                                else rowRefs.current.delete(row.age);
                              }}
                              collapsable={false}
                              style={{
                                flexDirection: "row",
                                alignItems: "center",
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderTopWidth: 1,
                                borderTopColor: "#f5f5f4",
                              }}
                            >
                              <View style={{ flex: 1.1 }}>
                                <Text style={{ fontWeight: "700", fontSize: 14 }}>
                                  {row.age === 0 ? "Day 0" : `Age ${row.age}`}
                                </Text>
                                <Text style={{ color: colors.muted, fontSize: 12 }}>
                                  {formatDayLabel(row.mortalityDate)}
                                  {row.age === 0 ? " · placement" : ""}
                                </Text>
                              </View>
                              <TextInput
                                ref={(r) => {
                                  if (r) inputRefs.current.set(fieldKey("culls", row.age), r);
                                  else inputRefs.current.delete(fieldKey("culls", row.age));
                                }}
                                style={[gridInput, cullActive ? gridInputActive : null]}
                                showSoftInputOnFocus={false}
                                caretHidden={false}
                                keyboardType="number-pad"
                                value={row.cullCount}
                                placeholder=""
                                selection={cullActive ? selection : undefined}
                                onSelectionChange={(e) => {
                                  if (cullActive) setSelection(e.nativeEvent.selection);
                                }}
                                onFocus={() => onFieldFocus("culls", row.age, row.cullCount)}
                                onChangeText={(v) => setFieldValue("culls", row.age, v)}
                              />
                              <TextInput
                                ref={(r) => {
                                  if (r) inputRefs.current.set(fieldKey("mort", row.age), r);
                                  else inputRefs.current.delete(fieldKey("mort", row.age));
                                }}
                                style={[gridInput, mortActive ? gridInputActive : null]}
                                showSoftInputOnFocus={false}
                                caretHidden={false}
                                keyboardType="number-pad"
                                value={row.dailyMortalityCount}
                                placeholder=""
                                selection={mortActive ? selection : undefined}
                                onSelectionChange={(e) => {
                                  if (mortActive) setSelection(e.nativeEvent.selection);
                                }}
                                onFocus={() =>
                                  onFieldFocus("mort", row.age, row.dailyMortalityCount)
                                }
                                onChangeText={(v) => setFieldValue("mort", row.age, v)}
                              />
                              <View
                                style={{
                                  width: 68,
                                  alignItems: "flex-end",
                                  justifyContent: "center",
                                  paddingRight: 2,
                                }}
                              >
                                {showNeedsEntry ? (
                                  <NeedsEntryIcon />
                                ) : mortalityEntered(row) ? (
                                  <Text
                                    style={{
                                      fontWeight: "700",
                                      fontSize: 14,
                                      paddingRight: 4,
                                      color: colors.text,
                                    }}
                                  >
                                    {loss}
                                  </Text>
                                ) : null}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </Card>
                );
              })}
            </>
          )}
          </Pressable>
        </ScrollView>

        {activeField ? (
          <MortalityKeypad
            containerRef={keypadRef}
            onDigit={onDigit}
            onBackspace={onBackspace}
            onEnter={onEnter}
            backToHouseLabel={
              selectedHouse ? `Back to House ${selectedHouse.houseNumber}` : undefined
            }
            onBackToHouse={
              farmId && selectedHouse
                ? () => {
                    // Must land in SQLite before leaving — don't navigate on failure
                    const saved = flushSave(selectedHouse.houseFlockId);
                    if (!saved) return;
                    resetKeypad();
                    setFarmNavContext({
                      farmId,
                      houseFlockId: selectedHouse.houseFlockId,
                    });
                    router.navigate({
                      pathname: "/(tabs)/farms/[id]",
                      params: {
                        id: farmId,
                        focusHouseFlockId: selectedHouse.houseFlockId,
                      },
                    });
                  }
                : undefined
            }
          />
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const headerCell = {
  fontSize: 11,
  fontWeight: "800" as const,
  color: colors.muted,
  textTransform: "uppercase" as const,
};

const gridInput = {
  width: 64,
  minHeight: 40,
  marginHorizontal: 4,
  borderWidth: 1,
  borderColor: "#d6d3d1",
  borderRadius: 8,
  paddingHorizontal: 8,
  textAlign: "center" as const,
  fontSize: 16,
  backgroundColor: "#fff",
  color: colors.text,
};

const gridInputActive = {
  borderColor: colors.accentDark,
  borderWidth: 2,
};

const keypadKey = {
  flex: 1,
  minHeight: 48,
  borderRadius: 10,
  backgroundColor: "#fff",
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

const keypadActionKey = {
  backgroundColor: "#d6d3d1",
};

const keypadEnterKey = {
  backgroundColor: colors.accentDark,
};

const keypadKeyText = {
  fontSize: 22,
  fontWeight: "700" as const,
  color: colors.text,
};
