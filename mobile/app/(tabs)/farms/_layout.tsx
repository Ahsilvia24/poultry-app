import { Stack } from "expo-router";
import { colors } from "../../../src/theme";

export default function FarmsLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontWeight: "800" },
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Farms" }} />
      <Stack.Screen name="[id]" options={{ title: "Farm" }} />
    </Stack>
  );
}
