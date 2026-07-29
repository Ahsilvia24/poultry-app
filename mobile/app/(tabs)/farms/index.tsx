import { useCallback, useRef, useState } from "react";
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
import { useTabScrollToTop } from "../../../src/lib/tabScroll";
import { colors, styles } from "../../../src/theme";
import { Card, Chip, PageHeader } from "../../../src/components/ui";

type StatusFilter = "active" | "inactive" | "all";

export default function FarmsScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  useTabScrollToTop("farms", scrollRef);
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
            <Card
              key={farm.id}
              style={{ paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Pressable
                    onPress={() =>
                      router.push({ pathname: "/(tabs)/farms/[id]", params: { id: farm.id } })
                    }
                  >
                    <Text
                      style={{
                        fontSize: 16,
                        fontWeight: "800",
                        color: colors.text,
                        lineHeight: 20,
                      }}
                    >
                      {farm.farmName}
                      <Text style={{ fontWeight: "600", color: colors.muted }}>{titleMeta}</Text>
                    </Text>
                    {farm.growerName ? (
                      <Text style={[styles.muted, { marginTop: 1, lineHeight: 16 }]}>
                        {farm.growerName}
                      </Text>
                    ) : null}
                  </Pressable>
                </View>

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
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
                        {
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          fontSize: 12,
                        },
                        farm.isActive
                          ? { backgroundColor: "#d1fae5", color: "#065f46" }
                          : { backgroundColor: "#e7e5e4", color: "#44403c" },
                      ]}
                    >
                      {farm.isActive ? "Active" : "Inactive"}
                    </Text>
                  </Pressable>
                  {!farm.isActive ? (
                    <Pressable
                      accessibilityLabel={`Delete ${farm.farmName} permanently`}
                      onPress={() => confirmPermanentDelete(farm.id, farm.farmName)}
                      hitSlop={8}
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.muted} />
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </Card>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
