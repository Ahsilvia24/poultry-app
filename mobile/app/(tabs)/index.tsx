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
import { formatShortScheduleDate } from "../../src/lib/schedule";
import {
  BrandBar,
  Card,
  PageHeader,
  PrimaryButton,
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
  const { signOut } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
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
          subtitle="Schedule, mortality, and follow-ups"
          actions={
            <View style={{ flexDirection: "row", gap: 10 }}>
              <PrimaryButton
                label="Enter mortality"
                onPress={() => router.push("/(tabs)/mortality")}
                style={{ flex: 1 }}
              />
              <PrimaryButton
                label="Add farm"
                secondary
                onPress={() => router.push("/(tabs)/farms")}
                style={{ flex: 1 }}
              />
            </View>
          }
        />

        {error ? <Text style={{ color: colors.danger, marginBottom: 12 }}>{error}</Text> : null}

        {data ? (
          <>
            <Card>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.muted }}>
                Today&apos;s schedule
              </Text>
              {data.todaysSchedule.length === 0 ? (
                <Text style={[styles.muted, { marginTop: 8 }]}>Nothing due today</Text>
              ) : (
                data.todaysSchedule.map((item) => (
                  <Pressable
                    key={`${item.farmId}-${item.date}-${item.label}`}
                    onPress={() => router.push(`/(tabs)/farms/${item.farmId}`)}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    <Text style={{ fontWeight: "700", color: colors.text, flex: 1 }}>
                      {item.farmName}
                      {item.flockAgeDays != null ? (
                        <Text style={{ fontWeight: "400", color: colors.muted }}>
                          {" "}
                          · {item.flockAgeDays}d
                        </Text>
                      ) : null}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>
                      {item.label}
                    </Text>
                  </Pressable>
                ))
              )}
            </Card>

            <Card>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.muted }}>
                Upcoming
              </Text>
              {data.upcomingSchedule.length === 0 ? (
                <Text style={[styles.muted, { marginTop: 8 }]}>None in the next 14 days</Text>
              ) : (
                data.upcomingSchedule.slice(0, 20).map((item) => (
                  <Pressable
                    key={`${item.farmId}-${item.date}-${item.label}`}
                    onPress={() => router.push(`/(tabs)/farms/${item.farmId}`)}
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 8,
                      marginTop: 10,
                    }}
                  >
                    <Text style={{ fontWeight: "700", color: colors.text, flex: 1 }}>
                      {item.farmName}
                      {item.flockAgeDays != null ? (
                        <Text style={{ fontWeight: "400", color: colors.muted }}>
                          {" "}
                          · {item.flockAgeDays}d
                        </Text>
                      ) : null}
                      <Text style={{ fontWeight: "400", color: colors.muted }}>
                        {"  "}
                        {item.label}
                      </Text>
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>
                      {formatShortScheduleDate(item.date)}
                    </Text>
                  </Pressable>
                ))
              )}
            </Card>

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
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
