import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { getReports, listFarms } from "../../src/repos/data";
import { addDaysKey, todayKey } from "../../src/lib/ids";
import { colors, styles } from "../../src/theme";

function formatDateHeader(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y!, (m ?? 1) - 1, d ?? 1);
  return dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function ReportsScreen() {
  const farms = useMemo(() => listFarms().farms, []);
  const [farmId, setFarmId] = useState(farms[0]?.id ?? "");
  const [from, setFrom] = useState(addDaysKey(todayKey(), -14));
  const [to, setTo] = useState(todayKey());
  const [matrix, setMatrix] = useState(() => getReports(from, to, farmId || undefined));

  function apply() {
    setMatrix(getReports(from, to, farmId || undefined));
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.subtitle}>House × date mortality · offline</Text>

      <Text style={styles.label}>Farm</Text>
      <View style={[styles.row, { marginBottom: 8 }]}>
        <Pressable
          onPress={() => setFarmId("")}
          style={[
            styles.button,
            styles.buttonSecondary,
            { minHeight: 40, paddingHorizontal: 10 },
            farmId === "" ? { backgroundColor: colors.accent } : null,
          ]}
        >
          <Text style={[styles.buttonSecondaryText, farmId === "" ? { color: "#fff" } : null]}>
            All
          </Text>
        </Pressable>
        {farms.map((f) => (
          <Pressable
            key={f.id}
            onPress={() => setFarmId(f.id)}
            style={[
              styles.button,
              styles.buttonSecondary,
              { minHeight: 40, paddingHorizontal: 10 },
              farmId === f.id ? { backgroundColor: colors.accent } : null,
            ]}
          >
            <Text
              style={[
                styles.buttonSecondaryText,
                farmId === f.id ? { color: "#fff" } : null,
                { fontSize: 13 },
              ]}
            >
              {f.farmName}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>From</Text>
      <TextInput style={styles.input} value={from} onChangeText={setFrom} autoCapitalize="none" />
      <Text style={styles.label}>To</Text>
      <TextInput style={styles.input} value={to} onChangeText={setTo} autoCapitalize="none" />
      <Pressable style={styles.button} onPress={apply}>
        <Text style={styles.buttonText}>Apply</Text>
      </Pressable>

      <ScrollView horizontal style={{ marginTop: 16 }}>
        <View>
          <View style={{ flexDirection: "row", marginBottom: 6 }}>
            <Text style={{ width: 110, fontWeight: "800" }}>House</Text>
            {matrix.dates.map((d) => (
              <Text key={d} style={{ width: 52, textAlign: "center", fontWeight: "700", fontSize: 12 }}>
                {formatDateHeader(d)}
              </Text>
            ))}
            <Text style={{ width: 48, textAlign: "right", fontWeight: "800" }}>Tot</Text>
          </View>
          {matrix.rows.length === 0 ? (
            <Text style={styles.muted}>No data for range</Text>
          ) : (
            matrix.rows.map((row) => {
              const total = matrix.dates.reduce((s, d) => s + (row.byDate[d] ?? 0), 0);
              return (
                <View key={row.houseLabel} style={{ flexDirection: "row", marginBottom: 4 }}>
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
    </ScrollView>
  );
}
