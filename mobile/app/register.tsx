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
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/auth";
import { DEFAULT_API_BASE_URL } from "../src/config";
import { colors, styles } from "../src/theme";
import { Card } from "../src/components/ui";

export default function RegisterScreen() {
  const { signUp, apiBaseUrl } = useAuth();
  const [website, setWebsite] = useState(apiBaseUrl || DEFAULT_API_BASE_URL);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true);
    setError(null);
    try {
      await signUp(name.trim(), email.trim(), password, website.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={[styles.screen, { justifyContent: "center" }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.content, { maxWidth: 480, width: "100%", alignSelf: "center" }]}>
          <Text style={[styles.title, { fontSize: 26 }]}>Create account</Text>
          <Text style={styles.subtitle}>
            This is the same account as the website. Farms you add here show up there, and the
            other way around.
          </Text>

          <Card style={{ marginTop: 24 }}>
            <Text style={styles.label}>Website address</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="https://your-app.onrender.com"
              placeholderTextColor={colors.muted}
              value={website}
              onChangeText={setWebsite}
            />
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
            <Text style={styles.label}>Password (8+ characters)</Text>
            <TextInput
              style={styles.input}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            {error ? (
              <Text style={{ color: colors.danger, marginBottom: 12, fontWeight: "600" }}>
                {error}
              </Text>
            ) : null}
            <Pressable style={styles.button} onPress={onSubmit} disabled={busy}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create account</Text>
              )}
            </Pressable>
          </Card>
          <Text style={[styles.muted, { marginTop: 12 }]}>
            Already registered?{" "}
            <Link href="/login">
              <Text style={{ color: colors.accentDark, fontWeight: "700" }}>Sign in</Text>
            </Link>
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
