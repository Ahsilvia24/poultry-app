import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { getFarmDetail } from "../../../../../src/repos/data";
import { colors, styles } from "../../../../../src/theme";
import { Card, PageHeader } from "../../../../../src/components/ui";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

const FORMS = [
  {
    key: "report",
    title: "Service Report",
    subtitle: "Routine service checklist → visit + PDF",
    path: "/(tabs)/farms/[id]/service/report" as const,
  },
  {
    key: "placement",
    title: "Placement",
    subtitle: "Placement day checklist → visit + PDF",
    path: "/(tabs)/farms/[id]/service/placement" as const,
  },
  {
    key: "prebrood",
    title: "Prebrood (48–72 hr)",
    subtitle: "Prebrood checklist → visit + generator hours + PDF",
    path: "/(tabs)/farms/[id]/service/prebrood" as const,
  },
] as const;

export default function ServiceFarmPickerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const farmId = paramId(params.id);

  let farmName = "Farm";
  try {
    farmName = getFarmDetail(farmId)?.farm.farmName ?? farmName;
  } catch {
    // keep placeholder
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
        <PageHeader title="Service Farm" subtitle="Choose a checklist" />
        <View style={{ gap: 10 }}>
          {FORMS.map((form) => (
            <Pressable
              key={form.key}
              onPress={() =>
                router.push({
                  pathname: form.path,
                  params: { id: farmId },
                })
              }
              style={({ pressed }) => ({
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Card>
                <Text style={{ fontWeight: "800", fontSize: 17, color: colors.text }}>
                  {form.title}
                </Text>
                <Text style={[styles.muted, { marginTop: 4 }]}>{form.subtitle}</Text>
              </Card>
            </Pressable>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
