import { useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Keyboard,
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
import { createFarm } from "../../../src/repos/data";
import { colors, styles } from "../../../src/theme";
import { Card, PageHeader } from "../../../src/components/ui";

const noFocusRing =
  Platform.OS === "web"
    ? ({
        outlineWidth: 0,
        outlineStyle: "none",
        outlineColor: "transparent",
        boxShadow: "none",
      } as const)
    : null;

const valueChip = {
  minHeight: 36,
  borderRadius: 10,
  backgroundColor: "#e7e5e4",
  paddingHorizontal: 10,
  justifyContent: "center" as const,
};

const valueText = {
  fontSize: 15,
  fontWeight: "600" as const,
  color: colors.text,
  textAlign: "right" as const,
};

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        minHeight: 44,
      }}
    >
      <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text, flex: 1, flexShrink: 1 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function ChipInput({
  value,
  onChangeText,
  accessibilityLabel,
  keyboardType,
  autoCapitalize,
  wide,
  placeholder,
}: {
  value: string;
  onChangeText: (value: string) => void;
  accessibilityLabel: string;
  keyboardType?: "number-pad";
  autoCapitalize?: "words" | "none";
  wide?: boolean;
  placeholder?: string;
}) {
  const chipStyle = wide
    ? [valueChip, { minWidth: 152, maxWidth: 224, flex: 1 }]
    : [valueChip, valueText, { width: 76, paddingVertical: 6, borderWidth: 0 }, noFocusRing];

  return (
    <View style={wide ? chipStyle : undefined}>
      <TextInput
        style={
          wide
            ? [valueText, { paddingVertical: 6, borderWidth: 0 }, noFocusRing]
            : chipStyle
        }
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        underlineColorAndroid="transparent"
        accessibilityLabel={accessibilityLabel}
        returnKeyType="done"
        blurOnSubmit
        onSubmitEditing={() => Keyboard.dismiss()}
      />
    </View>
  );
}

function parseOptionalCount(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.min(4, Math.floor(n)));
}

export default function NewFarmScreen() {
  const router = useRouter();
  const [farmName, setFarmName] = useState("");
  const [growerName, setGrowerName] = useState("");
  const [numberOfHouses, setNumberOfHouses] = useState("");
  const [numberOfGenerators, setNumberOfGenerators] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const { id } = createFarm({
        farmName,
        growerName,
        numberOfHouses: Number(numberOfHouses) || 0,
        numberOfGenerators: parseOptionalCount(numberOfGenerators),
      });
      router.replace({ pathname: "/(tabs)/farms/[id]", params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create farm");
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
          <PageHeader
            title="Add Farm"
            actions={
              <Pressable onPress={() => router.back()} hitSlop={8}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>Cancel</Text>
              </Pressable>
            }
          />

          <Card>
            <FieldRow label="Farm name">
              <ChipInput
                value={farmName}
                onChangeText={setFarmName}
                accessibilityLabel="Farm name"
                autoCapitalize="words"
                wide
              />
            </FieldRow>
            <FieldRow label="Number of houses">
              <ChipInput
                value={numberOfHouses}
                onChangeText={(next) => setNumberOfHouses(next.replace(/[^\d]/g, ""))}
                accessibilityLabel="Number of houses"
                keyboardType="number-pad"
              />
            </FieldRow>
            <FieldRow label="Number of generators">
              <ChipInput
                value={numberOfGenerators}
                onChangeText={(next) => setNumberOfGenerators(next.replace(/[^\d]/g, ""))}
                accessibilityLabel="Number of generators"
                keyboardType="number-pad"
              />
            </FieldRow>
            <FieldRow label="Grower name">
              <ChipInput
                value={growerName}
                onChangeText={setGrowerName}
                accessibilityLabel="Grower name"
                autoCapitalize="words"
                wide
              />
            </FieldRow>

            {error ? (
              <Text style={{ color: colors.danger, marginTop: 8, fontWeight: "600" }}>
                {error}
              </Text>
            ) : null}

            <View style={{ marginTop: 12, alignItems: "flex-end" }}>
              {busy ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Pressable
                  onPress={onSubmit}
                  style={{
                    backgroundColor: colors.accent,
                    borderRadius: 10,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: "#fff", fontWeight: "700", fontSize: 14 }}>Create farm</Text>
                </Pressable>
              )}
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
