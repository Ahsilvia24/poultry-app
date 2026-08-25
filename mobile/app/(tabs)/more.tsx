import { Pressable, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth";
import { colors, styles } from "../../src/theme";
import { Card, PageHeader, SectionTitle } from "../../src/components/ui";

const LINKS = [
  { href: "/(tabs)/reports", title: "Reports" },
  { href: "/(tabs)/mortality", title: "Mortality entry" },
  { href: "/(tabs)/lfo", title: "LFO" },
  { href: "/(tabs)/tools", title: "Tools" },
] as const;

export default function MoreScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={{ marginBottom: 8 }}>
          <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← Back</Text>
        </Pressable>
        <PageHeader title="More" />

        <SectionTitle>Navigate</SectionTitle>
        {LINKS.map((link) => (
          <Pressable key={link.href} onPress={() => router.push(link.href as any)}>
            <Card>
              <Text style={{ fontWeight: "800", fontSize: 16 }}>{link.title}</Text>
            </Card>
          </Pressable>
        ))}

        <SectionTitle>Coming soon on mobile</SectionTitle>
        <Card>
          <Text style={{ fontWeight: "700" }}>Settlement</Text>
          <Text style={[styles.muted, { marginTop: 4 }]}>
            Settlement sheet entry is available in the web app for now.
          </Text>
        </Card>
        <Card>
          <Text style={{ fontWeight: "700" }}>Settings</Text>
          <Text style={[styles.muted, { marginTop: 4 }]}>
            Mortality thresholds and preferences are available in the web app for now.
          </Text>
        </Card>

        <SectionTitle>Account</SectionTitle>
        <Card>
          <Text style={{ fontWeight: "700" }}>{user?.name ?? "Technician"}</Text>
          <Text style={[styles.muted, { marginTop: 4 }]}>{user?.email}</Text>
          <Text style={[styles.muted, { marginTop: 8 }]}>
            Data is saved on this phone and works offline.
          </Text>
          <Pressable onPress={signOut} style={{ marginTop: 14 }}>
            <Text style={{ color: colors.danger, fontWeight: "800" }}>Sign out</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
