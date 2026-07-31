import { Tabs, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { StackActions } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/theme";
import {
  armFarmReturnFromMortality,
  clearFarmReturnFromMortality,
  getFarmNavContext,
} from "../../src/lib/farmNavContext";
import { requestTabScrollTop, tabStackIndex } from "../../src/lib/tabScroll";

const TAB_ITEMS = [
  { name: "index", label: "Dashboard", href: "/" },
  { name: "farms", label: "Farms" },
  { name: "mortality", label: "Mortality" },
  { name: "lfo", label: "LFO" },
  { name: "tools", label: "Tools" },
] as const;

function WebStyleTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const focusedRoute = state.routes[state.index];
  const focusedOptions = descriptors[focusedRoute?.key]?.options ?? {};
  const tabBarStyle = focusedOptions.tabBarStyle;
  const styleList = Array.isArray(tabBarStyle)
    ? tabBarStyle
    : tabBarStyle
      ? [tabBarStyle]
      : [];
  if (styleList.some((s: { display?: string } | undefined) => s?.display === "none")) {
    return null;
  }

  const visibleRoutes = state.routes.filter((route: { name: string }) =>
    TAB_ITEMS.some((t) => t.name === route.name),
  );

  function popNestedToRoot(tabRoute: { state?: { index?: number; key?: string } }) {
    const nested = tabStackIndex(tabRoute);
    if (nested.index > 0 && nested.key) {
      navigation.dispatch({
        ...StackActions.popToTop(),
        target: nested.key,
      });
      return true;
    }
    return false;
  }

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: "#fff",
        paddingTop: 8,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingHorizontal: 4,
      }}
    >
      <View style={{ flexDirection: "row", gap: 4 }}>
        {visibleRoutes.map((route: { key: string; name: string; state?: any }) => {
          const index = state.routes.findIndex((r: { key: string }) => r.key === route.key);
          const focused = state.index === index;
          const item = TAB_ITEMS.find((t) => t.name === route.name);
          const label = item?.label ?? descriptors[route.key]?.options?.title ?? route.name;
          const tabRoute = state.routes[index] as { key: string; name: string; state?: any };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={() => {
                const ctx = getFarmNavContext();
                const fromMortality = focusedRoute?.name === "mortality";

                // Mortality → Farms: open the selected farm/house.
                // Do not emit tabPress (nested stacks popToTop on that event).
                // Do not navigate to farms/index — that was forcing the list.
                // Open the selected farm, but do not snap to a house —
                // only Mortality "Back to House" passes focusHouseFlockId.
                if (!focused && route.name === "farms" && fromMortality && ctx.farmId) {
                  armFarmReturnFromMortality();
                  router.navigate({
                    pathname: "/(tabs)/farms/[id]",
                    params: {
                      id: ctx.farmId,
                    },
                  });
                  return;
                }

                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (event.defaultPrevented) return;

                if (focused) {
                  // Re-tap Farms/LFO while already on that tab → root list.
                  if (route.name === "farms") {
                    clearFarmReturnFromMortality();
                    popNestedToRoot(tabRoute);
                    requestTabScrollTop("farms");
                    return;
                  }
                  if (route.name === "lfo") {
                    popNestedToRoot(tabRoute);
                    requestTabScrollTop("lfo");
                    return;
                  }
                  if (route.name === "mortality") {
                    navigation.navigate(route.name, {
                      // Always pass strings so sticky Expo Router params clear when unset.
                      farmId: ctx.farmId ?? "",
                      houseFlockId: ctx.houseFlockId ?? "",
                    });
                    requestTabScrollTop("mortality");
                    return;
                  }
                  requestTabScrollTop(route.name);
                  return;
                }

                // Switching tabs — restore last screen (never force Farms → list).
                if (route.name === "farms") {
                  navigation.navigate("farms");
                  return;
                }
                if (route.name === "mortality") {
                  navigation.navigate(route.name, {
                    // Always pass strings so sticky Expo Router params clear when unset.
                    farmId: ctx.farmId ?? "",
                    houseFlockId: ctx.houseFlockId ?? "",
                  });
                } else {
                  navigation.navigate(route.name);
                }
                requestTabScrollTop(route.name);
              }}
              style={{
                flex: 1,
                borderRadius: 10,
                paddingVertical: 12,
                paddingHorizontal: 2,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: focused ? colors.accentDark : "transparent",
              }}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  fontSize: 11,
                  fontWeight: "800",
                  color: focused ? "#fff" : "#44403c",
                  textAlign: "center",
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <WebStyleTabBar {...props} />}
      screenOptions={{
        // Mount all tabs up front so the first visit to each tab isn't a janky remount.
        lazy: false,
        headerStyle: { backgroundColor: colors.headerBg },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: "800",
          color: colors.text,
          fontSize: 17,
        },
        headerTintColor: colors.accentDark,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="farms"
        options={{
          title: "Farms",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="mortality"
        options={{
          title: "Mortality",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="lfo"
        options={{
          title: "LFO",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: "Tools",
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Reports",
          href: null,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: "More",
          href: null,
          headerShown: false,
        }}
      />
    </Tabs>
  );
}
