import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { createFlock, getFarmDetail } from "../../../../src/repos/data";
import { addDaysKey, todayKey } from "../../../../src/lib/ids";
import { colors, styles } from "../../../../src/theme";
import { Card, PageHeader, PrimaryButton } from "../../../../src/components/ui";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

const DEFAULT_MARKET_AGE = 52;
const DEFAULT_PLACED = 29700;

export default function AddFlockScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const farmId = paramId(params.id);

  const detail = useMemo(() => {
    try {
      return getFarmDetail(farmId);
    } catch {
      return null;
    }
  }, [farmId]);

  const houses = detail?.houses ?? [];
  const hasActiveFlock = Boolean(detail?.activeFlock);

  const [flockNumber, setFlockNumber] = useState("");
  const [placementDate, setPlacementDate] = useState(todayKey());
  const [marketAge, setMarketAge] = useState(String(DEFAULT_MARKET_AGE));
  const [catchDate, setCatchDate] = useState(
    addDaysKey(todayKey(), DEFAULT_MARKET_AGE),
  );
  const [placements, setPlacements] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const h of houses) init[h.id] = String(DEFAULT_PLACED);
    return init;
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onPlacementChange(value: string) {
    setPlacementDate(value);
    const age = Number(marketAge);
    const days = Number.isFinite(age) && age >= 0 ? Math.floor(age) : DEFAULT_MARKET_AGE;
    if (value) setCatchDate(addDaysKey(value, days));
  }

  function onMarketAgeChange(value: string) {
    setMarketAge(value);
    const age = Number(value);
    if (placementDate && Number.isFinite(age) && age >= 0) {
      setCatchDate(addDaysKey(placementDate, Math.floor(age)));
    }
  }

  function onCatchChange(value: string) {
    setCatchDate(value);
    if (placementDate && value) {
      try {
        const [py, pm, pd] = placementDate.split("-").map(Number);
        const [cy, cm, cd] = value.split("-").map(Number);
        const days = Math.round(
          (Date.UTC(cy!, (cm ?? 1) - 1, cd ?? 1) -
            Date.UTC(py!, (pm ?? 1) - 1, pd ?? 1)) /
            86400000,
        );
        if (Number.isFinite(days) && days >= 0) setMarketAge(String(days));
      } catch {
        /* ignore */
      }
    }
  }

  function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      if (hasActiveFlock) {
        throw new Error("Only one active flock is allowed. Complete the current flock first.");
      }
      if (houses.length === 0) {
        throw new Error("Add houses before creating a flock");
      }
      createFlock({
        farmId,
        flockNumber,
        placementDate: placementDate.trim(),
        targetMarketAge: Number(marketAge) || DEFAULT_MARKET_AGE,
        projectedCatchDate: catchDate.trim() || null,
        housePlacements: houses.map((h) => ({
          houseId: h.id,
          placedBirdCount: Number(placements[h.id] ?? DEFAULT_PLACED),
        })),
      });
      router.replace({ pathname: "/(tabs)/farms/[id]", params: { id: farmId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create flock");
      setBusy(false);
    }
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.content}>
          <Pressable onPress={() => router.back()} style={{ marginBottom: 12 }}>
            <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← Back</Text>
          </Pressable>
          <Text style={{ color: colors.danger }}>Farm not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} style={{ marginBottom: 8 }}>
            <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← Back</Text>
          </Pressable>

          <PageHeader title="Add flock" subtitle={detail.farm.farmName} />

          {hasActiveFlock ? (
            <Card>
              <Text style={{ fontWeight: "700", color: colors.danger }}>
                An active flock already exists. Complete it before placing a new one.
              </Text>
            </Card>
          ) : houses.length === 0 ? (
            <Card>
              <Text style={styles.muted}>Add houses before creating a flock.</Text>
            </Card>
          ) : (
            <Card>
              <Text style={styles.label}>Flock number *</Text>
              <TextInput
                style={styles.input}
                value={flockNumber}
                onChangeText={setFlockNumber}
                autoCapitalize="characters"
                placeholder="e.g. 26-01"
                placeholderTextColor={colors.muted}
              />

              <Text style={[styles.label, { marginTop: 8 }]}>Placement date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={placementDate}
                onChangeText={onPlacementChange}
                autoCapitalize="none"
                placeholder="2026-07-26"
                placeholderTextColor={colors.muted}
              />

              <Text style={[styles.label, { marginTop: 8 }]}>Market age (days)</Text>
              <TextInput
                style={styles.input}
                value={marketAge}
                onChangeText={onMarketAgeChange}
                keyboardType="number-pad"
              />

              <Text style={[styles.label, { marginTop: 8 }]}>Catch date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                value={catchDate}
                onChangeText={onCatchChange}
                autoCapitalize="none"
                placeholder="2026-09-16"
                placeholderTextColor={colors.muted}
              />

              <Text
                style={[
                  styles.label,
                  { marginTop: 16, marginBottom: 4, textTransform: "none", fontSize: 14 },
                ]}
              >
                Birds placed per house
              </Text>
              {houses.map((h) => (
                <View key={h.id} style={{ marginBottom: 8 }}>
                  <Text style={styles.label}>House {h.houseNumber}</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={placements[h.id] ?? String(DEFAULT_PLACED)}
                    onChangeText={(v) =>
                      setPlacements((prev) => ({ ...prev, [h.id]: v }))
                    }
                  />
                </View>
              ))}

              {error ? (
                <Text style={{ color: colors.danger, marginBottom: 12, fontWeight: "600" }}>
                  {error}
                </Text>
              ) : null}

              {busy ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <PrimaryButton label="Create flock" onPress={onSubmit} />
              )}
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
