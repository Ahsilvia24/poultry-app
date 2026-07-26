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
import { getDashboard } from "../../src/repos/data";
import { useAuth } from "../../src/auth";
import { colors, styles } from "../../src/theme";
import {
  BrandBar,
  Card,
  Metric,
  PageHeader,
  PrimaryButton,
  SectionTitle,
  StatTile,
  StatusBadge,
  formatNumber,
  formatPct,
} from "../../src/components/ui";

type Dashboard = ReturnType<typeof getDashboard>;

function formatCatchDate(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1, 12);
  return dt.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function DashboardScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(getDashboard());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
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
        <BrandBar
          right={
            <Pressable onPress={signOut}>
              <Text style={{ color: colors.text, fontWeight: "700", textDecorationLine: "underline" }}>
                Sign out
              </Text>
            </Pressable>
          }
        />

        <PageHeader
          title="Dashboard"
          subtitle="Active farms, mortality, and follow-ups"
          actions={
            <View style={{ flexDirection: "row", gap: 10 }}>
              <PrimaryButton
                label="Enter mortality"
                onPress={() => router.push("/(tabs)/mortality")}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                label="Reports"
                secondary
                onPress={() => router.push("/(tabs)/reports")}
                style={{ flex: 1 }}
              />
            </View>
          }
        />

        {user?.name ? (
          <Text style={[styles.muted, { marginTop: -8, marginBottom: 12 }]}>{user.name}</Text>
        ) : null}

        {error ? <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text> : null}

        {data ? (
          <>
            <View style={styles.row}>
              <StatTile label="Active farms" value={data.stats.activeFarms} />
              <StatTile label="Active houses" value={data.stats.activeHouses} />
              <StatTile label="Today's mortality" value={data.stats.mortalityEnteredToday} />
              <StatTile label="Missing today" value={data.stats.farmsMissingToday} />
            </View>

            <Card>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.muted }}>
                Upcoming catches
              </Text>
              {data.upcomingCatches.length === 0 ? (
                <Text style={[styles.muted, { marginTop: 8 }]}>None</Text>
              ) : (
                data.upcomingCatches.map((c) => (
                  <Pressable
                    key={`${c.farmId}-${c.date}`}
                    onPress={() => router.push(`/(tabs)/farms/${c.farmId}`)}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    <Text style={{ fontWeight: "700", color: colors.text, flex: 1 }}>
                      {c.farmName}
                      {c.flockAgeDays != null ? (
                        <Text style={{ fontWeight: "400", color: colors.muted }}>
                          {" "}
                          · {c.flockAgeDays}d
                        </Text>
                      ) : null}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>
                      {formatCatchDate(c.date)}
                    </Text>
                  </Pressable>
                ))
              )}
            </Card>

            <SectionTitle>Active farms</SectionTitle>
            {data.farmCards.map((farm) => (
              <Pressable
                key={farm.id}
                onPress={() => router.push(`/(tabs)/farms/${farm.id}`)}
              >
                <Card>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                        {farm.farmName}
                        {farm.flockAgeDays != null ? (
                          <Text style={{ fontWeight: "600", color: colors.muted }}>
                            {" "}
                            · {farm.flockAgeDays}d
                          </Text>
                        ) : null}
                      </Text>
                      <Text style={styles.muted}>{farm.growerName}</Text>
                      {farm.phoneNumber ? (
                        <Text style={[styles.muted, { fontSize: 12, marginTop: 2 }]}>
                          {farm.phoneNumber}
                        </Text>
                      ) : null}
                    </View>
                    <StatusBadge status={farm.status} />
                  </View>

                  <View style={[styles.row, { marginTop: 14 }]}>
                    <Metric label="Flock age" value={farm.flockAgeDays != null ? `${farm.flockAgeDays} days` : "—"} />
                    <Metric label="Birds placed" value={formatNumber(farm.birdsPlaced)} />
                    <Metric label="Today's Mortality" value={String(farm.todayMortality)} />
                    <Metric
                      label="Proj. Head Count"
                      value={formatNumber(farm.projectedHeadCount)}
                      hint="Assumes 150 for catch crew / house"
                    />
                    <Metric
                      label="Cumulative Mortality"
                      value={`${farm.cumulativeMortality} (${formatPct(farm.cumulativeMortalityPct)})`}
                    />
                    <Metric label="Open issues" value={String(farm.openIssues)} />
                  </View>

                  {farm.weeklyMortality.length > 0 ? (
                    <View style={{ borderTopWidth: 1, borderTopColor: "#f5f5f4", paddingTop: 10, marginTop: 4 }}>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: colors.muted,
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                          marginBottom: 6,
                        }}
                      >
                        Weekly mortality
                      </Text>
                      <Text style={{ color: colors.text, fontSize: 14 }}>
                        {farm.weeklyMortality.map((w) => `W${w.week} ${w.total}`).join("  ·  ")}
                      </Text>
                    </View>
                  ) : null}

                  {farm.missingTodayMortality ? (
                    <Text style={{ color: colors.warn, fontWeight: "800", marginTop: 10, fontSize: 13 }}>
                      Missing today&apos;s mortality
                    </Text>
                  ) : null}
                </Card>
              </Pressable>
            ))}

            <Pressable onPress={() => router.push("/(tabs)/more")} style={{ marginTop: 8, marginBottom: 12 }}>
              <Text style={{ color: colors.accentDark, fontWeight: "700" }}>
                More · Settlement, Search, Settings →
              </Text>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
