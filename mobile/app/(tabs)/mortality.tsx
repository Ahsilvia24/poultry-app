import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  type TextInput as TextInputType,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getMortalityForm,
  getHouseMortalitySeries,
  saveHouseMortalitySeries,
} from "../../src/repos/data";
import { birdAgeFromPlacement, flockWeekFromAge, calcTotalDailyLoss } from "../../src/lib/mortality";
import { addDaysKey, todayKey } from "../../src/lib/ids";
import { colors, styles } from "../../src/theme";
import {
  BrandBar,
  Card,
  Chip,
  PageHeader,
  PrimaryButton,
  formatNumber,
} from "../../src/components/ui";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
};

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
}: {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
}) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"] as const;
  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: "#e7e5e4",
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: 8,
        gap: 8,
      }}
    >
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

export default function MortalityScreen() {
  const { farmId: farmIdParam } = useLocalSearchParams<{ farmId?: string }>();
  const [farmId, setFarmId] = useState(farmIdParam ?? "");
  const [houseFlockId, setHouseFlockId] = useState("");
  const [payload, setPayload] = useState<ReturnType<typeof getMortalityForm> | null>(null);
  const [rows, setRows] = useState<DayRow[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [activeField, setActiveField] = useState<ActiveField | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | undefined>();
  const inputRefs = useRef(new Map<string, TextInputType>());
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const selectedFarm = useMemo(
    () => payload?.farms.find((f) => f.id === farmId) ?? payload?.farms[0] ?? null,
    [payload, farmId],
  );

  const houses = selectedFarm?.activeFlock?.houses ?? [];
  const selectedHouse = houses.find((h) => h.houseFlockId === houseFlockId) ?? null;
  const flockAgeDays = selectedFarm?.activeFlock
    ? birdAgeFromPlacement(selectedFarm.activeFlock.placementDate, todayKey())
    : null;

  const loadFarms = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      const data = getMortalityForm(todayKey(), undefined);
      setPayload(data);
      const farm = data.farms.find((f) => f.id === (farmId || farmIdParam)) ?? data.farms[0];
      if (farm) setFarmId(farm.id);
      const firstHouse = farm?.activeFlock?.houses[0]?.houseFlockId ?? "";
      setHouseFlockId((prev) =>
        farm?.activeFlock?.houses.some((h) => h.houseFlockId === prev) ? prev : firstHouse,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [farmId, farmIdParam]);

  const loadGrid = useCallback(() => {
    if (!houseFlockId) {
      setRows([]);
      return;
    }
    try {
      const series = getHouseMortalitySeries(houseFlockId);
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
          cullCount: existing && existing.cull_count !== 0 ? String(existing.cull_count) : "",
          dailyMortalityCount:
            existing && existing.daily_mortality_count !== 0
              ? String(existing.daily_mortality_count)
              : "",
        });
      }
      setRows(next);
      const currentWeek = flockWeekFromAge(
        birdAgeFromPlacement(series.placementDate, todayKey()),
      );
      setExpandedWeeks(new Set([currentWeek]));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load grid");
    }
  }, [houseFlockId]);

  useEffect(() => {
    loadFarms();
  }, [loadFarms]);

  useEffect(() => {
    loadGrid();
    setActiveField(null);
  }, [loadGrid]);

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
          loss: culls + mortality,
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

  function setFieldValue(kind: FieldKind, age: number, value: string) {
    const digits = value.replace(/\D/g, "");
    setRows((prev) =>
      prev.map((r) =>
        r.age === age
          ? kind === "culls"
            ? { ...r, cullCount: digits }
            : { ...r, dailyMortalityCount: digits }
          : r,
      ),
    );
  }

  function focusField(kind: FieldKind, age: number) {
    const week = flockWeekFromAge(age);
    setExpandedWeeks((prev) => {
      if (prev.has(week)) return prev;
      const next = new Set(prev);
      next.add(week);
      return next;
    });
    const key = fieldKey(kind, age);
    requestAnimationFrame(() => {
      const input = inputRefs.current.get(key);
      input?.focus();
    });
  }

  function onFieldFocus(kind: FieldKind, age: number, value: string) {
    setActiveField({ kind, age });
    setSavedMsg(null);
    if (value && Number(value) !== 0) {
      const len = value.length;
      // Place caret at the far right for existing non-zero values
      setSelection({ start: len, end: len });
    } else {
      setSelection({ start: 0, end: value.length });
    }
  }

  function onDigit(d: string) {
    if (!activeField) return;
    const current = getFieldValue(activeField.kind, activeField.age);
    const start = selection?.start ?? current.length;
    const end = selection?.end ?? current.length;
    const next = `${current.slice(0, start)}${d}${current.slice(end)}`.replace(/\D/g, "");
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
    const { kind, age } = activeField;
    const nextAge = age + 1;
    if (rowsRef.current.some((r) => r.age === nextAge)) {
      focusField(kind, nextAge);
    } else {
      setActiveField(null);
      inputRefs.current.get(fieldKey(kind, age))?.blur();
    }
  }

  async function saveGrid() {
    if (!houseFlockId) return;
    setSaving(true);
    setError(null);
    try {
      saveHouseMortalitySeries({
        houseFlockId,
        entries: rows.map((r) => ({
          mortalityDate: r.mortalityDate,
          dailyMortalityCount: Number(r.dailyMortalityCount || 0),
          cullCount: Number(r.cullCount || 0),
        })),
      });
      setSavedMsg("Saved");
      setActiveField(null);
      loadGrid();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
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
      <View style={{ flex: 1 }}>
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.content, { paddingBottom: activeField ? 8 : 40 }]}
          keyboardShouldPersistTaps="handled"
        >
          <BrandBar />
          <PageHeader
            title="Mortality entry"
            subtitle="Enter mortality by house and bird age"
          />

          <ChipScroller>
            {payload?.farms.map((f) => (
              <Chip
                key={f.id}
                label={f.farmName}
                active={farmId === f.id}
                onPress={() => {
                  setFarmId(f.id);
                  setSavedMsg(null);
                  setActiveField(null);
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
                    setHouseFlockId(h.houseFlockId);
                    setSavedMsg(null);
                    setActiveField(null);
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
              {" · "}
              <Text style={{ fontWeight: "700", color: colors.text }}>
                {flockAgeDays != null ? `${flockAgeDays}d` : "—"}
              </Text>
              {savedMsg ? (
                <Text style={{ fontWeight: "700", color: colors.accentDark }}>
                  {"  "}
                  {savedMsg}
                </Text>
              ) : null}
            </Text>
          ) : null}

          {error ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text> : null}

          {!selectedFarm?.activeFlock ? (
            <Card>
              <Text>Add an active farm with a flock to enter mortality.</Text>
            </Card>
          ) : (
            <>
              {weekGroups.map((group) => {
                const open = expandedWeeks.has(group.week);
                return (
                  <Card key={group.week} style={{ padding: 0, overflow: "hidden" }}>
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
                        Culls {group.culls} · Mort {group.mortality} · Total {group.loss}
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
                          }}
                        >
                          <Text style={[headerCell, { flex: 1.1 }]}>Age / Date</Text>
                          <Text style={[headerCell, { width: 64, textAlign: "center" }]}>Culls</Text>
                          <Text style={[headerCell, { width: 64, textAlign: "center" }]}>Mort</Text>
                          <Text style={[headerCell, { width: 44, textAlign: "right" }]}>Loss</Text>
                        </View>
                        {group.rows.map((row) => {
                          const loss = calcTotalDailyLoss(
                            Number(row.dailyMortalityCount || 0),
                            Number(row.cullCount || 0),
                          );
                          const cullActive =
                            activeField?.kind === "culls" && activeField.age === row.age;
                          const mortActive =
                            activeField?.kind === "mort" && activeField.age === row.age;
                          return (
                            <View
                              key={row.mortalityDate}
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
                                <Text style={{ fontWeight: "700", fontSize: 14 }}>Age {row.age}</Text>
                                <Text style={{ color: colors.muted, fontSize: 12 }}>
                                  {formatDayLabel(row.mortalityDate)}
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
                                placeholder="0"
                                placeholderTextColor="#a8a29e"
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
                                placeholder="0"
                                placeholderTextColor="#a8a29e"
                                selection={mortActive ? selection : undefined}
                                onSelectionChange={(e) => {
                                  if (mortActive) setSelection(e.nativeEvent.selection);
                                }}
                                onFocus={() =>
                                  onFieldFocus("mort", row.age, row.dailyMortalityCount)
                                }
                                onChangeText={(v) => setFieldValue("mort", row.age, v)}
                              />
                              <Text
                                style={{
                                  width: 44,
                                  textAlign: "right",
                                  fontWeight: "700",
                                  fontSize: 14,
                                }}
                              >
                                {loss}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    ) : null}
                  </Card>
                );
              })}

              <PrimaryButton
                label={saving ? "Saving…" : "Save mortality"}
                onPress={saveGrid}
              />
            </>
          )}
        </ScrollView>

        {activeField ? (
          <MortalityKeypad
            onDigit={onDigit}
            onBackspace={onBackspace}
            onEnter={onEnter}
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
