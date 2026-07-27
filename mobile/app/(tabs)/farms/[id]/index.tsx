import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  deleteHouse,
  deleteVisit,
  getFarmDetail,
  updateHouse,
} from "../../../../src/repos/data";
import { VISIT_TYPE_LABELS } from "../../../../src/lib/visits";
import { colors, styles } from "../../../../src/theme";
import {
  Card,
  Metric,
  PrimaryButton,
  SectionTitle,
  StatusBadge,
  WeeklyMortalityList,
  formatNumber,
  formatPct,
} from "../../../../src/components/ui";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

type FarmDetail = ReturnType<typeof getFarmDetail>;
type HouseRow = FarmDetail["houses"][number];

type HouseEditDraft = {
  id: string;
  houseNumber: string;
  squareFootage: string;
  totalFanCFM: string;
  numberOfFans: string;
};

export default function FarmDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const farmId = paramId(params.id);
  const router = useRouter();
  const [data, setData] = useState<FarmDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingHouse, setEditingHouse] = useState<HouseEditDraft | null>(null);
  const [houseEditError, setHouseEditError] = useState<string | null>(null);
  const [houseSaving, setHouseSaving] = useState(false);

  // Drop previous farm immediately when the route id changes
  useEffect(() => {
    setData(null);
    setError(null);
    setLoading(true);
  }, [farmId]);

  const load = useCallback(() => {
    if (!farmId) {
      setError("Missing farm id");
      setData(null);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      const next = getFarmDetail(farmId);
      setData(next);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Never render a previous farm under a new id
  const ready = data != null && data.farm.id === farmId;

  if (loading && !ready) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.content}>
          <Pressable
            onPress={() => router.replace("/(tabs)/farms")}
            style={{ marginBottom: 12 }}
          >
            <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← Farms</Text>
          </Pressable>
          <Text style={{ color: colors.danger }}>{error ?? "Farm not found"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { farm } = data;
  const flockAge = data.activeFlock?.flockAgeDays ?? null;
  const birdsPlaced = data.houses.reduce((sum, h) => sum + (h.placedBirdCount ?? 0), 0);
  const cumMort = data.houses.reduce((sum, h) => sum + (h.cumulativeMortality ?? 0), 0);
  const phc = data.houses.reduce((sum, h) => sum + (h.projectedHeadCount ?? 0), 0);
  const projectedMort = data.houses.reduce(
    (sum, h) => sum + (h.projectedMortality ?? 0),
    0,
  );
  const catchLabel =
    data.activeFlock?.projectedCatchDate ?? data.activeFlock?.resolvedCatchDate ?? null;

  function openHouseEditor(h: HouseRow) {
    setHouseEditError(null);
    setEditingHouse({
      id: h.id,
      houseNumber: String(h.houseNumber),
      squareFootage: String(h.squareFootage ?? ""),
      totalFanCFM: h.totalFanCFM != null ? String(h.totalFanCFM) : "",
      numberOfFans: h.numberOfFans != null ? String(h.numberOfFans) : "",
    });
  }

  function confirmDeleteHouse(h: HouseRow) {
    Alert.alert(
      `Delete house ${h.houseNumber}?`,
      "This removes the house from the farm. It will no longer appear in your lists.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            try {
              deleteHouse(farm.id, h.id);
              load();
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "Could not delete house");
            }
          },
        },
      ],
    );
  }

  function confirmDeleteVisit(visitId: string, visitDate: string) {
    Alert.alert("Delete visit?", `${visitDate} will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          try {
            deleteVisit(farm.id, visitId);
            load();
          } catch (e) {
            Alert.alert("Error", e instanceof Error ? e.message : "Could not delete visit");
          }
        },
      },
    ]);
  }

  function saveHouseEdit() {
    if (!editingHouse) return;
    setHouseSaving(true);
    setHouseEditError(null);
    try {
      const sq = Number(editingHouse.squareFootage);
      const cfm =
        editingHouse.totalFanCFM.trim() === "" ? null : Number(editingHouse.totalFanCFM);
      const fans =
        editingHouse.numberOfFans.trim() === ""
          ? null
          : Math.floor(Number(editingHouse.numberOfFans));
      if (cfm != null && !Number.isFinite(cfm)) throw new Error("Total fan CFM is invalid");
      if (fans != null && !Number.isFinite(fans)) throw new Error("Number of fans is invalid");
      updateHouse(farm.id, editingHouse.id, {
        houseNumber: Number(editingHouse.houseNumber),
        squareFootage: sq,
        totalFanCFM: cfm,
        numberOfFans: fans,
      });
      setEditingHouse(null);
      load();
    } catch (e) {
      setHouseEditError(e instanceof Error ? e.message : "Could not save house");
    } finally {
      setHouseSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => router.replace("/(tabs)/farms")}
          style={{ marginBottom: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Back to farms"
        >
          <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← Farms</Text>
        </Pressable>

        <View style={{ marginBottom: 16 }}>
          <Text style={styles.title}>{farm.farmName}</Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
            }}
          >
            {farm.growerName ? (
              <Text style={styles.subtitle}>{farm.growerName}</Text>
            ) : null}
            {farm.phoneNumber ? (
              <Pressable onPress={() => Linking.openURL(`tel:${farm.phoneNumber}`)}>
                <Text style={{ color: colors.accentDark, fontWeight: "700", fontSize: 15 }}>
                  {farm.phoneNumber}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <PrimaryButton
              label="Enter mortality"
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/mortality",
                  params: { farmId: farm.id },
                })
              }
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label="LFO"
              secondary
              onPress={() => router.push("/(tabs)/lfo")}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {data.activeFlock ? (
          <Card>
            <Text style={{ fontWeight: "800", fontSize: 16 }}>
              Active flock — {flockAge != null ? `${flockAge} days` : "—"}
              {data.activeFlock.flockNumber ? ` · ${data.activeFlock.flockNumber}` : ""}
            </Text>
            <View style={[styles.row, { marginTop: 12 }]}>
              <Metric label="Birds placed" value={formatNumber(birdsPlaced)} />
              <Metric label="Proj. Head Count" value={formatNumber(phc || null)} />
              <Metric
                label="Cumulative Mortality"
                value={
                  birdsPlaced > 0
                    ? `${formatNumber(cumMort)} (${formatPct((cumMort / birdsPlaced) * 100)})`
                    : formatNumber(cumMort)
                }
              />
              <Metric
                label="Projected Mortality"
                value={
                  birdsPlaced > 0 && projectedMort > 0
                    ? `${formatNumber(projectedMort)} (${formatPct(
                        (projectedMort / birdsPlaced) * 100,
                      )})`
                    : formatNumber(projectedMort || null)
                }
              />
            </View>
            <Text style={[styles.muted, { marginTop: 4 }]}>
              Placed {data.activeFlock.placementDate}
              {catchLabel ? ` · Catch ${catchLabel}` : ""}
            </Text>
          </Card>
        ) : (
          <Card>
            <Text style={{ fontWeight: "800" }}>No active flock</Text>
            <Text style={[styles.muted, { marginTop: 4, marginBottom: 12 }]}>
              Add a flock to track mortality for this farm.
            </Text>
            <PrimaryButton
              label="Add flock"
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/farms/[id]/add-flock",
                  params: { id: farm.id },
                })
              }
            />
          </Card>
        )}

        <SectionTitle>{farm.farmName}</SectionTitle>
        {data.houses.map((h) => (
          <Card key={`${farm.id}-${h.id}`}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontSize: 17, fontWeight: "800" }}>
                  House {h.houseNumber}
                  {h.cumulativeMortality != null ? (
                    <Text style={{ fontWeight: "600", color: colors.muted }}>
                      {" "}
                      · Mort. {formatNumber(h.cumulativeMortality)}
                    </Text>
                  ) : null}
                  {h.projectedHeadCount != null ? (
                    <Text style={{ fontWeight: "600", color: colors.muted }}>
                      {" "}
                      · PHC {formatNumber(h.projectedHeadCount)}
                    </Text>
                  ) : null}
                </Text>
              </View>
              <StatusBadge status={h.status} />
              <Pressable
                accessibilityLabel={`Edit house ${h.houseNumber}`}
                onPress={() => openHouseEditor(h)}
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="pencil-outline" size={20} color={colors.muted} />
              </Pressable>
              <Pressable
                accessibilityLabel={`Delete house ${h.houseNumber}`}
                onPress={() => confirmDeleteHouse(h)}
                hitSlop={8}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="trash-outline" size={20} color={colors.muted} />
              </Pressable>
            </View>
            <View style={[styles.row, { marginTop: 12 }]}>
              <Metric label="Placed" value={formatNumber(h.placedBirdCount)} />
              <Metric label="Remaining" value={formatNumber(h.remainingBirdCount)} />
              <Metric label="PHC" value={formatNumber(h.projectedHeadCount)} />
              <Metric
                label="Mort."
                value={
                  h.placedBirdCount != null
                    ? `${formatNumber(h.cumulativeMortality)} (${formatPct(h.cumulativeMortalityPct)})`
                    : formatNumber(h.cumulativeMortality)
                }
              />
              <Metric
                label="Projected mortality"
                value={
                  h.projectedMortality != null &&
                  h.placedBirdCount != null &&
                  h.placedBirdCount > 0
                    ? `${formatNumber(h.projectedMortality)} (${formatPct(
                        (h.projectedMortality / h.placedBirdCount) * 100,
                      )})`
                    : formatNumber(h.projectedMortality)
                }
              />
              <Metric label="Recommended Min Vent" value={h.recommendedMinVent ?? "—"} />
            </View>
            {h.weeklyMortality.length > 0 ? (
              <View
                style={{
                  borderTopWidth: 1,
                  borderTopColor: "#f5f5f4",
                  paddingTop: 10,
                  marginTop: 4,
                }}
              >
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: colors.muted,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Weekly mortality
                </Text>
                <WeeklyMortalityList weeks={h.weeklyMortality} />
              </View>
            ) : (
              <Text style={[styles.muted, { marginTop: 8 }]}>No weekly mortality yet.</Text>
            )}
          </Card>
        ))}

        <SectionTitle>Visits</SectionTitle>
        <PrimaryButton
          label="Log visit"
          onPress={() =>
            router.push({
              pathname: "/(tabs)/farms/[id]/log-visit",
              params: { id: farm.id },
            })
          }
        />

        <SectionTitle>Recent visits</SectionTitle>
        {data.visits.length === 0 ? (
          <Card>
            <Text style={styles.muted}>No visits logged for this farm yet.</Text>
          </Card>
        ) : (
          data.visits.map((v) => (
            <Card key={v.id}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ fontWeight: "700" }}>
                    {v.visitDate} · {VISIT_TYPE_LABELS[v.visitType] ?? v.visitType}
                    {v.birdAgeInDays != null ? ` · ${v.birdAgeInDays}d` : ""}
                  </Text>
                  <Text style={styles.muted}>{v.generalBirdCondition ?? "—"}</Text>
                  {v.followUpRequired ? (
                    <Text style={{ color: "#b45309", marginTop: 2, fontWeight: "600" }}>
                      Follow-up{v.followUpDate ? ` · ${v.followUpDate}` : ""}
                    </Text>
                  ) : null}
                  {v.notes ? <Text style={{ marginTop: 4 }}>{v.notes}</Text> : null}
                </View>
                <Pressable
                  accessibilityLabel="Edit visit"
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/farms/[id]/visits/[visitId]",
                      params: { id: farm.id, visitId: v.id },
                    })
                  }
                  hitSlop={8}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="pencil-outline" size={20} color={colors.muted} />
                </Pressable>
                <Pressable
                  accessibilityLabel="Delete visit"
                  onPress={() => confirmDeleteVisit(v.id, v.visitDate)}
                  hitSlop={8}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.muted} />
                </Pressable>
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <Modal
        visible={editingHouse != null}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!houseSaving) setEditingHouse(null);
        }}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          onPress={() => {
            if (!houseSaving) setEditingHouse(null);
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 20,
              maxHeight: "85%",
            }}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                Edit house {editingHouse?.houseNumber}
              </Text>
              {houseEditError ? (
                <Text style={{ color: colors.danger, marginTop: 8, fontWeight: "700" }}>
                  {houseEditError}
                </Text>
              ) : null}
              {editingHouse ? (
                <View style={{ marginTop: 14, gap: 4 }}>
                  <Text style={styles.label}>House number</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={editingHouse.houseNumber}
                    onChangeText={(v) =>
                      setEditingHouse((prev) => (prev ? { ...prev, houseNumber: v } : prev))
                    }
                  />
                  <Text style={[styles.label, { marginTop: 8 }]}>Square footage</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={editingHouse.squareFootage}
                    onChangeText={(v) =>
                      setEditingHouse((prev) => (prev ? { ...prev, squareFootage: v } : prev))
                    }
                  />
                  <Text style={[styles.label, { marginTop: 8 }]}>Total fan CFM</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="decimal-pad"
                    value={editingHouse.totalFanCFM}
                    onChangeText={(v) =>
                      setEditingHouse((prev) => (prev ? { ...prev, totalFanCFM: v } : prev))
                    }
                  />
                  <Text style={[styles.label, { marginTop: 8 }]}>Number of fans</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="number-pad"
                    value={editingHouse.numberOfFans}
                    onChangeText={(v) =>
                      setEditingHouse((prev) => (prev ? { ...prev, numberOfFans: v } : prev))
                    }
                  />
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                    <PrimaryButton
                      label={houseSaving ? "Saving…" : "Save"}
                      onPress={saveHouseEdit}
                      style={{ flex: 1 }}
                    />
                    <PrimaryButton
                      label="Cancel"
                      secondary
                      onPress={() => {
                        if (!houseSaving) setEditingHouse(null);
                      }}
                      style={{ flex: 1 }}
                    />
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
