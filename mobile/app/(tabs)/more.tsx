import { Pressable, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth";
import { colors, styles } from "../../src/theme";
import { Card, PageHeader, SectionTitle } from "../../src/components/ui";
import { ExportDataCard } from "../../src/components/ExportDataCard";

const LINKS = [
  {
    href: "/(tabs)/reports",
    title: "Reports",
    subtitle: "House × date mortality matrix",
  },
  {
    href: "/(tabs)/mortality",
    title: "Mortality entry",
    subtitle: "Age grid and by-date entry",
  },
  {
    href: "/(tabs)/lfo",
    title: "LFO",
    subtitle: "Last feed order and consumption",
  },
  {
    href: "/(tabs)/tools",
    title: "Weight Proj.",
    subtitle: "Weight projections and field calculators",
  },
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
        <PageHeader title="More" subtitle="Reports and account" />

        <SectionTitle>Navigate</SectionTitle>
        {LINKS.map((link) => (
          <Pressable key={link.href} onPress={() => router.push(link.href as any)}>
            <Card>
              <Text style={{ fontWeight: "800", fontSize: 16 }}>{link.title}</Text>
              <Text style={[styles.muted, { marginTop: 4 }]}>{link.subtitle}</Text>
            </Card>
          </Pressable>
        ))}

        <SectionTitle>Backup & sync</SectionTitle>
        <ExportDataCard />

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
