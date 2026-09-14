import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "../../../../../src/theme";
import { BackHeader, Card } from "../../../../../src/components/ui";
import { SwipeCommitDeleteRow } from "../../../../../src/components/SwipeCommitDeleteRow";
import { deleteVisit, listFarmVisits } from "../../../../../src/repos/data";
import { formatServiceShortDate } from "../../../../../src/lib/serviceForms/format";
import { VISIT_TYPE_LABELS } from "../../../../../src/lib/visits";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

type VisitRow = {
  id: string;
  visitDate: string;
  visitType: string;
};

export default function FarmVisitsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const farmId = paramId(params.id);
  const [visits, setVisits] = useState<VisitRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!farmId) {
      setVisits([]);
      return;
    }
    try {
      setVisits(listFarmVisits(farmId));
      setError(null);
    } catch (e) {
      setVisits([]);
      setError(e instanceof Error ? e.message : "Could not load visits");
    }
  }, [farmId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openVisit(visitId: string) {
    router.push({
      pathname: "/(tabs)/farms/[id]/visits/[visitId]",
      params: { id: farmId, visitId },
    });
  }

  function removeVisit(visitId: string) {
    try {
      deleteVisit(farmId, visitId);
      setVisits((prev) => prev.filter((row) => row.id !== visitId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete visit");
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingBottom: 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        <BackHeader
          backLabel="Farm"
          title="Logged Visits"
          accessibilityLabel="Back to farm"
          onBack={() =>
            router.replace({
              pathname: "/(tabs)/farms/[id]",
              params: { id: farmId },
            })
          }
        />

        <Pressable
          onPress={() =>
            router.push({
              pathname: "/(tabs)/farms/[id]/log-visit",
              params: { id: farmId },
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Log visit"
          style={{
            minHeight: 44,
            marginBottom: 16,
            borderRadius: 10,
            backgroundColor: colors.accentDark,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Log Visit</Text>
        </Pressable>

        {error ? (
          <Text style={{ color: colors.danger, fontWeight: "600", marginBottom: 8 }}>{error}</Text>
        ) : null}

        {visits.length === 0 ? (
          <Text style={{ color: colors.muted }}>No logged visits yet.</Text>
        ) : (
          visits.map((visit) => {
            const typeLabel = VISIT_TYPE_LABELS[visit.visitType] ?? visit.visitType;
            const dateLabel = formatServiceShortDate(visit.visitDate);
            return (
              <SwipeCommitDeleteRow
                key={visit.id}
                onDelete={() => removeVisit(visit.id)}
                style={{ marginBottom: 10 }}
                deleteContent={
                  <View
                    accessibilityLabel={`Delete ${typeLabel} ${dateLabel}`}
                    style={{ alignItems: "center" }}
                  >
                    <Ionicons name="trash-outline" size={22} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12, marginTop: 4 }}>
                      Delete
                    </Text>
                  </View>
                }
              >
                <Card style={{ marginBottom: 0, paddingVertical: 12, paddingHorizontal: 14 }}>
                  <Pressable
                    onPress={() => openVisit(visit.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`View or edit ${typeLabel} ${dateLabel}`}
                  >
                    <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text }}>
                      {typeLabel}
                    </Text>
                    <Text style={{ marginTop: 2, color: colors.muted, fontWeight: "600" }}>
                      {dateLabel}
                    </Text>
                  </Pressable>
                </Card>
              </SwipeCommitDeleteRow>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
