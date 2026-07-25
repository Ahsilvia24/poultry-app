import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "../../../src/api";
import { colors, styles } from "../../../src/theme";

type FarmList = {
  farms: Array<{
    id: string;
    farmName: string;
    growerName: string;
    farmNumber: string | null;
    numberOfHouses: number;
    activeFlock: { flockNumber: string } | null;
  }>;
};

export default function FarmsScreen() {
  const router = useRouter();
  const [data, setData] = useState<FarmList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await api<FarmList>("/api/mobile/farms"));
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
      {error ? <Text style={{ color: colors.danger }}>{error}</Text> : null}
      {data?.farms.map((farm) => (
        <Pressable key={farm.id} style={styles.card} onPress={() => router.push(`/(tabs)/farms/${farm.id}`)}>
          <Text style={{ fontSize: 18, fontWeight: "800" }}>{farm.farmName}</Text>
          <Text style={styles.muted}>
            {farm.growerName}
            {farm.farmNumber ? ` · #${farm.farmNumber}` : ""}
          </Text>
          <Text style={{ marginTop: 8 }}>
            {farm.numberOfHouses} houses
            {farm.activeFlock ? ` · Active flock ${farm.activeFlock.flockNumber}` : " · No active flock"}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
