import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { getDashboard } from "../../src/repos/data";
import { useAuth } from "../../src/auth";
import { colors, statusColor, styles } from "../../src/theme";

type Dashboard = ReturnType<typeof getDashboard>;

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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View>
          <Text style={styles.title}>Dashboard</Text>
          <Text style={styles.subtitle}>{user?.name} · Offline</Text>
        </View>
        <Pressable onPress={signOut}>
          <Text style={{ color: colors.accent, fontWeight: "700" }}>Sign out</Text>
        </Pressable>
      </View>

      <Text style={[styles.muted, { marginTop: 8 }]}>Saved on this phone — works with no internet.</Text>

      {error ? <Text style={{ color: colors.danger, marginTop: 12 }}>{error}</Text> : null}

      {data ? (
        <>
          <View style={[styles.row, { marginTop: 16 }]}>
            <Stat label="Farms" value={data.stats.activeFarms} />
            <Stat label="Houses" value={data.stats.activeHouses} />
            <Stat label="Today mort" value={data.stats.mortalityEnteredToday} />
            <Stat label="Missing" value={data.stats.farmsMissingToday} />
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginVertical: 16 }}>
            <Pressable
              style={[styles.button, { flex: 1 }]}
              onPress={() => router.push("/(tabs)/mortality")}
            >
              <Text style={styles.buttonText}>Enter mortality</Text>
            </Pressable>
            <Pressable
              style={[styles.buttonSecondary, { flex: 1 }]}
              onPress={() => router.push("/(tabs)/reports")}
            >
              <Text style={styles.buttonSecondaryText}>Reports</Text>
            </Pressable>
          </View>

          <Text style={[styles.title, { fontSize: 20, marginBottom: 8 }]}>Active farms</Text>
          {data.farmCards.map((farm) => {
            const sc = statusColor(farm.status);
            return (
              <Pressable
                key={farm.id}
                style={styles.card}
                onPress={() => router.push(`/(tabs)/farms/${farm.id}`)}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                      {farm.farmName}
                    </Text>
                    <Text style={styles.muted}>{farm.growerName}</Text>
                  </View>
                  <Text style={[styles.badge, { backgroundColor: sc.bg, color: sc.fg }]}>
                    {farm.status}
                  </Text>
                </View>
                <Text style={{ marginTop: 10, color: colors.text }}>
                  Age {farm.flockAgeDays ?? "—"}d · Today {farm.todayMortality} · 7d{" "}
                  {farm.sevenDayMortality} · Cum {farm.cumulativeMortality} (
                  {farm.cumulativeMortalityPct.toFixed(2)}%)
                </Text>
                {farm.missingTodayMortality ? (
                  <Text style={{ color: colors.warn, fontWeight: "700", marginTop: 6 }}>
                    Missing today&apos;s mortality
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </>
      ) : null}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={[styles.card, { width: "45%", flexGrow: 1, marginBottom: 8, padding: 12 }]}>
      <Text style={styles.muted}>{label}</Text>
      <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>{value}</Text>
    </View>
  );
}
