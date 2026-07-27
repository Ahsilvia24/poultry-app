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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  deleteFlock,
  getFarmHistory,
  reactivateFlock,
} from "../../../../src/repos/data";
import { formatLongScheduleDate } from "../../../../src/lib/schedule";
import { colors, styles } from "../../../../src/theme";
import {
  Card,
  Metric,
  PageHeader,
  PrimaryButton,
  SectionTitle,
  formatNumber,
  formatPct,
} from "../../../../src/components/ui";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

type HistoryData = ReturnType<typeof getFarmHistory>;
type HistoryRow = HistoryData["all"][number];

function FlockHistoryCard({
  row,
  title,
  onReactivate,
  onDelete,
}: {
  row: HistoryRow;
  title: string;
  onReactivate: (row: HistoryRow) => void;
  onDelete: (row: HistoryRow) => void;
}) {
  const canDelete = row.flockStatus !== "ACTIVE";
  return (
    <Card>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontWeight: "800", fontSize: 16 }}>{title}</Text>
          <Text style={[styles.muted, { marginTop: 2 }]}>
            {row.flockStatus === "ACTIVE" ? "Active" : "Completed"}
            {" · Placed "}
            {formatLongScheduleDate(row.placementDate)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {canDelete ? (
            <Pressable
              accessibilityLabel={`Delete flock ${row.flockNumber}`}
              onPress={() => onDelete(row)}
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
          {canDelete ? (
            <PrimaryButton
              label="Make active"
              secondary
              onPress={() => onReactivate(row)}
            />
          ) : null}
        </View>
      </View>
      <View style={[styles.row, { marginTop: 12 }]}>
        <Metric label="Birds placed" value={formatNumber(row.birdsPlaced)} />
        <Metric
          label="Catch date"
          value={row.catchDate ? formatLongScheduleDate(row.catchDate) : "—"}
        />
        <Metric label="Market age" value={row.marketAge != null ? `${row.marketAge}d` : "—"} />
        <Metric
          label="Mortality"
          value={
            row.birdsPlaced > 0
              ? `${formatNumber(row.cumulativeMortality)} (${formatPct(row.mortPct)})`
              : formatNumber(row.cumulativeMortality)
          }
        />
        <Metric
          label="Livability"
          value={row.livability != null ? formatPct(row.livability) : "—"}
        />
      </View>
      {row.houseMortPcts.length > 0 ? (
        <Text style={[styles.muted, { marginTop: 4, fontSize: 12 }]}>
          Houses:{" "}
          {row.houseMortPcts
            .map((h) => `${h.houseNumber} ${formatPct(h.mortPct)}`)
            .join(" · ")}
        </Text>
      ) : null}
    </Card>
  );
}

export default function FarmHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const farmId = paramId(params.id);
  const [data, setData] = useState<HistoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!farmId) {
      setError("Missing farm id");
      setData(null);
      setLoading(false);
      return;
    }
    try {
      setError(null);
      setData(getFarmHistory(farmId));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [farmId]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  function onReactivate(row: HistoryRow) {
    Alert.alert(
      "Make flock active?",
      `Make flock ${row.flockNumber} active again?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Make active",
          onPress: () => {
            try {
              reactivateFlock(row.id);
              load();
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "Could not reactivate");
            }
          },
        },
      ],
    );
  }

  function onDelete(row: HistoryRow) {
    Alert.alert(
      `Delete flock ${row.flockNumber}?`,
      "This permanently removes the flock and its mortality, feed, and LFO records. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            try {
              deleteFlock(farmId, row.id);
              load();
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : "Could not delete flock");
            }
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
        <Pressable
          onPress={() =>
            router.replace({ pathname: "/(tabs)/farms/[id]", params: { id: farmId } })
          }
          style={{ marginBottom: 8 }}
        >
          <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← Back to farm</Text>
        </Pressable>

        <PageHeader
          title={`History — ${data?.farm.farmName ?? "Farm"}`}
          subtitle="Previous flocks and performance comparison"
        />

        {error ? (
          <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text>
        ) : null}

        {data?.current ? (
          <FlockHistoryCard
            row={data.current}
            title={
              data.current.flockStatus === "ACTIVE"
                ? `Current flock — ${data.current.flockNumber}`
                : `Latest flock — ${data.current.flockNumber}`
            }
            onReactivate={onReactivate}
            onDelete={onDelete}
          />
        ) : (
          <Card>
            <Text style={styles.muted}>No flocks recorded for this farm.</Text>
          </Card>
        )}

        <SectionTitle>Previous 3 flocks</SectionTitle>
        {data?.previous.length ? (
          data.previous.map((row) => (
            <FlockHistoryCard
              key={row.id}
              row={row}
              title={`Flock ${row.flockNumber}`}
              onReactivate={onReactivate}
              onDelete={onDelete}
            />
          ))
        ) : (
          <Card>
            <Text style={styles.muted}>No completed previous flocks to compare.</Text>
          </Card>
        )}

        {data && data.all.length > 0 ? (
          <>
            <SectionTitle>All flocks</SectionTitle>
            {data.all.map((row) => (
              <Card key={`all-${row.id}`}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontWeight: "800" }}>
                      {row.flockNumber}
                      <Text style={{ fontWeight: "600", color: colors.muted }}>
                        {" "}
                        · {row.flockStatus === "ACTIVE" ? "Active" : "Completed"}
                      </Text>
                    </Text>
                    <Text style={[styles.muted, { marginTop: 4 }]}>
                      Placed {row.placementDate}
                      {row.catchDate ? ` · Catch ${row.catchDate}` : ""}
                      {row.marketAge != null ? ` · ${row.marketAge}d` : ""}
                      {" · Mort "}
                      {formatPct(row.mortPct)}
                    </Text>
                  </View>
                  {row.flockStatus !== "ACTIVE" ? (
                    <Pressable
                      accessibilityLabel={`Delete flock ${row.flockNumber}`}
                      onPress={() => onDelete(row)}
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
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
