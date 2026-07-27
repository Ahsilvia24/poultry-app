import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
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
} from "../../../src/repos/data";
import { formatLongScheduleDate } from "../../../src/lib/schedule";
import { colors, styles } from "../../../src/theme";
import {
  Card,
  Chip,
  Metric,
  PageHeader,
  formatNumber,
} from "../../../src/components/ui";

type StatusFilter = "active" | "inactive" | "all";

export default function FarmsScreen() {
  const router = useRouter();
  const [status, setStatus] = useState<StatusFilter>("active");
  const [data, setData] = useState<ReturnType<typeof listFarms> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                {!farm.isActive ? (
                  <Pressable
                    accessibilityLabel={`Make ${farm.farmName} active`}
                    onPress={() => confirmReactivate(farm.id, farm.farmName)}
                    hitSlop={8}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 8,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ color: colors.accentDark, fontWeight: "700", fontSize: 13 }}>
                      Make active
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityLabel={`Edit ${farm.farmName} settings`}
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/farms/[id]",
                      params: { id: farm.id, edit: "1" },
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
                  <Ionicons name="settings-outline" size={20} color={colors.muted} />
                </Pressable>
                {farm.isActive ? (
                  <Pressable
                    accessibilityLabel={`Make ${farm.farmName} inactive`}
                    onPress={() => confirmMakeInactive(farm.id, farm.farmName)}
                    hitSlop={8}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name="pause-circle-outline" size={22} color={colors.muted} />
                  </Pressable>
                ) : (
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
                )}
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
