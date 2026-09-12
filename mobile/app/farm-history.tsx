import { useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { FarmHistoryPanel } from "../src/components/FarmHistoryPanel";
import { BackHeader, Card } from "../src/components/ui";
import { WheelPicker } from "../src/components/WheelPicker";
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
            <View
              style={{
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderWidth: 1,
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 10,
                marginBottom: 16,
              }}
            >
              <Text style={[styles.label, { marginBottom: 4 }]}>Farm</Text>
              <WheelPicker
                accessibilityLabel="Farm"
                options={farms.map((farm) => ({ value: farm.id, label: farm.farmName }))}
                value={farmId}
                onChange={setFarmId}
              />
            </View>
            <FarmHistoryPanel farmId={farmId} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
