import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Swipeable } from "react-native-gesture-handler";
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

function dialUrl(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${digits || phone}`;
}

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
            <Swipeable
              key={farm.id}
              overshootRight={false}
              friction={2}
              rightThreshold={40}
              containerStyle={{ marginBottom: 8 }}
              renderRightActions={() => (
                <View style={{ flexDirection: "row" }}>
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
                    style={{
                      backgroundColor: farm.isActive ? "#57534e" : colors.accentDark,
                      justifyContent: "center",
                      alignItems: "center",
                      width: 100,
                      borderRadius: 14,
                      marginLeft: 8,
                    }}
                  >
                    <Ionicons
                      name={farm.isActive ? "pause-circle-outline" : "play-circle-outline"}
                      size={22}
                      color="#fff"
                    />
                    <Text
                      style={{
                        color: "#fff",
                        fontWeight: "800",
                        fontSize: 11,
                        marginTop: 4,
                        textAlign: "center",
                        paddingHorizontal: 4,
                      }}
                    >
                      {farm.isActive ? "Make inactive" : "Make active"}
                    </Text>
                  </Pressable>
                  {!farm.isActive ? (
                    <Pressable
                      accessibilityLabel={`Delete ${farm.farmName} permanently`}
                      onPress={() => confirmPermanentDelete(farm.id, farm.farmName)}
                      style={{
                        backgroundColor: colors.danger,
                        justifyContent: "center",
                        alignItems: "center",
                        width: 88,
                        borderRadius: 14,
                        marginLeft: 8,
                      }}
                    >
                      <Ionicons name="trash-outline" size={22} color="#fff" />
                      <Text
                        style={{
                          color: "#fff",
                          fontWeight: "800",
                          fontSize: 12,
                          marginTop: 4,
                        }}
                      >
                        Delete
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              )}
            >
              <Card style={{ padding: 0, marginBottom: 0, overflow: "hidden" }}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${farm.farmName}`}
                  onPress={() =>
                    router.push({ pathname: "/(tabs)/farms/[id]", params: { id: farm.id } })
                  }
                  style={({ pressed }) => ({
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    opacity: pressed ? 0.85 : 1,
                  })}
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
                  {farm.growerName || farm.phoneNumber ? (
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        alignItems: "baseline",
                        gap: 6,
                        marginTop: 1,
                      }}
                    >
                      {farm.growerName ? (
                        <Text style={[styles.muted, { lineHeight: 16 }]}>{farm.growerName}</Text>
                      ) : null}
                      {farm.phoneNumber ? (
                        <Pressable
                          accessibilityRole="link"
                          accessibilityLabel={`Call ${farm.phoneNumber}`}
                          onPress={(e) => {
                            e?.stopPropagation?.();
                            Linking.openURL(dialUrl(farm.phoneNumber!));
                          }}
                          hitSlop={8}
                        >
                          <Text
                            style={{
                              color: colors.accentDark,
                              fontWeight: "700",
                              fontSize: 13,
                              lineHeight: 16,
                              textDecorationLine: "underline",
                            }}
                          >
                            {farm.phoneNumber}
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                </Pressable>
              </Card>
            </Swipeable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
