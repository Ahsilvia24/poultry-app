import { Stack } from "expo-router";
import { colors } from "../../../src/theme";

export default function FarmsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        // Single push/pop slide — avoids left-then-right when returning to the list.
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      <Stack.Screen name="[id]" />
    </Stack>
  );
}
