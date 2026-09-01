import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  deactivateFarm,
  deleteFarm,
  listFarms,
  reactivateFarm,
} from "../../../src/repos/data";
import { useTabScrollToTop } from "../../../src/lib/tabScroll";
import { colors, fonts, styles } from "../../../src/theme";
import { Card, PageHeader } from "../../../src/components/ui";
import { ConfirmDialog } from "../../../src/components/ConfirmDialog";
import { SwipeCommitDeleteRow } from "../../../src/components/SwipeCommitDeleteRow";

type ConfirmKind = "inactive" | "active" | "delete";

export default function FarmsScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  useTabScrollToTop("farms", scrollRef);
  const [data, setData] = useState<ReturnType<typeof listFarms> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    kind: ConfirmKind;
    farmId: string;
    farmName: string;
  } | null>(null);
  const load = useCallback(async () => {
    try {
      setError(null);
      setData(listFarms("all"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

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
        <PageHeader
          title="Farms"
          actions={
            <Pressable
              onPress={() => router.push("/(tabs)/farms/new")}
              accessibilityRole="button"
              accessibilityLabel="Add Farm"
              style={{
                borderRadius: 10,
                paddingVertical: 8,
                paddingHorizontal: 14,
                backgroundColor: colors.accentDark,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "700", color: "#fff" }}>Add Farm</Text>
            </Pressable>
          }
        />

        {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}

        {!data?.farms.length ? (
          <Card>
            <Text style={styles.muted}>No farms found.</Text>
          </Card>
        ) : null}

        <View style={{ flexDirection: "row", flexWrap: "wrap", marginHorizontal: -4 }}>
          {data?.farms.map((farm) => {
            const ages = farm.flockAgesDays?.length
              ? farm.flockAgesDays
              : farm.flockAgeDays != null
                ? [farm.flockAgeDays]
                : [];
            const ageLabel = ages.length > 0 ? ages.map((a) => `${a}d`).join(" ") : null;

            return (
              <View
                key={farm.id}
                style={{ width: "50%", paddingHorizontal: 4, marginBottom: 8 }}
              >
                <SwipeCommitDeleteRow
                  onDelete={() =>
                    setConfirm({
                      kind: "delete",
                      farmId: farm.id,
                      farmName: farm.farmName,
                    })
                  }
                >
                  <Card
                    style={{
                      padding: 10,
                      marginBottom: 0,
                      borderWidth: 2,
                      borderColor: farm.isActive ? colors.accentDark : "#d6d3d1",
                    }}
                  >
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${farm.farmName}. Long press to ${
                        farm.isActive ? "make inactive" : "make active"
                      }`}
                      delayLongPress={500}
                      onPress={() =>
                        router.navigate({
                          pathname: "/(tabs)/farms/[id]",
                          params: { id: farm.id },
                        })
                      }
                      onLongPress={() => {
                        setConfirm({
                          kind: farm.isActive ? "inactive" : "active",
                          farmId: farm.id,
                          farmName: farm.farmName,
                        });
                      }}
                      style={({ pressed }) => ({
                        opacity: pressed ? 0.85 : 1,
                      })}
                    >
                      <Text
                        numberOfLines={1}
                        style={{
                          fontFamily: fonts.sans,
                          fontSize: 15,
                          fontWeight: "800",
                          color: colors.text,
                          lineHeight: 19,
                        }}
                      >
                        {farm.farmName}
                      </Text>
                      {farm.growerName ? (
                        <Text
                          numberOfLines={1}
                          style={{
                            fontFamily: fonts.sans,
                            fontSize: 13,
                            color: colors.muted,
                            marginTop: 2,
                            lineHeight: 16,
                          }}
                        >
                          {farm.growerName}
                        </Text>
                      ) : null}
                      {ageLabel ? (
                        <Text
                          style={{
                            fontFamily: fonts.sans,
                            fontSize: 13,
                            fontWeight: "600",
                            color: colors.muted,
                            marginTop: 2,
                            lineHeight: 16,
                          }}
                        >
                          {`Flock Age: ${ageLabel}`}
                        </Text>
                      ) : null}
                    </Pressable>
                  </Card>
                </SwipeCommitDeleteRow>
              </View>
            );
          })}
        </View>
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
