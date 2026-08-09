import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Redirect, useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import {
  deactivateFarm,
  deleteFarm,
  listFarms,
  reactivateFarm,
} from "../../../src/repos/data";
import { peekFarmReturnFromMortality } from "../../../src/lib/farmNavContext";
import { useTabScrollToTop } from "../../../src/lib/tabScroll";
import { colors, styles } from "../../../src/theme";
import { Card, Chip, PageHeader } from "../../../src/components/ui";
import { ConfirmDialog } from "../../../src/components/ConfirmDialog";

type StatusFilter = "active" | "inactive" | "all";
type ConfirmKind = "inactive" | "active" | "delete";

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
  /** Avoid mounting tall swipe Delete until open — on web it stretches short tiles. */
  const [swipingFarmId, setSwipingFarmId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    kind: ConfirmKind;
    farmId: string;
    farmName: string;
  } | null>(null);
  // Re-read on focus so Mortality → Farms pending redirect is picked up.
  const [pendingReturn, setPendingReturn] = useState(() => peekFarmReturnFromMortality());

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
      const pending = peekFarmReturnFromMortality();
      setPendingReturn(pending);
      if (pending?.farmId) return;
      setLoading(true);
      load();
    }, [load]),
  );

  // If Mortality armed a return target and we landed on the list, bounce to that farm.
  if (pendingReturn?.farmId) {
    return (
      <Redirect
        href={{
          pathname: "/(tabs)/farms/[id]",
          params: {
            id: pendingReturn.farmId,
          },
        }}
      />
    );
  }

  function runConfirm() {
    if (!confirm) return;
    const { kind, farmId } = confirm;
    if (kind === "inactive") {
      deactivateFarm(farmId);
    } else if (kind === "active") {
      reactivateFarm(farmId);
      setStatus("active");
    } else {
      deleteFarm(farmId);
    }
    setConfirm(null);
    load();
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
        <PageHeader title="Farms" />

        <View style={[styles.row, { marginBottom: 8, alignItems: "center" }]}>
          <Pressable
            onPress={() => router.push("/(tabs)/farms/new")}
            accessibilityRole="button"
            accessibilityLabel="Add Farm"
            style={{
              borderRadius: 10,
              paddingHorizontal: 14,
              paddingVertical: 10,
              marginRight: 8,
              marginBottom: 8,
              flexShrink: 0,
              backgroundColor: colors.accentDark,
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Add Farm</Text>
          </Pressable>
          {(["active", "inactive", "all"] as const).map((key) => (
            <Chip
              key={key}
              label={key[0]!.toUpperCase() + key.slice(1)}
              active={status === key}
              tone="neutral"
              onPress={() => setStatus(key)}
            />
          ))}
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
          const ageLabel = ages.length > 0 ? ages.map((a) => `${a}d`).join(" ") : null;
          const titleMeta = ageLabel
            ? ` (${houseCount}) ${ageLabel}`
            : ` (${houseCount})`;

          return (
            <Swipeable
              key={farm.id}
              overshootRight={false}
              friction={2}
              rightThreshold={40}
              containerStyle={{ marginBottom: 4, overflow: "hidden" }}
              onSwipeableWillOpen={() => setSwipingFarmId(farm.id)}
              onSwipeableClose={() =>
                setSwipingFarmId((id) => (id === farm.id ? null : id))
              }
              renderRightActions={() =>
                swipingFarmId === farm.id ? (
                  <Pressable
                    accessibilityLabel={`Delete ${farm.farmName} permanently`}
                    onPress={() =>
                      setConfirm({
                        kind: "delete",
                        farmId: farm.id,
                        farmName: farm.farmName,
                      })
                    }
                    style={{
                      backgroundColor: colors.danger,
                      justifyContent: "center",
                      alignItems: "center",
                      width: 88,
                      borderRadius: 14,
                      marginLeft: 8,
                      alignSelf: "stretch",
                    }}
                  >
                    <Text
                      style={{
                        color: "#fff",
                        fontWeight: "800",
                        fontSize: 12,
                        textAlign: "center",
                      }}
                    >
                      Delete
                    </Text>
                  </Pressable>
                ) : (
                  <View style={{ width: 88, marginLeft: 8 }} />
                )
              }
            >
              <Card style={{ padding: 0, marginBottom: 0, overflow: "hidden" }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Open ${farm.farmName}`}
                    onPress={() =>
                      router.push({ pathname: "/(tabs)/farms/[id]", params: { id: farm.id } })
                    }
                    style={({ pressed }) => ({
                      flex: 1,
                      minWidth: 0,
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
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        alignItems: "baseline",
                        gap: 6,
                        marginTop: 1,
                        minHeight: 16,
                      }}
                    >
                      {farm.growerName ? (
                        <Text style={[styles.muted, { lineHeight: 16 }]}>{farm.growerName}</Text>
                      ) : null}
                      {farm.phoneNumber ? (
                        <Pressable
                          accessibilityRole="link"
                          accessibilityLabel={`Call ${farm.phoneNumber}`}
                          onPress={() => Linking.openURL(dialUrl(farm.phoneNumber!))}
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
                      {!farm.growerName && !farm.phoneNumber ? (
                        <Text style={{ lineHeight: 16, opacity: 0 }}>{"\u00a0"}</Text>
                      ) : null}
                    </View>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      farm.isActive
                        ? `Make ${farm.farmName} inactive`
                        : `Make ${farm.farmName} active`
                    }
                    onPress={() => {
                      setConfirm({
                        kind: farm.isActive ? "inactive" : "active",
                        farmId: farm.id,
                        farmName: farm.farmName,
                      });
                    }}
                    hitSlop={8}
                    style={{ flexShrink: 0 }}
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
                </View>
              </Card>
            </Swipeable>
          );
        })}
      </ScrollView>

      <ConfirmDialog
        visible={confirm != null}
        title={
          confirm?.kind === "inactive"
            ? "Make this farm inactive?"
            : confirm?.kind === "active"
              ? "Make this farm active?"
              : "Are you sure?"
        }
        message={
          confirm?.kind === "inactive"
            ? `${confirm.farmName} will move to Inactive. You can make it active again later.`
            : confirm?.kind === "active"
              ? `Move ${confirm.farmName} back to Active?`
              : `${confirm?.farmName ?? "This farm"} will be deleted permanently and cannot be restored.`
        }
        confirmLabel={
          confirm?.kind === "inactive"
            ? "Make inactive"
            : confirm?.kind === "active"
              ? "Make active"
              : "Delete"
        }
        danger={confirm?.kind === "delete"}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
    </SafeAreaView>
  );
}
