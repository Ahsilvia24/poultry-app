import { useState } from "react";
import {
  ActivityIndicator,
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
import { BrandBar, Card, PageHeader, PrimaryButton } from "../../../src/components/ui";

export default function NewFarmScreen() {
  const router = useRouter();
  const [farmName, setFarmName] = useState("");
  const [growerName, setGrowerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [numberOfHouses, setNumberOfHouses] = useState("4");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      const { id } = createFarm({
        farmName,
        growerName,
        phoneNumber,
        notes,
        numberOfHouses: Number(numberOfHouses) || 0,
      });
      router.replace(`/(tabs)/farms/${id}`);
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
          <BrandBar
            right={
              <Pressable onPress={() => router.back()}>
                <Text style={{ color: colors.text, fontWeight: "700", textDecorationLine: "underline" }}>
                  Cancel
                </Text>
              </Pressable>
            }
          />
          <PageHeader
            title="Add farm"
            subtitle="Farm name and house count get you started — add other details anytime"
          />

          <Card>
            <Text style={styles.label}>Farm name *</Text>
            <TextInput
              style={styles.input}
              value={farmName}
              onChangeText={setFarmName}
              autoCapitalize="words"
              placeholder="Oak Hollow"
              placeholderTextColor={colors.muted}
            />

            <Text style={styles.label}>Number of houses</Text>
            <TextInput
              style={styles.input}
              value={numberOfHouses}
              onChangeText={setNumberOfHouses}
              keyboardType="number-pad"
            />
            <Text style={[styles.muted, { marginTop: -8, marginBottom: 12, fontSize: 12 }]}>
              Creates houses 1–N with default 29,700 sq ft (editable later)
            </Text>

            <Text style={styles.label}>Grower name</Text>
            <TextInput
              style={styles.input}
              value={growerName}
              onChangeText={setGrowerName}
              autoCapitalize="words"
            />

            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>Notes</Text>
            <TextInput
              style={[styles.input, { minHeight: 72, textAlignVertical: "top" }]}
              value={notes}
              onChangeText={setNotes}
              multiline
            />

            {error ? (
              <Text style={{ color: colors.danger, marginBottom: 12, fontWeight: "600" }}>
                {error}
              </Text>
            ) : null}

            <View style={{ marginTop: 4 }}>
              {busy ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <PrimaryButton label="Create farm" onPress={onSubmit} />
              )}
            </View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
