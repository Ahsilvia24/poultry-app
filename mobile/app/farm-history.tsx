import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FarmHistoryPanel } from "../src/components/FarmHistoryPanel";
import { BackHeader, Card } from "../src/components/ui";
import { listFarms } from "../src/repos/data";
import { colors, styles } from "../src/theme";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function FarmHistoryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ farmId?: string | string[] }>();
  const farms = useMemo(() => listFarms("all").farms, []);
  const [farmId, setFarmId] = useState(() => {
    const requested = paramId(params.farmId);
    if (requested && farms.some((farm) => farm.id === requested)) return requested;
    return farms[0]?.id ?? "";
  });
  const [pickerOpen, setPickerOpen] = useState(false);
  const selectedName = farms.find((farm) => farm.id === farmId)?.farmName ?? "Farm";

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <BackHeader backLabel="Reports" title="Farm History" onBack={() => router.back()} />
        {farms.length === 0 ? (
          <Card>
            <Text style={styles.muted}>No farms found.</Text>
          </Card>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Farm"
              accessibilityState={{ expanded: pickerOpen }}
              onPress={() => setPickerOpen(true)}
              style={{
                backgroundColor: colors.card,
                borderColor: colors.accentDark,
                borderWidth: 1,
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 12,
                marginBottom: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <Text
                numberOfLines={1}
                style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: "700", color: colors.text }}
              >
                {selectedName}
              </Text>
              <Ionicons name="chevron-down" size={18} color={colors.accentDark} />
            </Pressable>
            <FarmHistoryPanel farmId={farmId} />
          </>
        )}
      </ScrollView>

      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.4)",
            justifyContent: "flex-end",
          }}
          onPress={() => setPickerOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{
              backgroundColor: "#fff",
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 16,
              maxHeight: "70%",
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "800", marginBottom: 8 }}>Farm</Text>
            <ScrollView>
              {farms.map((farm) => (
                <Pressable
                  key={farm.id}
                  onPress={() => {
                    setFarmId(farm.id);
                    setPickerOpen(false);
                  }}
                  style={{
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: "#f5f5f4",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      fontWeight: farmId === farm.id ? "800" : "600",
                      color: colors.text,
                    }}
                  >
                    {farm.farmName}
                  </Text>
                  {farmId === farm.id ? (
                    <Ionicons name="checkmark" size={18} color={colors.accentDark} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
