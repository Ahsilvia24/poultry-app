import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { getReports, listFarms } from "../../src/repos/data";
import { addDaysKey, todayKey } from "../../src/lib/ids";
import { colors, styles } from "../../src/theme";
import {
  Card,
  Chip,
  PageHeader,
  PrimaryButton,
} from "../../src/components/ui";

function formatDateHeader(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ReportsScreen() {
  const router = useRouter();
  const farms = useMemo(() => listFarms().farms, []);
  const [farmId, setFarmId] = useState(farms[0]?.id ?? "");
  const [from, setFrom] = useState(addDaysKey(todayKey(), -14));
  const [to, setTo] = useState(todayKey());
  const [matrix, setMatrix] = useState(() => getReports(from, to, farmId || undefined));

  function apply() {
    setMatrix(getReports(from, to, farmId || undefined));
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()} style={{ marginBottom: 8 }}>
          <Text style={{ color: colors.accentDark, fontWeight: "700" }}>← Back</Text>
        </Pressable>
        <PageHeader
          title="Reports"
          subtitle="House × date mortality matrix"
        />

        <Text style={styles.label}>Farm</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", marginBottom: 8 }}>
            <Chip label="All" active={farmId === ""} onPress={() => setFarmId("")} />
            {farms.map((f) => (
              <Chip
                key={f.id}
                label={f.farmName}
                active={farmId === f.id}
                onPress={() => setFarmId(f.id)}
              />
            ))}
          </View>
        </ScrollView>

        <Card>
          <Text style={styles.label}>From</Text>
          <TextInput style={styles.input} value={from} onChangeText={setFrom} autoCapitalize="none" />
          <Text style={styles.label}>To</Text>
          <TextInput style={styles.input} value={to} onChangeText={setTo} autoCapitalize="none" />
          <PrimaryButton label="Apply filters" onPress={apply} />
        </Card>

        <Card style={{ paddingVertical: 12 }}>
          <ScrollView horizontal>
            <View>
              <View
                style={{
                  flexDirection: "row",
                  marginBottom: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  paddingBottom: 8,
                }}
              >
                <Text style={{ width: 110, fontWeight: "800", color: colors.muted }}>House</Text>
                {matrix.dates.map((d) => (
                  <Text
                    key={d}
                    style={{
                      width: 52,
                      textAlign: "center",
                      fontWeight: "700",
                      fontSize: 12,
                      color: colors.muted,
                    }}
                  >
                    {formatDateHeader(d)}
                  </Text>
                ))}
                <Text style={{ width: 48, textAlign: "right", fontWeight: "800", color: colors.muted }}>
                  Tot
                </Text>
              </View>
              {matrix.rows.length === 0 ? (
                <Text style={styles.muted}>No data for range</Text>
              ) : (
                matrix.rows.map((row) => {
                  const total = matrix.dates.reduce((s, d) => s + (row.byDate[d] ?? 0), 0);
                  return (
                    <View key={row.houseLabel} style={{ flexDirection: "row", marginBottom: 6 }}>
                      <Text style={{ width: 110, fontWeight: "700" }} numberOfLines={1}>
                        {row.houseLabel}
                      </Text>
                      {matrix.dates.map((d) => {
                        const n = row.byDate[d] ?? 0;
                        return (
                          <Text
                            key={d}
                            style={{
                              width: 52,
                              textAlign: "center",
                              color: n > 0 ? colors.text : colors.muted,
                              fontWeight: n > 0 ? "700" : "400",
                            }}
                          >
                            {n}
                          </Text>
                        );
                      })}
                      <Text style={{ width: 48, textAlign: "right", fontWeight: "800" }}>{total}</Text>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}
