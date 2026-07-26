import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import {
  getMortalityForm,
  getHouseMortalitySeries,
  saveHouseMortalitySeries,
  saveMortality,
} from "../../src/repos/data";
import { birdAgeFromPlacement, flockWeekFromAge, calcTotalDailyLoss } from "../../src/lib/mortality";
import { addDaysKey, todayKey } from "../../src/lib/ids";
import { colors, styles } from "../../src/theme";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDayLabel(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y!, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
  return `${WEEKDAYS[date.getDay()]} ${m}·${d}`;
}

type DayRow = {
  age: number;
  mortalityDate: string;
  cullCount: string;
  dailyMortalityCount: string;
};

export default function MortalityScreen() {
  const { farmId: farmIdParam } = useLocalSearchParams<{ farmId?: string }>();
  const [mode, setMode] = useState<"today" | "grid">("grid");
  const [date, setDate] = useState(todayKey());
  const [farmId, setFarmId] = useState(farmIdParam ?? "");
  const [houseFlockId, setHouseFlockId] = useState("");
  const [payload, setPayload] = useState<ReturnType<typeof getMortalityForm> | null>(null);
  const [rows, setRows] = useState<DayRow[]>([]);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [todayEntries, setTodayEntries] = useState<
    Record<string, { dailyMortalityCount: string; cullCount: string }>
  >({});

  const selectedFarm = useMemo(
    () => payload?.farms.find((f) => f.id === farmId) ?? payload?.farms[0] ?? null,
    [payload, farmId],
  );

  const houses = selectedFarm?.activeFlock?.houses ?? [];

  const loadFarms = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      const data = getMortalityForm(date, undefined);
      setPayload(data);
      const farm = data.farms.find((f) => f.id === (farmId || farmIdParam)) ?? data.farms[0];
      if (farm) setFarmId(farm.id);
      const firstHouse = farm?.activeFlock?.houses[0]?.houseFlockId ?? "";
      setHouseFlockId((prev) =>
        farm?.activeFlock?.houses.some((h) => h.houseFlockId === prev) ? prev : firstHouse,
      );
      const next: Record<string, { dailyMortalityCount: string; cullCount: string }> = {};
      for (const h of farm?.activeFlock?.houses ?? []) {
        next[h.houseFlockId] = {
          dailyMortalityCount: String(h.existing?.dailyMortalityCount ?? 0),
          cullCount: String(h.existing?.cullCount ?? 0),
        };
      }
      setTodayEntries(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [date, farmId, farmIdParam]);

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
          cullCount: existing ? String(existing.cull_count) : "0",
          dailyMortalityCount: existing ? String(existing.daily_mortality_count) : "0",
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
    if (mode === "grid") loadGrid();
  }, [mode, loadGrid]);

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
      setSavedMsg("Saved on this phone");
      loadGrid();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveToday() {
    if (!selectedFarm?.activeFlock) return;
    setSaving(true);
    setError(null);
    try {
      const res = saveMortality({
        flockId: selectedFarm.activeFlock.id,
        mortalityDate: date,
        entries: selectedFarm.activeFlock.houses.map((h) => ({
          houseFlockId: h.houseFlockId,
          dailyMortalityCount: Number(todayEntries[h.houseFlockId]?.dailyMortalityCount ?? 0),
          cullCount: Number(todayEntries[h.houseFlockId]?.cullCount ?? 0),
          mortalityCause: "UNKNOWN",
        })),
      });
      setSavedMsg(`Saved · age ${res.birdAgeInDays}d · farm total ${res.farmTotal}`);
      loadFarms();
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
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.subtitle}>Offline mortality entry</Text>

      <View style={[styles.row, { marginBottom: 12 }]}>
        <Pressable
          style={[styles.button, mode === "grid" ? null : styles.buttonSecondary, { flex: 1 }]}
          onPress={() => setMode("grid")}
        >
          <Text style={mode === "grid" ? styles.buttonText : styles.buttonSecondaryText}>Age grid</Text>
        </Pressable>
        <Pressable
          style={[styles.button, mode === "today" ? null : styles.buttonSecondary, { flex: 1 }]}
          onPress={() => setMode("today")}
        >
          <Text style={mode === "today" ? styles.buttonText : styles.buttonSecondaryText}>By date</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Farm</Text>
      <View style={[styles.row, { marginBottom: 12 }]}>
        {payload?.farms.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFarmId(f.id)}
            style={[
              styles.button,
              styles.buttonSecondary,
              { paddingHorizontal: 12, minHeight: 44 },
              farmId === f.id ? { backgroundColor: colors.accent } : null,
            ]}
          >
            <Text
              style={[
                styles.buttonSecondaryText,
                farmId === f.id ? { color: "#fff" } : null,
                { fontSize: 14 },
              ]}
            >
              {f.farmName}
            </Text>
          </Pressable>
        ))}
      </View>

      {error ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text> : null}
      {savedMsg ? <Text style={{ color: colors.accentDark, marginBottom: 8, fontWeight: "700" }}>{savedMsg}</Text> : null}

      {!selectedFarm?.activeFlock ? (
        <View style={styles.card}>
          <Text>No active flock on this farm.</Text>
        </View>
      ) : mode === "grid" ? (
        <>
          <Text style={styles.label}>House</Text>
          <View style={[styles.row, { marginBottom: 12 }]}>
            {houses.map((h) => (
              <Pressable
                key={h.houseFlockId}
                onPress={() => setHouseFlockId(h.houseFlockId)}
                style={[
                  styles.button,
                  styles.buttonSecondary,
                  { minHeight: 44, paddingHorizontal: 14 },
                  houseFlockId === h.houseFlockId ? { backgroundColor: colors.accent } : null,
                ]}
              >
                <Text
                  style={[
                    styles.buttonSecondaryText,
                    houseFlockId === h.houseFlockId ? { color: "#fff" } : null,
                  ]}
                >
                  H{h.houseNumber}
                </Text>
              </Pressable>
            ))}
          </View>

          {weekGroups.map((group) => {
            const open = expandedWeeks.has(group.week);
            return (
              <View key={group.week} style={styles.card}>
                <Pressable
                  onPress={() =>
                    setExpandedWeeks((prev) => {
                      const next = new Set(prev);
                      if (next.has(group.week)) next.delete(group.week);
                      else next.add(group.week);
                      return next;
                    })
                  }
                >
                  <Text style={{ fontWeight: "800" }}>
                    {open ? "▾" : "▸"} Week {group.week} · Ages {group.ageStart}–{group.ageEnd}
                  </Text>
                  <Text style={styles.muted}>
                    Culls {group.culls} · Mort {group.mortality} · Total {group.loss}
                  </Text>
                </Pressable>
                {open
                  ? group.rows.map((row) => {
                      const loss = calcTotalDailyLoss(
                        Number(row.dailyMortalityCount || 0),
                        Number(row.cullCount || 0),
                      );
                      return (
                        <View
                          key={row.mortalityDate}
                          style={{
                            marginTop: 10,
                            paddingTop: 10,
                            borderTopWidth: 1,
                            borderTopColor: colors.border,
                          }}
                        >
                          <Text style={{ fontWeight: "700" }}>
                            Age {row.age} · {formatDayLabel(row.mortalityDate)} · Loss {loss}
                          </Text>
                          <View style={styles.row}>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.label}>Culls</Text>
                              <TextInput
                                style={styles.input}
                                keyboardType="number-pad"
                                value={row.cullCount === "0" ? "" : row.cullCount}
                                placeholder="0"
                                onChangeText={(v) => {
                                  const digits = v.replace(/\D/g, "");
                                  setRows((prev) =>
                                    prev.map((r) =>
                                      r.age === row.age
                                        ? { ...r, cullCount: digits === "" ? "0" : digits }
                                        : r,
                                    ),
                                  );
                                }}
                              />
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.label}>Mortality</Text>
                              <TextInput
                                style={styles.input}
                                keyboardType="number-pad"
                                value={row.dailyMortalityCount === "0" ? "" : row.dailyMortalityCount}
                                placeholder="0"
                                onChangeText={(v) => {
                                  const digits = v.replace(/\D/g, "");
                                  setRows((prev) =>
                                    prev.map((r) =>
                                      r.age === row.age
                                        ? {
                                            ...r,
                                            dailyMortalityCount: digits === "" ? "0" : digits,
                                          }
                                        : r,
                                    ),
                                  );
                                }}
                              />
                            </View>
                          </View>
                        </View>
                      );
                    })
                  : null}
              </View>
            );
          })}

          <Pressable style={styles.button} onPress={saveGrid} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save house grid</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
          <TextInput style={styles.input} value={date} onChangeText={setDate} autoCapitalize="none" />
          {houses.map((h) => {
            const e = todayEntries[h.houseFlockId];
            return (
              <View key={h.houseFlockId} style={styles.card}>
                <Text style={{ fontSize: 18, fontWeight: "800" }}>House {h.houseNumber}</Text>
                <Text style={styles.muted}>
                  Placed {h.placedBirdCount.toLocaleString()} · Rem {h.remaining} · Cum {h.cumulative}
                </Text>
                <View style={[styles.row, { marginTop: 10 }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Mortality</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="number-pad"
                      value={e?.dailyMortalityCount ?? "0"}
                      onChangeText={(v) =>
                        setTodayEntries((prev) => ({
                          ...prev,
                          [h.houseFlockId]: { ...prev[h.houseFlockId]!, dailyMortalityCount: v },
                        }))
                      }
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>Culls</Text>
                    <TextInput
                      style={styles.input}
                      keyboardType="number-pad"
                      value={e?.cullCount ?? "0"}
                      onChangeText={(v) =>
                        setTodayEntries((prev) => ({
                          ...prev,
                          [h.houseFlockId]: { ...prev[h.houseFlockId]!, cullCount: v },
                        }))
                      }
                    />
                  </View>
                </View>
              </View>
            );
          })}
          <Pressable style={styles.button} onPress={saveToday} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save all houses</Text>}
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
