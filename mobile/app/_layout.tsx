import "react-native-gesture-handler";
import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { AuthProvider, useAuth } from "../src/auth";
import { colors } from "../src/theme";
import { StatusBar } from "expo-status-bar";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, dbReady, dbError } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const inAuth = segments[0] === "login";

  useEffect(() => {
    if (loading) return;
    if (!user && !inAuth) router.replace("/login");
    if (user && inAuth) router.replace("/");
  }, [user, loading, inAuth, router]);

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  if (dbError && !dbReady) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.bg,
          padding: 24,
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, textAlign: "center" }}>
          This browser can’t run offline storage
        </Text>
        <Text style={{ marginTop: 10, fontSize: 14, color: colors.muted, textAlign: "center" }}>
          {dbError}
        </Text>
      </View>
    );
  }

  // Don't mount tab screens while redirecting — they call getDb() during render.
  if ((!user && !inAuth) || (user && inAuth)) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
      </AuthGate>
    </AuthProvider>
  );
}
