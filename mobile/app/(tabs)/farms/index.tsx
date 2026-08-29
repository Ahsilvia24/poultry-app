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
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import {
  deactivateFarm,
  deleteFarm,
  listFarms,
  reactivateFarm,
} from "../../../src/repos/data";
import { useTabScrollToTop } from "../../../src/lib/tabScroll";
import { useExclusiveSwipeables } from "../../../src/lib/useExclusiveSwipeables";
import { colors, styles } from "../../../src/theme";
import { Card, PageHeader } from "../../../src/components/ui";
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
  const swipe = useExclusiveSwipeables();
  const [confirm, setConfirm] = useState<{
    kind: ConfirmKind;
    farmId: string;
    farmName: string;
  } | null>(null);
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
        onScrollBeginDrag={swipe.closeAll}
      >
        <PageHeader title="Farms" />

        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

        {!data?.farms.length ? (
          <Card>
            <Text style={styles.muted}>No farms found.</Text>
          </Card>
        ) : null}

        {data?.farms.map((farm) => {
          const ages = farm.flockAgesDays?.length
            ? farm.flockAgesDays
            : farm.flockAgeDays != null
              ? [farm.flockAgeDays]
              : [];
          const ageLabel = ages.length > 0 ? ages.map((a) => `${a}d`).join(" ") : null;
          const titleMeta = ageLabel ? ` ${ageLabel}` : "";

          return (
            <Swipeable
              key={farm.id}
              ref={swipe.setRef(farm.id)}
              overshootRight={false}
              friction={2}
              rightThreshold={40}
              containerStyle={{ marginBottom: 4, overflow: "hidden" }}
              onSwipeableWillOpen={() => {
                swipe.closeOthers(farm.id);
                setSwipingFarmId(farm.id);
              }}
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
                      router.navigate({ pathname: "/(tabs)/farms/[id]", params: { id: farm.id } })
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

      <View
        style={{
          flexDirection: "row",
          gap: 8,
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 10,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          backgroundColor: colors.bg,
        }}
      >
        <Pressable
          onPress={() => router.push("/(tabs)/farms/new")}
          accessibilityRole="button"
          accessibilityLabel="Add Farm"
          style={{
            flex: 1,
            borderRadius: 10,
            paddingVertical: 10,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: colors.accentDark,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Add Farm</Text>
        </Pressable>
        {(["active", "inactive", "all"] as const).map((key) => {
          const selected = status === key;
          return (
            <Pressable
              key={key}
              onPress={() => setStatus(key)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={{
                flex: 1,
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: selected ? "#292524" : "#e7e5e4",
              }}
            >
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: "700",
                  color: selected ? "#fff" : colors.text,
                }}
              >
                {key[0]!.toUpperCase() + key.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>

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
