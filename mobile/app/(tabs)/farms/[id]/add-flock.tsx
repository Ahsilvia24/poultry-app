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
import { getDefaultMarketAgeDays } from "../../../../src/lib/appSettings";
import { addDaysKey, todayKey } from "../../../../src/lib/ids";
import { colors, styles } from "../../../../src/theme";
import { BackHeader, Card, PrimaryButton } from "../../../../src/components/ui";
import { DatePickerField } from "../../../../src/components/DatePickerField";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

const DEFAULT_PLACED = 29700;

export default function AddFlockScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const farmId = paramId(params.id);
  const [datePicker, setDatePicker] = useState<"placement" | null>(null);

  const detail = useMemo(() => {
    try {
      return getFarmDetail(farmId);
    } catch {
      return null;
    }
  }, [farmId]);

  const houses = detail?.houses ?? [];
  const occupiedHouseIds = useMemo(
    () => new Set(houses.filter((h) => h.placedBirdCount != null).map((h) => h.id)),
    [houses],
  );
  const availableHouses = houses.filter((h) => !occupiedHouseIds.has(h.id));
  const activeFlockCount = detail?.activeFlocks?.length ?? (detail?.activeFlock ? 1 : 0);

  const [flockNumber, setFlockNumber] = useState("");
  const [placementDate, setPlacementDate] = useState(todayKey());
  const [placements, setPlacements] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const h of houses) {
      // Empty by default so unplaced houses can stay empty; available houses get a starter count.
      init[h.id] = occupiedHouseIds.has(h.id) ? "" : String(DEFAULT_PLACED);
    }
    return init;
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstOpenHouse = availableHouses[0] ?? null;
  const [propagate, setPropagate] = useState(false);

  function onPlacementChange(value: string) {
    setPlacementDate(value);
  }

  function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      if (houses.length === 0) {
        throw new Error("Add houses before creating a flock");
      }
      const housePlacements = availableHouses
        .map((h) => ({
          houseId: h.id,
          placedBirdCount: Number(placements[h.id] ?? "0"),
        }))
        .filter((hp) => Number.isFinite(hp.placedBirdCount) && hp.placedBirdCount > 0);

      const marketAge = getDefaultMarketAgeDays();
      createFlock({
        farmId,
        flockNumber,
        placementDate: placementDate.trim(),
        targetMarketAge: marketAge,
        projectedCatchDate: addDaysKey(placementDate.trim(), marketAge),
        housePlacements,
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
          <BackHeader
            backLabel="Farm"
            title="Add Flock"
            onBack={() => router.back()}
            accessibilityLabel="Back to farm"
          />
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
          <BackHeader
            backLabel="Farm"
            title="Add Flock"
            onBack={() => router.back()}
            accessibilityLabel="Back to farm"
          />

          {houses.length === 0 ? (
            <Card>
              <Text style={styles.muted}>Add houses before creating a flock.</Text>
            </Card>
          ) : (
            <Card>
              {activeFlockCount > 0 ? (
                <Text style={[styles.muted, { marginBottom: 12 }]}>
                  This farm already has {activeFlockCount} active flock
                  {activeFlockCount === 1 ? "" : "s"}. Place only the houses for this
                  placement date — leave others empty.
                </Text>
              ) : null}

              <Text style={styles.label}>Flock number *</Text>
              <TextInput
                style={styles.input}
                value={flockNumber}
                onChangeText={setFlockNumber}
                autoCapitalize="characters"
                placeholder="e.g. 26-01"
                placeholderTextColor={colors.muted}
              />

              <View style={{ marginTop: 8 }}>
                <DatePickerField
                  label="Placement date"
                  value={placementDate}
                  expanded={datePicker === "placement"}
                  onOpen={() => setDatePicker("placement")}
                  onChange={onPlacementChange}
                />
              </View>

              <Text
                style={[
                  styles.label,
                  { marginTop: 16, marginBottom: 4, textTransform: "none", fontSize: 14 },
                ]}
              >
                Birds placed per house
              </Text>
              <Text style={[styles.muted, { marginBottom: 8 }]}>
                Leave a house at 0 / blank to keep it empty for this flock.
              </Text>
              {houses.map((h) => {
                const occupied = occupiedHouseIds.has(h.id);
                const isFirstOpen = firstOpenHouse?.id === h.id;
                return (
                  <View key={h.id} style={{ marginBottom: 8 }}>
                    <Text style={styles.label}>
                      House {h.houseNumber}
                      {occupied && h.flockNumber ? ` · on flock ${h.flockNumber}` : ""}
                    </Text>
                    {occupied ? (
                      <Text style={[styles.muted, { marginTop: 4 }]}>
                        Already placed — skip for this flock.
                      </Text>
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <TextInput
                          style={[styles.input, { flex: 1, marginBottom: 0 }]}
                          keyboardType="number-pad"
                          value={placements[h.id] ?? ""}
                          onChangeText={(v) =>
                            setPlacements((prev) => {
                              const next = { ...prev, [h.id]: v };
                              if (propagate && firstOpenHouse && h.id === firstOpenHouse.id) {
                                for (const house of availableHouses) {
                                  if (house.id !== h.id) next[house.id] = v;
                                }
                              }
                              return next;
                            })
                          }
                          placeholder="0 = empty"
                          placeholderTextColor={colors.muted}
                        />
                        {isFirstOpen ? (
                          <Pressable
                            onPress={() => {
                              const nextChecked = !propagate;
                              setPropagate(nextChecked);
                              if (!nextChecked || !firstOpenHouse) return;
                              const value = placements[firstOpenHouse.id] ?? String(DEFAULT_PLACED);
                              setPlacements((prev) => {
                                const next = { ...prev };
                                for (const house of availableHouses) next[house.id] = value;
                                return next;
                              });
                            }}
                            style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44 }}
                          >
                            <View
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 4,
                                borderWidth: 1.5,
                                borderColor: colors.accentDark,
                                backgroundColor: propagate ? colors.accentDark : "transparent",
                              }}
                            />
                            <Text style={[styles.muted, { color: colors.text, fontWeight: "700", maxWidth: 120 }]}>
                              Propagate (to the rest of the houses)
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    )}
                  </View>
                );
              })}

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
