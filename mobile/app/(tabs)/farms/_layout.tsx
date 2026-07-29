import { useCallback } from "react";
import { Stack, useFocusEffect, useNavigation } from "expo-router";
import {
  farmDetailNavParams,
  peekFarmReturnFromMortality,
} from "../../../src/lib/farmNavContext";
import { colors } from "../../../src/theme";

/**
 * When the Farms tab gains focus after Mortality, jump from the list (or a
 * stale stack entry) to the selected farm — from inside this stack, where
 * navigate("[id]") is reliable.
 */
export default function FarmsLayout() {
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      const pending = peekFarmReturnFromMortality();
      if (!pending?.farmId) return;
      // Defer one frame so the tab switch finishes before stacking detail.
      const id = requestAnimationFrame(() => {
        (navigation as any).navigate("[id]", farmDetailNavParams(pending.farmId, pending.houseFlockId));
      });
      return () => cancelAnimationFrame(id);
    }, [navigation]),
  );

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
