import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { createVisit, getFarmDetail } from "../../../src/repos/data";
import { todayKey } from "../../../src/lib/ids";
import { colors, statusColor, styles } from "../../../src/theme";

export default function FarmDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const [data, setData] = useState<ReturnType<typeof getFarmDetail> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visitNotes, setVisitNotes] = useState("");
  const [visitMsg, setVisitMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const result = getFarmDetail(id!);
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
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.subtitle}>{farm.growerName}</Text>
      {farm.phoneNumber ? (
        <Pressable onPress={() => Linking.openURL(`tel:${farm.phoneNumber}`)}>
          <Text style={{ color: colors.accent, fontWeight: "700", marginTop: 4 }}>{farm.phoneNumber}</Text>
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
          <Text style={styles.muted}>
            Placed {data.activeFlock.placementDate}
            {data.activeFlock.flockWeek != null ? ` · Week ${data.activeFlock.flockWeek}` : ""}
          </Text>
        </View>
      ) : (
        <View style={styles.card}>
          <Text>No active flock</Text>
        </View>
      )}

      <Text style={[styles.title, { fontSize: 20, marginVertical: 8 }]}>{farm.farmName}</Text>
      {data.houses.map((h) => {
        const sc = statusColor(h.status);
        return (
          <View key={h.id} style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 17, fontWeight: "800" }}>
                House {h.houseNumber}
                {h.cumulativeMortality != null ? ` · Mort. ${h.cumulativeMortality}` : ""}
                {h.projectedHeadCount != null
                  ? ` · PHC ${h.projectedHeadCount.toLocaleString()}`
                  : ""}
              </Text>
              <Text style={[styles.badge, { backgroundColor: sc.bg, color: sc.fg }]}>{h.status}</Text>
            </View>
            {h.weeklyMortality.length > 0 ? (
              <Text style={{ marginTop: 8 }}>
                {h.weeklyMortality.map((w) => `W${w.week} ${w.total}`).join("  ·  ")}
              </Text>
            ) : (
              <Text style={[styles.muted, { marginTop: 8 }]}>No weekly mortality yet.</Text>
            )}
            <Text style={[styles.muted, { marginTop: 8 }]}>
              Remaining {h.remainingBirdCount?.toLocaleString() ?? "—"}
              {h.recommendedMinVent ? ` · Min vent ${h.recommendedMinVent}` : ""}
            </Text>
          </View>
        );
      })}

      <Text style={[styles.title, { fontSize: 20, marginVertical: 8 }]}>Log visit</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={[styles.input, { minHeight: 64 }]}
          multiline
          value={visitNotes}
          onChangeText={setVisitNotes}
          placeholder="Optional notes"
        />
        <Pressable
          style={styles.button}
          onPress={() => {
            const res = createVisit({
              farmId: farm.id,
              flockId: data.activeFlock?.id,
              visitDate: todayKey(),
              notes: visitNotes || null,
            });
            setVisitNotes("");
            setVisitMsg(`Saved · bird age ${res.birdAgeInDays ?? "—"}d · Healthy`);
            load();
          }}
        >
          <Text style={styles.buttonText}>Save routine visit</Text>
        </Pressable>
        {visitMsg ? <Text style={[styles.muted, { marginTop: 8 }]}>{visitMsg}</Text> : null}
      </View>

      {data.visits.length > 0 ? (
        <>
          <Text style={[styles.title, { fontSize: 18, marginVertical: 8 }]}>Recent visits</Text>
          {data.visits.map((v) => (
            <View key={v.id} style={styles.card}>
              <Text style={{ fontWeight: "700" }}>
                {v.visitDate} · {v.visitType}
                {v.birdAgeInDays != null ? ` · ${v.birdAgeInDays}d` : ""}
              </Text>
              <Text style={styles.muted}>{v.generalBirdCondition ?? "—"}</Text>
              {v.notes ? <Text style={{ marginTop: 4 }}>{v.notes}</Text> : null}
            </View>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}
