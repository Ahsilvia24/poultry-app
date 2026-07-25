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
import { api } from "../../src/api";
import { colors, statusColor, styles } from "../../src/theme";

const CAUSES = [
  "UNKNOWN",
  "EARLY_MORTALITY",
  "LEG_ISSUES",
  "FLIP_OVER",
  "HEART_RELATED",
  "RESPIRATORY",
  "ENTERITIS",
  "COCCIDIOSIS",
  "HEAT_STRESS",
  "COLD_STRESS",
  "EQUIPMENT_ISSUE",
  "SMOTHERING",
  "PREDATOR",
  "CULL",
  "YOLK_INFECTION",
  "BACTERIA",
  "ESCHERICHIA_COLI",
  "OTHER",
];

type HouseRow = {
  houseFlockId: string;
  houseNumber: number;
  placedBirdCount: number;
  existing: {
    dailyMortalityCount: number;
    cullCount: number;
    mortalityCause: string;
    comments: string | null;
  } | null;
  rolling7Day: number;
  cumulative: number;
  cumulativePct: number;
  remaining: number;
};

type MortalityPayload = {
  date: string;
  disclaimer: string;
  farms: Array<{
    id: string;
    farmName: string;
    activeFlock: {
      id: string;
      flockNumber: string;
      houses: HouseRow[];
    } | null;
  }>;
};

type EntryState = {
  dailyMortalityCount: string;
  cullCount: string;
  mortalityCause: string;
  comments: string;
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function MortalityScreen() {
  const { farmId: farmIdParam } = useLocalSearchParams<{ farmId?: string }>();
  const [date, setDate] = useState(todayISO());
  const [farmId, setFarmId] = useState(farmIdParam ?? "");
  const [payload, setPayload] = useState<MortalityPayload | null>(null);
  const [entries, setEntries] = useState<Record<string, EntryState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    farmTotal: number;
    houseSummaries: Array<{
      houseNumber: number;
      today: number;
      sevenDay: number;
      cumulative: number;
      cumulativePct: number;
      status: string;
    }>;
    disclaimer: string;
    birdAgeInDays: number;
  } | null>(null);

  const selectedFarm = useMemo(
    () => payload?.farms.find((f) => f.id === farmId) ?? payload?.farms[0] ?? null,
    [payload, farmId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const q = new URLSearchParams({ date });
      if (farmId) q.set("farmId", farmId);
      const data = await api<MortalityPayload>(`/api/mobile/mortality?${q.toString()}`);
      setPayload(data);
      const farm = data.farms.find((f) => f.id === (farmId || farmIdParam)) ?? data.farms[0];
      if (farm && !farmId) setFarmId(farm.id);
      const next: Record<string, EntryState> = {};
      for (const h of farm?.activeFlock?.houses ?? []) {
        next[h.houseFlockId] = {
          dailyMortalityCount: String(h.existing?.dailyMortalityCount ?? 0),
          cullCount: String(h.existing?.cullCount ?? 0),
          mortalityCause: h.existing?.mortalityCause ?? "UNKNOWN",
          comments: h.existing?.comments ?? "",
        };
      }
      setEntries(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [date, farmId, farmIdParam]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(isDraft = false) {
    if (!selectedFarm?.activeFlock) return;
    setSaving(true);
    setError(null);
    try {
      const body = {
        flockId: selectedFarm.activeFlock.id,
        mortalityDate: date,
        entries: selectedFarm.activeFlock.houses.map((h) => ({
          houseFlockId: h.houseFlockId,
          dailyMortalityCount: Number(entries[h.houseFlockId]?.dailyMortalityCount ?? 0),
          cullCount: Number(entries[h.houseFlockId]?.cullCount ?? 0),
          mortalityCause: entries[h.houseFlockId]?.mortalityCause ?? "UNKNOWN",
          comments: entries[h.houseFlockId]?.comments || null,
          isDraft,
        })),
      };
      const res = await api<typeof result & { success: boolean }>("/api/mobile/mortality", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setResult(res);
      await load();
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
      <Text style={styles.subtitle}>Fast entry for farm visits</Text>

      <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} autoCapitalize="none" />

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

      {!selectedFarm?.activeFlock ? (
        <View style={styles.card}>
          <Text>No active flock on this farm.</Text>
        </View>
      ) : (
        <>
          <Text style={{ fontWeight: "700", marginBottom: 8 }}>
            Flock {selectedFarm.activeFlock.flockNumber}
          </Text>
          {selectedFarm.activeFlock.houses.map((h) => {
            const e = entries[h.houseFlockId];
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
                        setEntries((prev) => ({
                          ...prev,
                          [h.houseFlockId]: { ...prev[h.houseFlockId], dailyMortalityCount: v },
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
                        setEntries((prev) => ({
                          ...prev,
                          [h.houseFlockId]: { ...prev[h.houseFlockId], cullCount: v },
                        }))
                      }
                    />
                  </View>
                </View>
                <Text style={styles.label}>Cause (tap to cycle)</Text>
                <Pressable
                  style={[styles.button, styles.buttonSecondary, { marginBottom: 12 }]}
                  onPress={() => {
                    const current = e?.mortalityCause ?? "UNKNOWN";
                    const idx = CAUSES.indexOf(current);
                    const next = CAUSES[(idx + 1) % CAUSES.length];
                    setEntries((prev) => ({
                      ...prev,
                      [h.houseFlockId]: { ...prev[h.houseFlockId], mortalityCause: next },
                    }));
                  }}
                >
                  <Text style={styles.buttonSecondaryText}>{e?.mortalityCause ?? "UNKNOWN"}</Text>
                </Pressable>
                <Text style={styles.label}>Comments</Text>
                <TextInput
                  style={[styles.input, { minHeight: 64 }]}
                  multiline
                  value={e?.comments ?? ""}
                  onChangeText={(v) =>
                    setEntries((prev) => ({
                      ...prev,
                      [h.houseFlockId]: { ...prev[h.houseFlockId], comments: v },
                    }))
                  }
                />
              </View>
            );
          })}

          <Pressable style={styles.button} onPress={() => save(false)} disabled={saving}>
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Save all houses</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.button, styles.buttonSecondary, { marginTop: 10 }]}
            onPress={() => save(true)}
            disabled={saving}
          >
            <Text style={styles.buttonSecondaryText}>Save draft</Text>
          </Pressable>
        </>
      )}

      {result ? (
        <View style={[styles.card, { marginTop: 16 }]}>
          <Text style={{ fontWeight: "800", fontSize: 16 }}>Saved — bird age {result.birdAgeInDays}d</Text>
          <Text style={{ marginTop: 6 }}>Farm total today: {result.farmTotal}</Text>
          {result.houseSummaries.map((h) => {
            const sc = statusColor(h.status);
            return (
              <View key={h.houseNumber} style={{ marginTop: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ fontWeight: "700" }}>House {h.houseNumber}</Text>
                  <Text style={[styles.badge, { backgroundColor: sc.bg, color: sc.fg }]}>{h.status}</Text>
                </View>
                <Text>
                  Today {h.today} · 7d {h.sevenDay} · Cum {h.cumulative} ({h.cumulativePct.toFixed(2)}%)
                </Text>
              </View>
            );
          })}
          <Text style={[styles.muted, { marginTop: 12 }]}>{result.disclaimer}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}
