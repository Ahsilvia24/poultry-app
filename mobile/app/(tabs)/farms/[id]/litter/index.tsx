import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "../../../../../src/theme";
import { BackHeader, Card } from "../../../../../src/components/ui";
import { SwipeCommitDeleteRow } from "../../../../../src/components/SwipeCommitDeleteRow";
import { deleteLitterEvent, listFarmLitterEvents } from "../../../../../src/repos/data";
import { formatServiceShortDate } from "../../../../../src/lib/serviceForms/format";
import { LITTER_EVENT_LABELS } from "../../../../../src/lib/opsLabels";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

type LitterRow = {
  id: string;
  eventDate: string;
  eventType: string;
};

export default function FarmLitterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const farmId = paramId(params.id);
  const [events, setEvents] = useState<LitterRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!farmId) {
      setEvents([]);
      return;
    }
    try {
      setEvents(listFarmLitterEvents(farmId));
      setError(null);
    } catch (e) {
      setEvents([]);
      setError(e instanceof Error ? e.message : "Could not load litter");
    }
  }, [farmId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openEvent(eventId: string) {
    router.push({
      pathname: "/(tabs)/farms/[id]/litter/[eventId]",
      params: { id: farmId, eventId },
    });
  }

  function removeEvent(eventId: string) {
    try {
      deleteLitterEvent(farmId, eventId);
      setEvents((prev) => prev.filter((row) => row.id !== eventId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete litter event");
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
          title="Litter"
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
              pathname: "/(tabs)/farms/[id]/record-litter",
              params: { id: farmId },
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Log litter"
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
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Log Litter</Text>
        </Pressable>

        {error ? (
          <Text style={{ color: colors.danger, fontWeight: "600", marginBottom: 8 }}>{error}</Text>
        ) : null}

        {events.length === 0 ? (
          <Text style={{ color: colors.muted }}>No litter events yet.</Text>
        ) : (
          events.map((event) => {
            const title = LITTER_EVENT_LABELS[event.eventType] ?? event.eventType;
            const dateLabel = formatServiceShortDate(event.eventDate);
            return (
              <SwipeCommitDeleteRow
                key={event.id}
                onDelete={() => removeEvent(event.id)}
                style={{ marginBottom: 10 }}
                deleteContent={
                  <View
                    accessibilityLabel={`Delete ${title} ${dateLabel}`}
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
                    onPress={() => openEvent(event.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`View or edit ${title} ${dateLabel}`}
                  >
                    <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text }}>
                      {title}
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
