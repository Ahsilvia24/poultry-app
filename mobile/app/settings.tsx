import { createElement, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth";
import { getFarmOrder, getServiceTech, setFarmOrder, setServiceTech } from "../src/lib/appSettings";
import { FARM_ORDER_OPTIONS, parseFarmOrder, type FarmOrder } from "../src/lib/farmOrder";
import { colors, styles } from "../src/theme";
import { WheelPicker } from "../src/components/WheelPicker";

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [serviceTech, setServiceTechName] = useState(getServiceTech);
  const [farmOrder, setFarmOrderValue] = useState<FarmOrder>(getFarmOrder);

  function onChangeServiceTech(value: string) {
    setServiceTechName(value);
    setServiceTech(value);
  }

  function onChangeFarmOrder(value: FarmOrder) {
    setFarmOrderValue(value);
    setFarmOrder(value);
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[styles.content, { flexGrow: 1 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={{
              marginBottom: 20,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <Text style={[styles.title, { flex: 1 }]}>Settings</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Done"
              onPress={() => router.back()}
              hitSlop={10}
            >
              <Text style={{ color: colors.text, fontWeight: "700", textDecorationLine: "underline" }}>
                Done
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 22,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>
              Service Tech:
            </Text>
            <TextInput
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: 17,
                fontWeight: "600",
                color: colors.text,
                paddingVertical: 6,
              }}
              value={serviceTech}
              onChangeText={onChangeServiceTech}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              autoComplete="name"
              placeholder="Name"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Service technician name"
            />
          </View>

          <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, marginBottom: 8 }}>
            Order Farms By:
          </Text>
          {Platform.OS === "web" ? (
            createElement(
              "select",
              {
                value: farmOrder,
                "aria-label": "Order farms by",
                onChange: (e: { target: { value: string } }) =>
                  onChangeFarmOrder(parseFarmOrder(e.target.value)),
                style: {
                  width: "100%",
                  minHeight: 44,
                  border: "none",
                  borderBottom: "1px solid #d6d3d1",
                  paddingLeft: 0,
                  paddingRight: 0,
                  fontSize: 17,
                  fontWeight: 600,
                  backgroundColor: "transparent",
                  color: colors.text,
                },
              },
              FARM_ORDER_OPTIONS.map((option) =>
                createElement("option", { key: option.key, value: option.key }, option.label),
              ),
            )
          ) : (
            <WheelPicker
              options={FARM_ORDER_OPTIONS.map((option) => ({
                value: option.key,
                label: option.label,
              }))}
              value={farmOrder}
              onChange={onChangeFarmOrder}
            />
          )}

          <View style={{ flex: 1, minHeight: 48 }} />

          <Pressable
            onPress={() => void signOut()}
            style={{ alignSelf: "center", paddingVertical: 16, paddingHorizontal: 12 }}
          >
            <Text
              style={{
                color: colors.text,
                fontWeight: "700",
                textDecorationLine: "underline",
              }}
            >
              Sign out
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
