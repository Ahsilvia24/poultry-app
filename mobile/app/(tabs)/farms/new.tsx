import { useRef, useState } from "react";
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
import { SettingsChipInput, SettingsRow } from "../../../src/components/SettingsLayout";
import { createFarm } from "../../../src/repos/data";
import { colors, styles } from "../../../src/theme";
import { Card, PageHeader } from "../../../src/components/ui";

function parseOptionalCount(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.min(4, Math.floor(n)));
}

export default function NewFarmScreen() {
  const router = useRouter();
  const housesRef = useRef<TextInput>(null);
  const generatorsRef = useRef<TextInput>(null);
  const growerRef = useRef<TextInput>(null);
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
            <SettingsRow label="Farm name">
              <SettingsChipInput
                value={farmName}
                onChangeText={setFarmName}
                accessibilityLabel="Farm name"
                autoCapitalize="words"
                wide
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => housesRef.current?.focus()}
              />
            </SettingsRow>
            <SettingsRow label="Number of houses">
              <SettingsChipInput
                inputRef={housesRef}
                value={numberOfHouses}
                onChangeText={(next) => setNumberOfHouses(next.replace(/[^\d]/g, ""))}
                accessibilityLabel="Number of houses"
                keyboardType="number-pad"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => generatorsRef.current?.focus()}
              />
            </SettingsRow>
            <SettingsRow label="Number of generators">
              <SettingsChipInput
                inputRef={generatorsRef}
                value={numberOfGenerators}
                onChangeText={(next) => setNumberOfGenerators(next.replace(/[^\d]/g, ""))}
                accessibilityLabel="Number of generators"
                keyboardType="number-pad"
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => growerRef.current?.focus()}
              />
            </SettingsRow>
            <SettingsRow label="Grower name">
              <SettingsChipInput
                inputRef={growerRef}
                value={growerName}
                onChangeText={setGrowerName}
                accessibilityLabel="Grower name"
                autoCapitalize="words"
                wide
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={() => Keyboard.dismiss()}
              />
            </SettingsRow>

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
