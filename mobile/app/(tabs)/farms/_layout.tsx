import { Stack } from "expo-router";
import { colors } from "../../../src/theme";

export default function FarmsLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        // Push from the right; replace/back uses pop so the page slides right.
        animation: "slide_from_right",
        animationTypeForReplace: "pop",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="new" />
      {/* One farm-detail screen — switching farms updates it instead of stacking. */}
      <Stack.Screen name="[id]" dangerouslySingular={() => "farm-detail"} />
    </Stack>
  );
}
