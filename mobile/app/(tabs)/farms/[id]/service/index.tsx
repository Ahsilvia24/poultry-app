import { useCallback, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, styles } from "../../../../../src/theme";
import { BackHeader, Card } from "../../../../../src/components/ui";
import {
  deleteServiceFormDraft,
  listServiceFormDraftKinds,
} from "../../../../../src/repos/data";
import type { ServiceFormKind } from "../../../../../src/lib/serviceForms/types";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

const FORMS = [
  {
    key: "service_report" as const,
    title: "Service Report",
    path: "/(tabs)/farms/[id]/service/report" as const,
  },
  {
    key: "placement" as const,
    title: "Placement",
    path: "/(tabs)/farms/[id]/service/placement" as const,
  },
  {
    key: "prebrood" as const,
    title: "Prebrood (48–72 hr)",
    path: "/(tabs)/farms/[id]/service/prebrood" as const,
  },
] as const;

export default function ServiceFarmPickerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const farmId = paramId(params.id);
  const [draftKinds, setDraftKinds] = useState<ServiceFormKind[]>([]);

  useFocusEffect(
    useCallback(() => {
      try {
        setDraftKinds(farmId ? listServiceFormDraftKinds(farmId) : []);
      } catch {
        setDraftKinds([]);
      }
    }, [farmId]),
  );

  function openForm(path: (typeof FORMS)[number]["path"], fresh = false) {
    router.push({
      pathname: path,
      params: { id: farmId, ...(fresh ? { fresh: "1" } : {}) },
    });
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <View style={[styles.content, { flex: 1 }]}>
        <BackHeader
          backLabel="Farm"
          title="Service Farm"
          accessibilityLabel="Back to farm"
          onBack={() => {
            if (router.canGoBack()) router.back();
            else
              router.replace({
                pathname: "/(tabs)/farms/[id]",
                params: { id: farmId },
              });
          }}
        />
        <View style={{ gap: 6 }}>
          {FORMS.map((form) => {
            const inProgress = draftKinds.includes(form.key);
            return (
              <Card
                key={form.key}
                style={{ marginBottom: 0, paddingVertical: 12, paddingHorizontal: 14 }}
              >
                <Pressable
                  onPress={() => openForm(form.path)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
                  accessibilityRole="button"
                  accessibilityLabel={
                    inProgress ? `Resume ${form.title}` : form.title
                  }
                >
                  <Text style={{ fontWeight: "800", fontSize: 17, color: colors.text }}>
                    {form.title}
                  </Text>
                  {inProgress ? (
                    <Text style={{ marginTop: 2, color: colors.muted, fontWeight: "600" }}>
                      In progress
                    </Text>
                  ) : null}
                </Pressable>
                {inProgress ? (
                  <Pressable
                    onPress={() => {
                      try {
                        deleteServiceFormDraft(farmId, form.key);
                      } catch {
                        // Open a blank form even if delete fails.
                      }
                      setDraftKinds((prev) => prev.filter((k) => k !== form.key));
                      openForm(form.path, true);
                    }}
                    hitSlop={8}
                    style={{ marginTop: 8, alignSelf: "flex-start", minHeight: 32, justifyContent: "center" }}
                    accessibilityRole="button"
                    accessibilityLabel={`Start over ${form.title}`}
                  >
                    <Text style={{ color: colors.accentDark, fontWeight: "700" }}>
                      Start over
                    </Text>
                  </Pressable>
                ) : null}
              </Card>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}
