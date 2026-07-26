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

  const selectedFarm = useMemo(
    () => payload?.farms.find((f) => f.id === farmId) ?? payload?.farms[0] ?? null,
    [payload, farmId],
  );

  const houses = selectedFarm?.activeFlock?.houses ?? [];

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

  const gridTotals = useMemo(() => {
    let culls = 0;
    let mortality = 0;
    for (const r of rows) {
      culls += Number(r.cullCount || 0);
      mortality += Number(r.dailyMortalityCount || 0);
    }
    return { culls, mortality, loss: culls + mortality };
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
      setSavedMsg("Saved");
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
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
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
                }}
              />
            ))}
          </ChipScroller>
        ) : null}

        {error ? <Text style={{ color: colors.danger, marginBottom: 8 }}>{error}</Text> : null}
        {savedMsg ? (
          <Text style={{ color: colors.accentDark, marginBottom: 8, fontWeight: "700" }}>
            {savedMsg}
          </Text>
        ) : null}

        {!selectedFarm?.activeFlock ? (
          <Card>
            <Text>Add an active farm with a flock to enter mortality.</Text>
          </Card>
        ) : (
          <>
            <Card style={{ marginBottom: 12 }}>
              <Text style={{ fontWeight: "700", color: colors.muted, fontSize: 13 }}>
                House totals
              </Text>
              <Text style={{ marginTop: 6, fontWeight: "800", fontSize: 16 }}>
                Culls {gridTotals.culls} · Mort {gridTotals.mortality} · Loss {gridTotals.loss}
              </Text>
            </Card>

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
                              style={gridInput}
                              keyboardType="number-pad"
                              value={row.cullCount}
                              placeholder="0"
                              placeholderTextColor="#a8a29e"
                              onChangeText={(v) => {
                                const digits = v.replace(/\D/g, "");
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.age === row.age ? { ...r, cullCount: digits } : r,
                                  ),
                                );
                              }}
                            />
                            <TextInput
                              style={gridInput}
                              keyboardType="number-pad"
                              value={row.dailyMortalityCount}
                              placeholder="0"
                              placeholderTextColor="#a8a29e"
                              onChangeText={(v) => {
                                const digits = v.replace(/\D/g, "");
                                setRows((prev) =>
                                  prev.map((r) =>
                                    r.age === row.age
                                      ? { ...r, dailyMortalityCount: digits }
                                      : r,
                                  ),
                                );
                              }}
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
