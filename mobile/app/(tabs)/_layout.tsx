import { Tabs, router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { StackActions } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { colors } from "../../src/theme";
import { FeedBinIcon } from "../../src/components/FeedBinIcon";
import {
  clearFarmReturnFromMortality,
  getFarmNavContext,
} from "../../src/lib/farmNavContext";
import { requestTabScrollTop, tabStackIndex } from "../../src/lib/tabScroll";

type MciName = ComponentProps<typeof MaterialCommunityIcons>["name"];

const TAB_ITEMS: {
  name: string;
  label: string;
  icon?: MciName;
  customIcon?: "feed-bin";
}[] = [
  { name: "index", label: "Dashboard", icon: "view-dashboard-outline" },
  { name: "farms", label: "Farms", icon: "barn" },
  { name: "mortality", label: "Mortality", icon: "plus-circle" },
  { name: "lfo", label: "LFO", customIcon: "feed-bin" },
  { name: "tools", label: "Weight Proj.", icon: "scale-bathroom" },
];

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

                // Farms tab always opens the main list — never the last farm detail
                // from Mortality history. Use "Back to House" for that farm.
                if (route.name === "farms") {
                  clearFarmReturnFromMortality();
                  navigation.navigate("farms", { screen: "index" });
                  popNestedToRoot(tabRoute);
                  router.replace("/(tabs)/farms");
                  requestTabScrollTop("farms");
                  return;
                }

                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (event.defaultPrevented) return;

                if (focused) {
                  // Re-tap LFO while already on that tab → root list.
                  if (route.name === "lfo") {
                    popNestedToRoot(tabRoute);
                    requestTabScrollTop("lfo");
                    return;
                  }
                  if (route.name === "mortality") {
                    navigation.navigate(route.name, {
                      farmId: ctx.farmId ?? undefined,
                      houseFlockId: ctx.houseFlockId ?? undefined,
                    });
                    requestTabScrollTop("mortality");
                    return;
                  }
                  requestTabScrollTop(route.name);
                  return;
                }

                if (route.name === "mortality") {
                  navigation.navigate(route.name, {
                    farmId: ctx.farmId ?? undefined,
                    houseFlockId: ctx.houseFlockId ?? undefined,
                  });
                } else {
                  navigation.navigate(route.name);
                }
                requestTabScrollTop(route.name);
              }}
              style={{
                flex: 1,
                borderRadius: 10,
                paddingVertical: 8,
                paddingHorizontal: 2,
                alignItems: "center",
                justifyContent: "center",
                gap: 2,
                backgroundColor: focused ? colors.accentDark : "transparent",
              }}
            >
              {item?.customIcon === "feed-bin" ? (
                <FeedBinIcon color={focused ? "#fff" : "#44403c"} size={20} />
              ) : item?.icon ? (
                <MaterialCommunityIcons
                  name={item.icon}
                  size={20}
                  color={focused ? "#fff" : "#44403c"}
                />
              ) : null}
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
          title: "Weight Proj.",
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
