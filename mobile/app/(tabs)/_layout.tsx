import { Tabs } from "expo-router";
import { Text } from "react-native";
import { colors } from "../../src/theme";

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 11, fontWeight: focused ? "800" : "600", color: focused ? colors.accent : colors.muted }}>
      {label}
    </Text>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTitleStyle: { fontWeight: "800", color: colors.text },
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopColor: colors.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused }) => <TabIcon label="Home" focused={focused} />,
          tabBarLabel: "Home",
        }}
      />
      <Tabs.Screen
        name="farms"
        options={{
          title: "Farms",
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon label="Farms" focused={focused} />,
          tabBarLabel: "Farms",
        }}
      />
      <Tabs.Screen
        name="mortality"
        options={{
          title: "Mortality",
          tabBarIcon: ({ focused }) => <TabIcon label="Mort" focused={focused} />,
          tabBarLabel: "Mortality",
        }}
      />
    </Tabs>
  );
}
