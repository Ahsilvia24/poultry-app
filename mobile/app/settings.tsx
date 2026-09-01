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
import { FARM_ORDER_OPTIONS, type FarmOrder } from "../src/lib/farmOrder";
import { colors, styles } from "../src/theme";
import { WheelPicker } from "../src/components/WheelPicker";

const noFocusRing =
  Platform.OS === "web"
    ? ({
        outlineWidth: 0,
        outlineStyle: "none",
        outlineColor: "transparent",
        boxShadow: "none",
      } as const)
    : null;

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
          {Platform.OS === "web"
            ? createElement("style", {
                dangerouslySetInnerHTML: {
                  __html:
                    "input:focus{outline:none!important;box-shadow:none!important;-webkit-tap-highlight-color:transparent}",
                },
              })
            : null}

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
              style={[
                {
                  flex: 1,
                  minWidth: 0,
                  fontSize: 17,
                  fontWeight: "600",
                  color: colors.text,
                  paddingVertical: 6,
                  paddingHorizontal: 0,
                  borderWidth: 0,
                  backgroundColor: "transparent",
                },
                noFocusRing,
              ]}
              value={serviceTech}
              onChangeText={onChangeServiceTech}
              autoCapitalize="words"
              autoCorrect={false}
              textContentType="name"
              autoComplete="name"
              placeholder="Name"
              placeholderTextColor={colors.muted}
              selectionColor={colors.muted}
              underlineColorAndroid="transparent"
              accessibilityLabel="Service technician name"
            />
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text }}>
              Order by:
            </Text>
            <View style={{ flex: 1, minWidth: 0 }}>
              <WheelPicker
                options={FARM_ORDER_OPTIONS.map((option) => ({
                  value: option.key,
                  label: option.label,
                }))}
                value={farmOrder}
                onChange={onChangeFarmOrder}
              />
            </View>
          </View>

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
