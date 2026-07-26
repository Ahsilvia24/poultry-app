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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { createVisit, getFarmDetail } from "../../../src/repos/data";
import { todayKey } from "../../../src/lib/ids";
import { colors, styles } from "../../../src/theme";
import {
  Card,
  Metric,
  PrimaryButton,
  SectionTitle,
  StatusBadge,
  WeeklyMortalityList,
  formatNumber,
  formatPct,
} from "../../../src/components/ui";

export default function FarmDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ReturnType<typeof getFarmDetail> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visitNotes, setVisitNotes] = useState("");
  const [visitMsg, setVisitMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(getFarmDetail(id!));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [id]);

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
      <SafeAreaView style={styles.screen} edges={["top"]}>
        <View style={styles.content}>
          <Text style={{ color: colors.danger }}>{error ?? "Not found"}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { farm } = data;
  const flockAge =
    data.activeFlock != null
      ? (() => {
          const [y, m, d] = data.activeFlock!.placementDate.split("-").map(Number);
          const placed = Date.UTC(y!, (m ?? 1) - 1, d ?? 1);
          const now = Date.now();
          return Math.max(0, Math.floor((now - placed) / 86400000));
        })()
      : null;

  const birdsPlaced = data.houses.reduce((sum, h) => sum + (h.placedBirdCount ?? 0), 0);
  const cumMort = data.houses.reduce((sum, h) => sum + (h.cumulativeMortality ?? 0), 0);
  const phc = data.houses.reduce((sum, h) => sum + (h.projectedHeadCount ?? 0), 0);

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={{ marginBottom: 8 }}>
          <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← Farms</Text>
        </Pressable>

        <View style={{ marginBottom: 16 }}>
          <Text style={styles.title}>{farm.farmName}</Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 8,
              marginTop: 4,
            }}
          >
            {farm.growerName ? (
              <Text style={styles.subtitle}>{farm.growerName}</Text>
            ) : null}
            {farm.phoneNumber ? (
              <Pressable onPress={() => Linking.openURL(`tel:${farm.phoneNumber}`)}>
                <Text style={{ color: colors.accentDark, fontWeight: "700", fontSize: 15 }}>
                  {farm.phoneNumber}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <PrimaryButton
              label="Enter mortality"
              onPress={() =>
                router.push({ pathname: "/(tabs)/mortality", params: { farmId: farm.id } })
              }
              style={{ flex: 1 }}
            />
            <PrimaryButton
              label="LFO"
              secondary
              onPress={() => router.push("/(tabs)/lfo")}
              style={{ flex: 1 }}
            />
          </View>
        </View>

        {data.activeFlock ? (
          <Card>
            <Text style={{ fontWeight: "800", fontSize: 16 }}>
              Active flock {data.activeFlock.flockNumber}
              {data.activeFlock.flockWeek != null ? ` · Week ${data.activeFlock.flockWeek}` : ""}
            </Text>
            <View style={[styles.row, { marginTop: 12 }]}>
              <Metric label="Flock age" value={flockAge != null ? `${flockAge} days` : "—"} />
              <Metric label="Birds placed" value={formatNumber(birdsPlaced)} />
              <Metric label="Cum. mortality" value={`${cumMort}`} />
              <Metric label="Proj. head count" value={formatNumber(phc || null)} />
            </View>
            <Text style={[styles.muted, { marginTop: 4 }]}>
              Placed {data.activeFlock.placementDate}
              {data.activeFlock.projectedCatchDate
                ? ` · Catch ${data.activeFlock.projectedCatchDate}`
                : ""}
            </Text>
          </Card>
        ) : (
          <Card>
            <Text>No active flock</Text>
          </Card>
        )}

        <SectionTitle>Houses</SectionTitle>
        {data.houses.map((h) => (
          <Card key={h.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
              <Text style={{ fontSize: 17, fontWeight: "800" }}>House {h.houseNumber}</Text>
              <StatusBadge status={h.status} />
            </View>
            <View style={[styles.row, { marginTop: 12 }]}>
              <Metric label="Placed" value={formatNumber(h.placedBirdCount)} />
              <Metric label="Remaining" value={formatNumber(h.remainingBirdCount)} />
              <Metric label="PHC" value={formatNumber(h.projectedHeadCount)} />
              <Metric
                label="Mort."
                value={
                  h.placedBirdCount != null
                    ? `${formatNumber(h.cumulativeMortality)} (${formatPct(h.cumulativeMortalityPct)})`
                    : formatNumber(h.cumulativeMortality)
                }
              />
              <Metric
                label="Projected mortality"
                value={
                  h.projectedMortality != null &&
                  h.placedBirdCount != null &&
                  h.placedBirdCount > 0
                    ? `${formatNumber(h.projectedMortality)} (${formatPct(
                        (h.projectedMortality / h.placedBirdCount) * 100,
                      )})`
                    : formatNumber(h.projectedMortality)
                }
              />
              <Metric
                label="Recommended Min Vent"
                value={h.recommendedMinVent ?? "—"}
              />
            </View>
            {h.weeklyMortality.length > 0 ? (
              <View style={{ borderTopWidth: 1, borderTopColor: "#f5f5f4", paddingTop: 10, marginTop: 4 }}>
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "700",
                    color: colors.muted,
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Weekly mortality
                </Text>
                <WeeklyMortalityList weeks={h.weeklyMortality} />
              </View>
            ) : (
              <Text style={[styles.muted, { marginTop: 8 }]}>No weekly mortality yet.</Text>
            )}
          </Card>
        ))}

        <SectionTitle>Log visit</SectionTitle>
        <Card>
          <Text style={styles.label}>Notes</Text>
          <TextInput
            style={[styles.input, { minHeight: 64 }]}
            multiline
            value={visitNotes}
            onChangeText={setVisitNotes}
            placeholder="Optional notes"
          />
          <PrimaryButton
            label="Save routine visit"
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
          />
          {visitMsg ? <Text style={[styles.muted, { marginTop: 8 }]}>{visitMsg}</Text> : null}
        </Card>

        {data.visits.length > 0 ? (
          <>
            <SectionTitle>Recent visits</SectionTitle>
            {data.visits.map((v) => (
              <Card key={v.id}>
                <Text style={{ fontWeight: "700" }}>
                  {v.visitDate} · {v.visitType}
                  {v.birdAgeInDays != null ? ` · ${v.birdAgeInDays}d` : ""}
                </Text>
                <Text style={styles.muted}>{v.generalBirdCondition ?? "—"}</Text>
                {v.notes ? <Text style={{ marginTop: 4 }}>{v.notes}</Text> : null}
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
