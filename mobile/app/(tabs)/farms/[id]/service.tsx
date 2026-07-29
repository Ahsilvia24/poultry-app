import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getFarmDetail } from "../../../../src/repos/data";
import { colors, styles } from "../../../../src/theme";
import { Card, PageHeader } from "../../../../src/components/ui";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default function ServiceFarmScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const farmId = paramId(params.id);

  let farmName = "Farm";
  try {
    const detail = getFarmDetail(farmId);
    farmName = detail?.farm.farmName ?? farmName;
  } catch {
    // Still render a safe placeholder even if the farm lookup fails.
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={[styles.content, { flex: 1 }]}>
        <Pressable
          onPress={() => {
            if (router.canGoBack()) router.back();
            else
              router.replace({
                pathname: "/(tabs)/farms/[id]",
                params: { id: farmId },
              });
          }}
          style={{ marginBottom: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Back to farm"
        >
          <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← {farmName}</Text>
        </Pressable>
        <PageHeader title="Service Farm" subtitle={farmName} />
        <Card>
          <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text }}>Coming soon</Text>
          <Text style={[styles.muted, { marginTop: 8 }]}>
            Service visit forms for this farm will live here. Nothing to fill out yet.
          </Text>
        </Card>
      </View>
    </SafeAreaView>
  );
}
