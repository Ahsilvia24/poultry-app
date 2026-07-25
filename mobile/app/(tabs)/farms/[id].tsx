import { useCallback, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { api } from "../../../src/api";
import { colors, statusColor, styles } from "../../../src/theme";

type FarmDetail = {
  farm: {
    id: string;
    farmName: string;
    growerName: string;
    phoneNumber: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    notes: string | null;
  };
  activeFlock: { id: string; flockNumber: string; placementDate: string } | null;
  houses: Array<{
    id: string;
    houseNumber: number;
    squareFootage: number;
    totalFanCFM: number | null;
    cfmPerSqFt: number | null;
    placedBirdCount: number | null;
    todayMortality: number;
    sevenDayMortality: number;
    cumulativeMortality: number;
    cumulativeMortalityPct: number;
    remainingBirdCount: number | null;
    status: string;
  }>;
  openIssues: Array<{ id: string; priority: string; description: string }>;
};

export default function FarmDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [data, setData] = useState<FarmDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = await api<FarmDetail>(`/api/mobile/farms/${id}`);
      setData(result);
      navigation.setOptions({ title: result.farm.farmName });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id, navigation]);

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

  if (!data) {
    return (
      <View style={styles.content}>
        <Text style={{ color: colors.danger }}>{error ?? "Not found"}</Text>
      </View>
    );
  }

  const { farm } = data;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
    >
      <Text style={styles.subtitle}>{farm.growerName}</Text>
      <Text style={styles.muted}>
        {[farm.address, farm.city, farm.state].filter(Boolean).join(", ") || "No address"}
      </Text>
      {farm.phoneNumber ? (
        <Pressable onPress={() => Linking.openURL(`tel:${farm.phoneNumber}`)}>
          <Text style={{ color: colors.accent, fontWeight: "700", marginTop: 8 }}>{farm.phoneNumber}</Text>
        </Pressable>
      ) : null}

      <Pressable
        style={[styles.button, { marginTop: 16 }]}
        onPress={() => router.push({ pathname: "/(tabs)/mortality", params: { farmId: farm.id } })}
      >
        <Text style={styles.buttonText}>Enter mortality</Text>
      </Pressable>

      {data.activeFlock ? (
        <View style={[styles.card, { marginTop: 16 }]}>
          <Text style={{ fontWeight: "800", fontSize: 16 }}>
            Active flock {data.activeFlock.flockNumber}
          </Text>
          <Text style={styles.muted}>Placed {data.activeFlock.placementDate}</Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text>No active flock</Text>
        </View>
      )}

      <Text style={[styles.title, { fontSize: 20, marginVertical: 8 }]}>Houses</Text>
      {data.houses.map((h) => {
        const sc = statusColor(h.status);
        return (
          <View key={h.id} style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 17, fontWeight: "800" }}>House {h.houseNumber}</Text>
              <Text style={[styles.badge, { backgroundColor: sc.bg, color: sc.fg }]}>{h.status}</Text>
            </View>
            <Text style={styles.muted}>
              {h.squareFootage.toLocaleString()} sq ft
              {h.cfmPerSqFt != null ? ` · ${h.cfmPerSqFt.toFixed(2)} CFM/sqft` : ""}
            </Text>
            <Text style={{ marginTop: 8 }}>
              Placed {h.placedBirdCount?.toLocaleString() ?? "—"} · Today {h.todayMortality} · 7d{" "}
              {h.sevenDayMortality} · Cum {h.cumulativeMortality} ({h.cumulativeMortalityPct.toFixed(2)}%)
            </Text>
            <Text style={styles.muted}>Remaining {h.remainingBirdCount?.toLocaleString() ?? "—"}</Text>
          </View>
        );
      })}

      {data.openIssues.length > 0 ? (
        <>
          <Text style={[styles.title, { fontSize: 20, marginVertical: 8 }]}>Open issues</Text>
          {data.openIssues.map((issue) => (
            <View key={issue.id} style={styles.card}>
              <Text style={{ fontWeight: "800" }}>{issue.priority}</Text>
              <Text>{issue.description}</Text>
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
