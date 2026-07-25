import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../src/auth";
import { colors, styles } from "../src/theme";
import { API_BASE_URL } from "../src/config";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("tech@poultry.local");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { justifyContent: "center" }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.content, { maxWidth: 480, width: "100%", alignSelf: "center" }]}>
        <Text style={[styles.title, { color: colors.accentDark }]}>PoultryTech</Text>
        <Text style={styles.subtitle}>Service technician farm management</Text>

        <View style={[styles.card, { marginTop: 24 }]}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
          {error ? (
            <Text style={{ color: colors.danger, marginBottom: 12, fontWeight: "600" }}>{error}</Text>
          ) : null}
          <Pressable style={styles.button} onPress={onSubmit} disabled={busy}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </Pressable>
        </View>
        <Text style={[styles.muted, { marginTop: 12 }]}>
          API: {API_BASE_URL}
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}
