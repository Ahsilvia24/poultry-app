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
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth";
import { getFarmOrder, getServiceTech, setFarmOrder, setServiceTech } from "../src/lib/appSettings";
import { FARM_ORDER_OPTIONS, parseFarmOrder, type FarmOrder } from "../src/lib/farmOrder";
import { colors, styles } from "../src/theme";
import { Card } from "../src/components/ui";
import { OptionPicker } from "../src/components/OptionPicker";

export default function SettingsScreen() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [serviceTech, setServiceTechName] = useState(getServiceTech);
  const [farmOrder, setFarmOrderValue] = useState<FarmOrder>(getFarmOrder);
  const [farmOrderOpen, setFarmOrderOpen] = useState(false);
  const farmOrderLabel =
    FARM_ORDER_OPTIONS.find((option) => option.key === farmOrder)?.label ?? "Name A to Z";

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
              marginBottom: 16,
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

          <Card>
            <Text style={styles.label}>Service Tech</Text>
            <TextInput
              style={styles.input}
              value={serviceTech}
              onChangeText={onChangeServiceTech}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              autoComplete="name"
              placeholder="Name on checklists"
              placeholderTextColor={colors.muted}
            />
          </Card>

          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <Text style={[styles.label, { marginBottom: 0, flexShrink: 0 }]}>Order farms by</Text>
              {Platform.OS === "web" ? (
                <View style={{ flex: 1, minWidth: 0 }}>
                  {createElement(
                    "select",
                    {
                      value: farmOrder,
                      "aria-label": "Order farms by",
                      onChange: (e: { target: { value: string } }) =>
                        onChangeFarmOrder(parseFarmOrder(e.target.value)),
                      style: {
                        width: "100%",
                        minHeight: 52,
                        border: "1px solid #d6d3d1",
                        borderRadius: 12,
                        paddingLeft: 14,
                        paddingRight: 14,
                        fontSize: 17,
                        fontWeight: 600,
                        backgroundColor: "#fff",
                        color: colors.text,
                      },
                    },
                    FARM_ORDER_OPTIONS.map((option) =>
                      createElement("option", { key: option.key, value: option.key }, option.label),
                    ),
                  )}
                </View>
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Order farms by, ${farmOrderLabel}`}
                  onPress={() => setFarmOrderOpen(true)}
                  style={[
                    styles.input,
                    {
                      flex: 1,
                      minWidth: 0,
                      marginBottom: 0,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                    },
                  ]}
                >
                  <Text numberOfLines={1} style={{ color: colors.text, fontWeight: "600", flex: 1 }}>
                    {farmOrderLabel}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={colors.muted} />
                </Pressable>
              )}
            </View>
          </Card>

          <OptionPicker
            open={farmOrderOpen}
            title="Order farms by"
            options={FARM_ORDER_OPTIONS.map((option) => ({
              value: option.key,
              label: option.label,
            }))}
            value={farmOrder}
            onSelect={(value) => onChangeFarmOrder(parseFarmOrder(value))}
            onClose={() => setFarmOrderOpen(false)}
          />

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
