import { useCallback, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, styles } from "../../../../../src/theme";
import { BackHeader, Card, formatNumber } from "../../../../../src/components/ui";
import { SwipeCommitDeleteRow } from "../../../../../src/components/SwipeCommitDeleteRow";
import { deleteFeedDelivery, listFarmFeedDeliveries } from "../../../../../src/repos/data";
import { formatServiceShortDate } from "../../../../../src/lib/serviceForms/format";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

type FeedRow = {
  id: string;
  deliveryDate: string;
  poundsDelivered: number;
  feedType: string | null;
};

export default function FarmFeedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const farmId = paramId(params.id);
  const [deliveries, setDeliveries] = useState<FeedRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!farmId) {
      setDeliveries([]);
      return;
    }
    try {
      setDeliveries(listFarmFeedDeliveries(farmId));
      setError(null);
    } catch (e) {
      setDeliveries([]);
      setError(e instanceof Error ? e.message : "Could not load feed");
    }
  }, [farmId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openDelivery(deliveryId: string) {
    router.push({
      pathname: "/(tabs)/farms/[id]/feed/[deliveryId]",
      params: { id: farmId, deliveryId },
    });
  }

  function removeDelivery(deliveryId: string) {
    try {
      deleteFeedDelivery(deliveryId);
      setDeliveries((prev) => prev.filter((row) => row.id !== deliveryId));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete feed delivery");
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
          title="Feed"
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
              pathname: "/(tabs)/farms/[id]/record-feed",
              params: { id: farmId },
            })
          }
          accessibilityRole="button"
          accessibilityLabel="Log feed"
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
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 15 }}>Log Feed</Text>
        </Pressable>

        {error ? (
          <Text style={{ color: colors.danger, fontWeight: "600", marginBottom: 8 }}>{error}</Text>
        ) : null}

        {deliveries.length === 0 ? (
          <Text style={{ color: colors.muted }}>No feed deliveries yet.</Text>
        ) : (
          deliveries.map((delivery) => {
            const title = delivery.feedType?.trim()
              ? delivery.feedType
              : `${formatNumber(delivery.poundsDelivered)} lbs`;
            const dateLabel = formatServiceShortDate(delivery.deliveryDate);
            return (
              <SwipeCommitDeleteRow
                key={delivery.id}
                onDelete={() => removeDelivery(delivery.id)}
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
                    onPress={() => openDelivery(delivery.id)}
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
