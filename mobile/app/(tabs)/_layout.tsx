import { Tabs } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../src/theme";

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
        {visibleRoutes.map((route: { key: string; name: string }) => {
          const index = state.routes.findIndex((r: { key: string }) => r.key === route.key);
          const focused = state.index === index;
          const item = TAB_ITEMS.find((t) => t.name === route.name);
          const label = item?.label ?? descriptors[route.key]?.options?.title ?? route.name;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={focused ? { selected: true } : {}}
              onPress={() => {
                const event = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (event.defaultPrevented) return;
                // Match web nav: tapping an active tab returns to that section's list/root
                if (focused) {
                  navigation.navigate(route.name, { screen: "index" });
                  return;
                }
                navigation.navigate(route.name);
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
