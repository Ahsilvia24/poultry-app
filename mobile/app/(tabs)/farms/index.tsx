import { useCallback, useState } from "react";
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
import { listFarms } from "../../../src/repos/data";
import { colors, styles } from "../../../src/theme";
import {
  BrandBar,
  Card,
  Chip,
  Metric,
  PageHeader,
  PrimaryButton,
  SectionTitle,
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
        <BrandBar />
        <PageHeader
          title="Farms"
          subtitle="Manage grower farms and houses"
          actions={
            <PrimaryButton
              label="Add farm"
              onPress={() => router.push("/(tabs)/farms/new")}
            />
          }
        />

        <View style={[styles.row, { marginBottom: 8 }]}>
          {(["active", "inactive", "all"] as const).map((key) => (
            <Chip
              key={key}
              label={key[0]!.toUpperCase() + key.slice(1)}
              active={status === key}
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

        {data?.farms.map((farm) => (
          <Pressable key={farm.id} onPress={() => router.push(`/(tabs)/farms/${farm.id}`)}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                    {farm.farmName}
                    <Text style={{ fontWeight: "600", color: colors.muted }}>
                      {" "}
                      · {farm.numberOfHouses} houses
                    </Text>
                  </Text>
                  <Text style={styles.muted}>{farm.growerName}</Text>
                  {farm.phoneNumber ? (
                    <Text style={[styles.muted, { fontSize: 12, marginTop: 2 }]}>
                      {farm.phoneNumber}
                    </Text>
                  ) : null}
                </View>
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

              <View style={[styles.row, { marginTop: 12 }]}>
                <Metric
                  label="Active flock"
                  value={farm.activeFlock?.flockNumber ?? "None"}
                />
                <Metric label="Birds placed" value={formatNumber(farm.birdsPlaced || null)} />
                <Metric
                  label="Current head count"
                  value={formatNumber(farm.currentHeadCount || null)}
                />
                <Metric
                  label="Catch date"
                  value={farm.projectedCatchDate ?? "—"}
                />
              </View>
            </Card>
          </Pressable>
        ))}

        <SectionTitle>Quick links</SectionTitle>
        <PrimaryLinks router={router} />
      </ScrollView>
    </SafeAreaView>
  );
}

function PrimaryLinks({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <Card>
      <Pressable onPress={() => router.push("/(tabs)/mortality")} style={{ paddingVertical: 8 }}>
        <Text style={{ fontWeight: "700", color: colors.accentDark }}>Enter mortality</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/(tabs)/lfo")} style={{ paddingVertical: 8 }}>
        <Text style={{ fontWeight: "700", color: colors.accentDark }}>LFO calculator</Text>
      </Pressable>
      <Pressable onPress={() => router.push("/(tabs)/reports")} style={{ paddingVertical: 8 }}>
        <Text style={{ fontWeight: "700", color: colors.accentDark }}>Reports</Text>
      </Pressable>
    </Card>
  );
}
