import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  deactivateFarm,
  deleteFarm,
  listFarms,
  reactivateFarm,
  updateFarm,
} from "../../../src/repos/data";
import { formatLongScheduleDate } from "../../../src/lib/schedule";
import { useTabScrollToTop } from "../../../src/lib/tabScroll";
import { colors, styles } from "../../../src/theme";
import {
  Card,
  Chip,
  Metric,
  PageHeader,
  PrimaryButton,
  formatNumber,
} from "../../../src/components/ui";

type StatusFilter = "active" | "inactive" | "all";
type FarmRow = ReturnType<typeof listFarms>["farms"][number];
type FarmEditDraft = {
  id: string;
  farmName: string;
  growerName: string;
  phoneNumber: string;
  email: string;
  notes: string;
  numberOfGenerators: number;
};

export default function FarmsScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  useTabScrollToTop("farms", scrollRef);
  const [status, setStatus] = useState<StatusFilter>("active");
  const [data, setData] = useState<ReturnType<typeof listFarms> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingFarm, setEditingFarm] = useState<FarmEditDraft | null>(null);
  const [farmEditError, setFarmEditError] = useState<string | null>(null);
  const [farmSaving, setFarmSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(listFarms(status));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  function confirmMakeInactive(farmId: string, farmName: string) {
    Alert.alert(
      "Make farm inactive?",
      `${farmName} will move to Inactive. You can make it active again later.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Make inactive",
          onPress: () => {
            deactivateFarm(farmId);
            load();
          },
        },
      ],
    );
  }

  function confirmReactivate(farmId: string, farmName: string) {
    Alert.alert("Make farm active?", `Move ${farmName} back to Active?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Make active",
        onPress: () => {
          reactivateFarm(farmId);
          setStatus("active");
          load();
        },
      },
    ]);
  }

  function confirmPermanentDelete(farmId: string, farmName: string) {
    Alert.alert(
      "Delete farm permanently?",
      `${farmName} will be removed from all farm lists and cannot be restored from Inactive.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () => {
            deleteFarm(farmId);
            load();
          },
        },
      ],
    );
  }

  function openFarmEditor(farm: FarmRow) {
    setFarmEditError(null);
    setEditingFarm({
      id: farm.id,
      farmName: farm.farmName,
      growerName: farm.growerName ?? "",
      phoneNumber: farm.phoneNumber ?? "",
      email: farm.email ?? "",
      notes: farm.notes ?? "",
      numberOfGenerators: farm.numberOfGenerators ?? 4,
    });
  }

  function closeFarmEditor() {
    if (farmSaving) return;
    setEditingFarm(null);
    setFarmEditError(null);
  }

  function saveFarmEdit() {
    if (!editingFarm) return;
    setFarmSaving(true);
    setFarmEditError(null);
    try {
      updateFarm(editingFarm.id, {
        farmName: editingFarm.farmName,
        growerName: editingFarm.growerName,
        phoneNumber: editingFarm.phoneNumber,
        email: editingFarm.email,
        notes: editingFarm.notes,
        numberOfGenerators: editingFarm.numberOfGenerators,
      });
      setEditingFarm(null);
      load();
    } catch (e) {
      setFarmEditError(e instanceof Error ? e.message : "Could not save farm");
    } finally {
      setFarmSaving(false);
    }
  }

  if (loading && !data) {
    return (
      <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      >
        <PageHeader title="Farms" subtitle="Manage grower farms and houses" />

        <View style={[styles.row, { marginBottom: 8 }]}>
          {(["active", "inactive", "all"] as const).map((key) => (
            <Chip
              key={key}
              label={key[0]!.toUpperCase() + key.slice(1)}
              active={status === key}
              onPress={() => setStatus(key)}
            />
          ))}
          <Chip label="Add Farm" onPress={() => router.push("/(tabs)/farms/new")} />
        </View>

        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

        {!data?.farms.length ? (
          <Card>
            <Text style={styles.muted}>No farms found.</Text>
          </Card>
        ) : null}

        {data?.farms.map((farm) => {
          const houseCount = farm.houseCount ?? farm.numberOfHouses;
          const ages = farm.flockAgesDays?.length
            ? farm.flockAgesDays
            : farm.flockAgeDays != null
              ? [farm.flockAgeDays]
              : [];
          const ageLabel = ages.length > 0 ? ages.map((a) => `${a}d`).join(" · ") : null;
          const titleMeta = ageLabel
            ? ` (${houseCount}) · ${ageLabel}`
            : ` (${houseCount})`;

          return (
            <Card key={farm.id}>
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
                <Pressable
                  style={{ flex: 1, minWidth: 0 }}
                  onPress={() =>
                    router.push({ pathname: "/(tabs)/farms/[id]", params: { id: farm.id } })
                  }
                >
                  <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                    {farm.farmName}
                    <Text style={{ fontWeight: "600", color: colors.muted }}>{titleMeta}</Text>
                  </Text>
                  {farm.growerName || farm.phoneNumber ? (
                    <Text style={styles.muted}>
                      {[farm.growerName, farm.phoneNumber].filter(Boolean).join("  ")}
                    </Text>
                  ) : null}
                </Pressable>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                    marginLeft: 8,
                    flexShrink: 0,
                  }}
                >
                <Pressable
                  accessibilityLabel={
                    farm.isActive
                      ? `Make ${farm.farmName} inactive`
                      : `Make ${farm.farmName} active`
                  }
                  onPress={() => {
                    if (farm.isActive) confirmMakeInactive(farm.id, farm.farmName);
                    else confirmReactivate(farm.id, farm.farmName);
                  }}
                  hitSlop={8}
                >
                  <Text
                    style={[
                      styles.badge,
                      farm.isActive
                        ? { backgroundColor: "#d1fae5", color: "#065f46" }
                        : { backgroundColor: "#e7e5e4", color: "#44403c" },
                    ]}
                  >
                    {farm.isActive ? "Active" : "Inactive"}
                  </Text>
                </Pressable>
              </View>
              </View>

              <Pressable
                onPress={() =>
                  router.push({ pathname: "/(tabs)/farms/[id]", params: { id: farm.id } })
                }
              >
                <View style={[styles.row, { marginTop: 12 }]}>
                  <Metric
                    label="Birds placed"
                    value={farm.activeFlock ? formatNumber(farm.birdsPlaced) : "—"}
                  />
                  <Metric
                    label="Placement date"
                    value={
                      (farm.placementDates?.length
                        ? farm.placementDates
                        : farm.placementDate
                          ? [farm.placementDate]
                          : []
                      )
                        .map((d) => formatLongScheduleDate(d))
                        .join("\n") || "—"
                    }
                  />
                  <Metric
                    label="Current Head Count"
                    value={farm.activeFlock ? formatNumber(farm.currentHeadCount) : "—"}
                  />
                  <Metric
                    label="Catch date"
                    value={
                      (farm.catchDates?.length
                        ? farm.catchDates
                        : farm.projectedCatchDate
                          ? [farm.projectedCatchDate]
                          : []
                      )
                        .map((d) => formatLongScheduleDate(d))
                        .join("\n") || "—"
                    }
                  />
                </View>
              </Pressable>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  gap: 4,
                  marginTop: 4,
                }}
              >
                <Pressable
                  accessibilityLabel={`Edit ${farm.farmName} settings`}
                  onPress={() => openFarmEditor(farm)}
                  hitSlop={8}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="settings-outline" size={20} color={colors.muted} />
                </Pressable>
                {!farm.isActive ? (
                  <Pressable
                    accessibilityLabel={`Delete ${farm.farmName} permanently`}
                    onPress={() => confirmPermanentDelete(farm.id, farm.farmName)}
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
                ) : null}
              </View>
            </Card>
          );
        })}
      </ScrollView>

      <Modal
        visible={editingFarm != null}
        animationType="slide"
        transparent
        onRequestClose={closeFarmEditor}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
        >
          <Pressable
            style={{
              flex: 1,
              backgroundColor: "rgba(0,0,0,0.4)",
              justifyContent: "flex-end",
            }}
            onPress={closeFarmEditor}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{
                backgroundColor: "#fff",
                borderTopLeftRadius: 16,
                borderTopRightRadius: 16,
                padding: 20,
                paddingBottom: Platform.OS === "ios" ? 28 : 20,
                maxHeight: "90%",
              }}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                contentContainerStyle={{ paddingBottom: 24 }}
              >
                <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                  Edit farm info
                </Text>
                {farmEditError ? (
                  <Text style={{ color: colors.danger, marginTop: 8, fontWeight: "700" }}>
                    {farmEditError}
                  </Text>
                ) : null}
                {editingFarm ? (
                  <View style={{ marginTop: 14, gap: 4 }}>
                    <Text style={styles.label}>Farm name *</Text>
                    <TextInput
                      style={styles.input}
                      value={editingFarm.farmName}
                      onChangeText={(v) =>
                        setEditingFarm((prev) => (prev ? { ...prev, farmName: v } : prev))
                      }
                      autoCapitalize="words"
                    />
                    <Text style={[styles.label, { marginTop: 8 }]}>Grower name</Text>
                    <TextInput
                      style={styles.input}
                      value={editingFarm.growerName}
                      onChangeText={(v) =>
                        setEditingFarm((prev) => (prev ? { ...prev, growerName: v } : prev))
                      }
                      autoCapitalize="words"
                    />
                    <Text style={[styles.label, { marginTop: 8 }]}>Phone</Text>
                    <TextInput
                      style={styles.input}
                      value={editingFarm.phoneNumber}
                      onChangeText={(v) =>
                        setEditingFarm((prev) => (prev ? { ...prev, phoneNumber: v } : prev))
                      }
                      keyboardType="phone-pad"
                    />
                    <Text style={[styles.label, { marginTop: 8 }]}>Email</Text>
                    <TextInput
                      style={styles.input}
                      value={editingFarm.email}
                      onChangeText={(v) =>
                        setEditingFarm((prev) => (prev ? { ...prev, email: v } : prev))
                      }
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Text style={[styles.label, { marginTop: 8 }]}>Number of generators</Text>
                    <View style={[styles.row, { marginBottom: 8 }]}>
                      {([1, 2, 3, 4] as const).map((n) => (
                        <Chip
                          key={n}
                          label={String(n)}
                          active={editingFarm.numberOfGenerators === n}
                          onPress={() =>
                            setEditingFarm((prev) =>
                              prev ? { ...prev, numberOfGenerators: n } : prev,
                            )
                          }
                        />
                      ))}
                    </View>
                    <Text style={[styles.label, { marginTop: 8 }]}>Notes</Text>
                    <TextInput
                      style={[styles.input, { minHeight: 88, textAlignVertical: "top" }]}
                      value={editingFarm.notes}
                      onChangeText={(v) =>
                        setEditingFarm((prev) => (prev ? { ...prev, notes: v } : prev))
                      }
                      multiline
                    />
                    <View style={{ marginTop: 16, gap: 10 }}>
                      <PrimaryButton
                        label={farmSaving ? "Saving…" : "Save farm changes"}
                        onPress={saveFarmEdit}
                      />
                      <Pressable onPress={closeFarmEditor} disabled={farmSaving} hitSlop={8}>
                        <Text
                          style={{
                            textAlign: "center",
                            color: colors.muted,
                            fontWeight: "700",
                            paddingVertical: 8,
                          }}
                        >
                          Cancel
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : null}
              </ScrollView>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
