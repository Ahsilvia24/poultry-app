import { Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getFarmDetail } from "../../../../../src/repos/data";
import { colors, styles } from "../../../../../src/theme";
import { Card } from "../../../../../src/components/ui";

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
    subtitle: "Prebrood checklist → visit + PDF",
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
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 4,
          }}
        >
          <Pressable
            onPress={() => {
              if (router.canGoBack()) router.back();
              else
                router.replace({
                  pathname: "/(tabs)/farms/[id]",
                  params: { id: farmId },
                });
            }}
            style={{
              flexShrink: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 2,
              minWidth: 0,
            }}
            accessibilityRole="button"
            accessibilityLabel="Back to farm"
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} style={{ marginRight: -4 }} />
            <Text style={[styles.title, { flexShrink: 1 }]} numberOfLines={1}>
              {farmName}
            </Text>
          </Pressable>
          <Text style={[styles.title, { flexShrink: 0, textAlign: "right" }]}>Service</Text>
        </View>
        <Text style={[styles.subtitle, { marginBottom: 16 }]}>Choose a checklist</Text>
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
