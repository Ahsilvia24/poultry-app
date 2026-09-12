import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors, styles } from "../../../../src/theme";

function paramId(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

/** Old farm History route — Farm History now has its own page. */
export default function FarmHistoryRedirect() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const farmId = paramId(params.id);

  useEffect(() => {
    router.replace({
      pathname: "/farm-history",
      params: farmId ? { farmId } : {},
    });
  }, [farmId, router]);

  return (
    <View style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}>
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}
